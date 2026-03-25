"""
TikTok Generator API — Fast version
Uses ffmpeg directly instead of moviepy for 5-10x speed improvement.
Caches audio analysis to avoid re-analyzing every time.
"""

import os
import glob
import json
import random
import uuid
import subprocess
import tempfile
import numpy as np
from contextlib import asynccontextmanager
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import librosa
from scipy.ndimage import uniform_filter1d


async def auto_refresh_stats():
    """Fetch stats for all posts from Supabase via Apify, runs every hour."""
    import httpx

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    apify_token = (os.environ.get("APIFY_TOKEN") or "").strip()

    if not supabase_url or not supabase_key or not apify_token:
        return

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{supabase_url}/rest/v1/posts?select=id,url,status", headers=headers)
        if res.status_code != 200:
            return
        posts = res.json()

    for post in posts:
        try:
            apify_url = f"https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token={apify_token}"
            payload = {
                "postURLs": [post["url"]],
                "resultsType": "posts",
                "maxItems": 1,
                "shouldDownloadVideos": False,
                "shouldDownloadCovers": False,
            }
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(apify_url, json=payload)
            if resp.status_code >= 300:
                continue
            items = resp.json()
            if not items:
                continue
            item = items[0]
            views     = item.get("playCount", 0) or 0
            likes     = item.get("diggCount", 0) or 0
            comments  = item.get("commentCount", 0) or 0
            shares    = item.get("shareCount", 0) or 0
            bookmarks = item.get("collectCount", 0) or 0
            engagement = round((likes + comments + shares) / views * 100, 2) if views > 0 else 0.0

            analytics_payload = {
                "post_id": post["id"],
                "views": views, "likes": likes, "comments": comments,
                "shares": shares, "bookmarks": bookmarks,
                "engagement_rate": engagement, "source": "apify-cron",
            }
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{supabase_url}/rest/v1/analytics",
                    json=analytics_payload,
                    headers=headers,
                )

            if views >= 100 and post.get("status") == "pending":
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.patch(
                        f"{supabase_url}/rest/v1/posts?id=eq.{post['id']}",
                        json={"status": "approved"},
                        headers=headers,
                    )
        except Exception:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm audio analysis cache at startup, then start hourly stats refresh."""
    import asyncio
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    loop = asyncio.get_event_loop()
    def warm():
        for ext in ("*.wav", "*.mp3", "*.aac", "*.m4a"):
            for t in glob.glob(os.path.join(ASSETS_DIR, ext)):
                try:
                    analyze_track(t)
                except Exception:
                    pass
    await loop.run_in_executor(None, warm)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(auto_refresh_stats, "interval", hours=1)
    scheduler.start()

    yield

    scheduler.shutdown()


app = FastAPI(title="TikTok Generator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
CACHE_DIR = os.path.join(BASE_DIR, ".cache")

WIDTH, HEIGHT = 864, 576
VIDEO_DURATION = 15.0
DROP_LEAD_TIME = 1.5

# In-memory cache for audio analysis
_track_cache: dict = {}


class GenerateRequest(BaseModel):
    category: str
    color: str
    track: str = "Wake up vFINAL.wav"


class CaptionRequest(BaseModel):
    category: str
    color: str
    track_name: str = ""


# ─── AUDIO ANALYSIS (cached) ────────────────────────────────────

def analyze_track(audio_path: str) -> dict:
    """Analyze a track. Results are cached to avoid re-analyzing."""
    if audio_path in _track_cache:
        return _track_cache[audio_path]

    # Check file cache — use file size as stable key (mtime changes on git clone)
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, os.path.basename(audio_path) + ".json")
    file_size = os.path.getsize(audio_path)

    if os.path.exists(cache_file):
        with open(cache_file) as f:
            cached = json.load(f)
        if cached.get("file_size") == file_size:
            _track_cache[audio_path] = cached
            return cached

    # Analyze
    y, sr = librosa.load(audio_path)
    duration = librosa.get_duration(y=y, sr=sr)

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo_val = float(np.atleast_1d(tempo)[0])

    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.frames_to_time(range(len(rms)), sr=sr)
    rms_smooth = uniform_filter1d(rms, size=50)

    rms_diff = np.diff(rms_smooth)
    if len(rms_diff) > 0:
        drop_idx = int(np.argmax(rms_diff))
        drop_time = float(rms_times[drop_idx])
    else:
        drop_time = duration * 0.3

    clip_start = max(0, drop_time - DROP_LEAD_TIME)
    clip_end = min(duration, clip_start + VIDEO_DURATION)
    if clip_end - clip_start < VIDEO_DURATION:
        clip_start = max(0, clip_end - VIDEO_DURATION)

    result = {
        "duration": duration,
        "tempo": tempo_val,
        "drop_time": drop_time,
        "clip_start": clip_start,
        "clip_end": clip_end,
        "clip_duration": clip_end - clip_start,
        "file_size": file_size,
    }

    # Save to file cache
    with open(cache_file, "w") as f:
        json.dump(result, f)

    _track_cache[audio_path] = result
    return result


def generate_synced_cuts(analysis: dict) -> list[float]:
    clip_start = analysis["clip_start"]
    clip_duration = analysis["clip_duration"]
    drop_time = analysis["drop_time"]
    drop_relative = drop_time - clip_start

    durations = []
    current = 0.0

    while current < clip_duration:
        time_to_drop = drop_relative - current

        if time_to_drop > 2.0:
            base = 0.15
        elif time_to_drop > 0.5:
            base = 0.12
        elif time_to_drop > -1.0:
            base = 0.08
        elif time_to_drop > -4.0:
            base = 0.10
        elif current > clip_duration - 3.0:
            base = 0.17
        else:
            base = 0.13

        variation = random.uniform(-0.02, 0.02)
        dur = max(0.06, base + variation)

        if current + dur > clip_duration:
            dur = clip_duration - current

        if dur > 0.03:
            durations.append(dur)
            current += dur

    return durations


# ─── IMAGE UTILS ─────────────────────────────────────────────────

def get_images(category: str, color: str) -> list[str]:
    img_dir = os.path.join(IMAGES_DIR, category, color)
    if not os.path.isdir(img_dir):
        raise HTTPException(status_code=404, detail=f"No images for {category}/{color}")

    files = []
    for ext in ("*.jpg", "*.png", "*.jpeg", "*.webp"):
        files.extend(glob.glob(os.path.join(img_dir, ext)))

    if not files:
        raise HTTPException(status_code=404, detail=f"No images found in {category}/{color}")
    return files


def is_real_photo(img_path: str) -> bool:
    try:
        img = Image.open(img_path).convert("RGB")
        if img.width < 200 or img.height < 200:
            return False
        arr = np.array(img.resize((64, 64)), dtype=np.float32)
        return np.var(arr) > 800
    except Exception:
        return False


def prepare_image(img_path: str, output_path: str):
    """Resize and crop image, save to output path."""
    img = Image.open(img_path).convert("RGB")
    target_ratio = WIDTH / HEIGHT
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:
        new_h = int(img.width / target_ratio)
        top = (img.height - new_h) // 2
        img = img.crop((0, top, img.width, top + new_h))

    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    img.save(output_path, "JPEG", quality=85)


# ─── FAST VIDEO GENERATION (ffmpeg) ─────────────────────────────

def generate_video_ffmpeg(
    image_paths: list[str],
    durations: list[float],
    audio_path: str,
    clip_start: float,
    clip_end: float,
    output_path: str,
):
    """
    Generate video using ffmpeg directly.
    Much faster than moviepy: writes a concat file and lets ffmpeg handle it.
    """
    tmpdir = tempfile.mkdtemp()

    # 1. Prepare images (resize + crop) in parallel-friendly way
    prepped_paths = []
    for i, img_path in enumerate(image_paths):
        out = os.path.join(tmpdir, f"img_{i:04d}.jpg")
        prepare_image(img_path, out)
        prepped_paths.append(out)

    # 2. Write ffmpeg concat file
    concat_file = os.path.join(tmpdir, "concat.txt")
    with open(concat_file, "w") as f:
        for img_path, dur in zip(prepped_paths, durations):
            f.write(f"file '{img_path}'\n")
            f.write(f"duration {dur:.4f}\n")
        # ffmpeg needs the last image repeated
        f.write(f"file '{prepped_paths[-1]}'\n")

    # 3. Generate video with audio in one ffmpeg call
    clip_duration = clip_end - clip_start

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-ss", str(clip_start), "-t", str(clip_duration), "-i", audio_path,
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    # Cleanup temp files
    for f in prepped_paths:
        os.remove(f)
    os.remove(concat_file)
    os.rmdir(tmpdir)

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-500:]}")


def get_video_duration(path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except Exception:
        return 5.0


def extract_video_clip(vid_path: str, dur: float, out_path: str):
    """Extract a random clip of `dur` seconds from vid_path, scaled to WIDTH×HEIGHT."""
    vid_total = get_video_duration(vid_path)
    max_start = max(0, vid_total - dur - 0.3)
    start = random.uniform(0.1, max_start) if max_start > 0.1 else 0
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-t", str(dur),
        "-i", vid_path,
        "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}",
        "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
        out_path,
    ], capture_output=True, timeout=15)


def photo_to_clip(img_path: str, dur: float, out_path: str):
    """Convert a photo to a still video clip of `dur` seconds."""
    tmp_img = out_path + "_src.jpg"
    prepare_image(img_path, tmp_img)
    subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(dur), "-i", tmp_img,
        "-vf", f"scale={WIDTH}:{HEIGHT}",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
        out_path,
    ], capture_output=True, timeout=10)
    if os.path.exists(tmp_img):
        os.remove(tmp_img)


def generate_mixed_ffmpeg(
    image_paths: list[str],
    video_dir: str,
    analysis: dict,
    audio_path: str,
    output_path: str,
):
    """
    Mixed photo+video TikTok — 3 video clips total, structured as:

    [4 photos] → [video 1] → [4 photos] → [video 2] → [4 photos] → [video 3] → [remaining photos]

    Photos slow enough to read (~0.35-0.55s), speeding up around the drop.
    Video clips: 2-3s each, placed at roughly 1/4, 1/2, 3/4 of total duration.
    """
    import shutil
    tmpdir = tempfile.mkdtemp()

    clip_start = analysis["clip_start"]
    clip_dur   = analysis["clip_duration"]
    drop_rel   = analysis["drop_time"] - clip_start

    videos = glob.glob(os.path.join(video_dir, "*.mp4"))
    random.shuffle(videos)
    random.shuffle(image_paths)

    video_only = len(image_paths) == 0  # VHS mode: no photos

    if video_only:
        # ── VHS mode: fast random clips from different videos ─────
        # Each clip is short (0.5-1.5s), picked from a random position
        # in a random video — creates a fast-cut montage effect
        segments = []
        t_cursor = 0.0
        vid_idx = 0
        while t_cursor < clip_dur - 0.1:
            v = videos[vid_idx % len(videos)]
            vid_idx += 1
            v_total = get_video_duration(v)
            dur = min(random.uniform(0.5, 1.5), clip_dur - t_cursor)
            if dur < 0.2:
                break
            max_start = max(0.0, v_total - dur - 0.1)
            start = random.uniform(0.0, max_start) if max_start > 0 else 0.0
            segments.append(('video_at', v, dur, start))
            t_cursor += dur
    else:
        segments  = []
        photo_idx = 0
        t_cursor  = 0.0

        tempo     = analysis.get("tempo", 120.0)
        beat      = 60.0 / tempo          # seconds per beat

        # ── Beat-synced photo duration — constant speed ───────────
        def photo_dur(t_in_clip: float) -> float:
            return beat / 2               # 2 photos per beat, constant

        def fill_photos_until(target_t: float) -> None:
            nonlocal photo_idx, t_cursor
            while t_cursor < target_t - 0.04:
                dur = min(photo_dur(t_cursor), target_t - t_cursor)
                if dur < 0.04:
                    break
                segments.append(('photo', image_paths[photo_idx % len(image_paths)], dur))
                photo_idx += 1
                t_cursor  += dur

        # ── Video durations ───────────────────────────────────────
        vid_durs = [random.uniform(1.5, 2.5), random.uniform(2.0, 3.0), random.uniform(2.0, 3.0)]

        # ── Pick video sources — 3 different videos ───────────────
        vid_sources = []
        used_videos: list[str] = []
        for vd in vid_durs:
            chosen = None
            for v in videos:
                if v not in used_videos and get_video_duration(v) >= vd + 0.5:
                    chosen = v
                    break
            if chosen is None:
                chosen = videos[len(vid_sources) % len(videos)]
            used_videos.append(chosen)
            vid_sources.append((chosen, vd))

        vid_playhead: dict[str, float] = {}

        def pick_clip_start(vid_path: str, dur: float) -> float:
            total = get_video_duration(vid_path)
            if vid_path not in vid_playhead:
                total_needed = sum(vd for v, vd in vid_sources if v == vid_path)
                max_s = max(0.0, total - total_needed - 0.3)
                vid_playhead[vid_path] = random.uniform(0.1, max_s) if max_s > 0.1 else 0.0
            start = min(vid_playhead[vid_path], max(0.0, total - dur - 0.1))
            vid_playhead[vid_path] = start + dur
            return start

        # ── Structure: photos → [video 1 AT drop] → photos → video 2 → photos → video 3 ──
        # Video 1 starts exactly at the drop
        v1_dur  = vid_durs[0]
        v1_start_t = max(0.0, min(drop_rel, clip_dur - sum(vid_durs) - 1.0))

        fill_photos_until(v1_start_t)

        # Insert video 1 at drop
        vid_path, vd = vid_sources[0]
        vd = min(vd, clip_dur - t_cursor)
        if vd >= 0.5:
            clip_s = pick_clip_start(vid_path, vd)
            segments.append(('video_at', vid_path, vd, clip_s))
            t_cursor += vd

        # Remaining time split evenly for [photos → video 2 → photos → video 3 → photos]
        remaining = clip_dur - t_cursor
        # Allocate: 30% photos, video 2, 30% photos, video 3, rest photos
        v2_dur = min(vid_durs[1], remaining * 0.3)
        v3_dur = min(vid_durs[2], remaining * 0.3)
        photo_time_left = remaining - v2_dur - v3_dur
        v2_t = t_cursor + photo_time_left * 0.40
        v3_t = v2_t + v2_dur + photo_time_left * 0.35

        fill_photos_until(v2_t)
        vid_path, _ = vid_sources[1]
        vd2 = min(v2_dur, clip_dur - t_cursor)
        if vd2 >= 0.5:
            clip_s = pick_clip_start(vid_path, vd2)
            segments.append(('video_at', vid_path, vd2, clip_s))
            t_cursor += vd2

        fill_photos_until(v3_t)
        vid_path, _ = vid_sources[2]
        vd3 = min(v3_dur, clip_dur - t_cursor)
        if vd3 >= 0.5:
            clip_s = pick_clip_start(vid_path, vd3)
            segments.append(('video_at', vid_path, vd3, clip_s))
            t_cursor += vd3

        fill_photos_until(clip_dur)

    # ── Render every segment to a short .mp4 ─────────────────────
    clips = []
    for i, seg in enumerate(segments):
        out_clip = os.path.join(tmpdir, f"seg_{i:04d}.mp4")
        seg_type = seg[0]
        if seg_type == 'photo':
            _, source, dur = seg
            photo_to_clip(source, dur, out_clip)
        elif seg_type == 'video_at':
            _, source, dur, start = seg
            subprocess.run([
                "ffmpeg", "-y",
                "-ss", str(start), "-t", str(dur),
                "-i", source,
                "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}",
                "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
                out_clip,
            ], capture_output=True, timeout=15)
        if os.path.exists(out_clip) and os.path.getsize(out_clip) > 500:
            clips.append(out_clip)

    if not clips:
        shutil.rmtree(tmpdir)
        raise RuntimeError("No segments generated")

    # ── Concat ────────────────────────────────────────────────────
    concat_file = os.path.join(tmpdir, "concat.txt")
    with open(concat_file, "w") as f:
        for c in clips:
            f.write(f"file '{c}'\n")

    merged = os.path.join(tmpdir, "merged.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c", "copy", merged,
    ], capture_output=True, timeout=120)

    # ── Add audio ─────────────────────────────────────────────────
    subprocess.run([
        "ffmpeg", "-y",
        "-i", merged,
        "-ss", str(clip_start), "-t", str(clip_dur), "-i", audio_path,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        output_path,
    ], capture_output=True, timeout=30)

    shutil.rmtree(tmpdir)

    if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
        raise RuntimeError("Mixed video generation failed")


# ─── ENDPOINTS ───────────────────────────────────────────────────

@app.get("/tracks")
async def list_tracks():
    tracks = []
    for ext in ("*.wav", "*.mp3", "*.aac", "*.m4a"):
        tracks.extend(glob.glob(os.path.join(ASSETS_DIR, ext)))

    result = []
    for t in sorted(tracks):
        filename = os.path.basename(t)
        name = os.path.splitext(filename)[0]
        try:
            analysis = analyze_track(t)
            result.append({
                "filename": filename,
                "name": name,
                "duration": round(analysis["duration"], 1),
                "tempo": round(analysis["tempo"]),
                "drop_time": round(analysis["drop_time"], 1),
                "clip_start": round(analysis["clip_start"], 1),
                "clip_end": round(analysis["clip_end"], 1),
            })
        except Exception as e:
            result.append({"filename": filename, "name": name, "error": str(e)})

    return result


@app.get("/categories")
async def list_categories():
    result = {}
    if os.path.isdir(IMAGES_DIR):
        for cat in sorted(os.listdir(IMAGES_DIR)):
            cat_path = os.path.join(IMAGES_DIR, cat)
            if not os.path.isdir(cat_path):
                continue
            colors = []
            for color in sorted(os.listdir(cat_path)):
                color_path = os.path.join(cat_path, color)
                if os.path.isdir(color_path):
                    count = len(glob.glob(os.path.join(color_path, "*.*")))
                    if count > 0:
                        colors.append({"name": color, "count": count})
            if colors:
                result[cat] = colors
    return result


def _generate_sync(category: str, color: str, track: str) -> str:
    """Synchronous generation — runs in thread pool to not block the event loop."""
    audio_path = os.path.join(ASSETS_DIR, track)
    if not os.path.isfile(audio_path):
        raise HTTPException(status_code=404, detail=f"Track not found: {track}")

    analysis = analyze_track(audio_path)

    output_file = os.path.join(
        OUTPUT_DIR,
        f"tiktok_{category}_{color}_{uuid.uuid4().hex[:8]}.mp4"
    )
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Mixed mode: photos + video clips (video_sample.mp4 schema)
    video_dir = os.path.join(IMAGES_DIR, category, color, "video")
    has_videos = os.path.isdir(video_dir) and bool(glob.glob(os.path.join(video_dir, "*.mp4")))

    # Check if there are photos (VHS has only videos, no photos)
    img_dir = os.path.join(IMAGES_DIR, category, color)
    photo_exts = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
    has_photos = any(glob.glob(os.path.join(img_dir, ext)) for ext in photo_exts)

    if has_videos and has_photos:
        real_photos = get_images(category, color)
        random.shuffle(real_photos)
        generate_mixed_ffmpeg(
            image_paths=real_photos,
            video_dir=video_dir,
            analysis=analysis,
            audio_path=audio_path,
            output_path=output_file,
        )
    elif has_videos and not has_photos:
        # VHS / video-only mode: stitch video clips directly
        generate_mixed_ffmpeg(
            image_paths=[],
            video_dir=video_dir,
            analysis=analysis,
            audio_path=audio_path,
            output_path=output_file,
        )
    else:
        # Photo-only slideshow (categories without video/ subfolder)
        real_photos = get_images(category, color)
        durations = generate_synced_cuts(analysis)
        n_needed = len(durations)

        random.shuffle(real_photos)
        while len(real_photos) < n_needed:
            real_photos.extend(real_photos[:n_needed - len(real_photos)])
        selected = real_photos[:n_needed]

        generate_video_ffmpeg(
            image_paths=selected,
            durations=durations,
            audio_path=audio_path,
            clip_start=analysis["clip_start"],
            clip_end=analysis["clip_end"],
            output_path=output_file,
        )
    return output_file


@app.post("/generate")
async def generate_tiktok(req: GenerateRequest):
    import asyncio
    loop = asyncio.get_event_loop()
    output_file = await loop.run_in_executor(
        None, _generate_sync, req.category, req.color, req.track
    )
    return FileResponse(
        output_file,
        media_type="video/mp4",
        filename=os.path.basename(output_file),
    )


CAPTIONS = {
    "italy": [
        "House music >>",
        "bring me back",
        "this sound feels different",
        "cool people listen to house music",
        "House music.",
        "Summer and house music",
        "Italians and house music",
        "She listens to house music",
        "My mood? Italian house music",
        "Summer, Cocktail and Italian house music",
        "Italian house music to add to your playlist",
    ],
    "party": [
        "House music >>",
        "this sound hits different at 2am",
        "bring me back to that night",
        "the night is still young",
        "house music people are different",
        "lost in the music",
        "we don't stop",
        "the club at 3am >>",
        "house music is a feeling",
        "that moment when the drop hits",
        "born to rave",
        "dancefloor therapy",
    ],
    "la": [
        "House music >>",
        "LA nights hit different",
        "this is the vibe",
        "golden hour house music",
        "LA and house music",
        "sunset and house music",
        "Hollywood house music",
        "this sound feels different",
        "cool people listen to house music",
    ],
}

HASHTAGS = {
    "italy": "#housemusic #italy #fyp #xyzbca #viral #targetaudience #foryou #techno #deephouse #italianvibes #dolcevita #summer",
    "party": "#housemusic #fyp #viral #club #nightlife #rave #techno #deephouse #dancefloor #xyzbca #foryou #nightout",
    "la": "#housemusic #la #losangeles #fyp #viral #xyzbca #foryou #techno #deephouse #california #sunset #vibes",
}


@app.post("/caption")
async def generate_caption(req: CaptionRequest):
    """Return a random caption + hashtags from preset lists."""
    captions = CAPTIONS.get(req.category, CAPTIONS["italy"])
    hashtags = HASHTAGS.get(req.category, HASHTAGS["italy"])
    return {
        "caption": random.choice(captions),
        "hashtags": hashtags,
    }


# ─── ANALYTICS TRACKING (Apify) ──────────────────────────────────

class FetchStatsRequest(BaseModel):
    url: str


@app.post("/fetch-stats")
async def fetch_stats(req: FetchStatsRequest):
    """
    Fetch TikTok post metrics via Apify clockworks/tiktok-scraper.
    APIFY_TOKEN must be set as an environment variable.
    """
    import httpx

    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        raise HTTPException(status_code=500, detail="APIFY_TOKEN not configured")

    apify_url = f"https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token={token}"

    payload = {
        "postURLs": [req.url],
        "resultsType": "posts",
        "maxItems": 1,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(apify_url, json=payload)

    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Apify error: {resp.text[:200]}")

    items = resp.json()
    if not items:
        raise HTTPException(status_code=422, detail="No data returned — post may be private or URL invalid")

    item = items[0]
    views    = item.get("playCount", 0) or 0
    likes    = item.get("diggCount", 0) or 0
    comments = item.get("commentCount", 0) or 0
    shares   = item.get("shareCount", 0) or 0
    bookmarks = item.get("collectCount", 0) or 0
    engagement = round((likes + comments + shares) / views * 100, 2) if views > 0 else 0.0

    return {
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "bookmarks": bookmarks,
        "engagement_rate": engagement,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
