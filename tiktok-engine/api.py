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
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import librosa
from scipy.ndimage import uniform_filter1d

app = FastAPI(title="TikTok Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

    # Check file cache
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, os.path.basename(audio_path) + ".json")
    file_mtime = os.path.getmtime(audio_path)

    if os.path.exists(cache_file):
        with open(cache_file) as f:
            cached = json.load(f)
        if cached.get("mtime") == file_mtime:
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
        "mtime": file_mtime,
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


def generate_video_clips_ffmpeg(
    video_dir: str,
    audio_path: str,
    audio_start: float,
    audio_end: float,
    drop_time: float,
    output_path: str,
):
    """
    Generate a TikTok from video clips.
    Before drop: long clips (2-3s) — stay on one video.
    At drop: fast cuts (0.4-0.8s) — switch between videos rapidly.
    """
    tmpdir = tempfile.mkdtemp()

    # 1. Find all videos
    videos = glob.glob(os.path.join(video_dir, "*.mp4"))
    if not videos:
        raise RuntimeError(f"No videos found in {video_dir}")

    random.shuffle(videos)
    total_needed = audio_end - audio_start
    drop_relative = drop_time - audio_start if drop_time > audio_start else total_needed * 0.3

    # 2. Generate clip durations synced to drop
    # Before drop: long clips (2-3s) — stay on one video
    # At/after drop: short clips (0.5-1s) — fast cuts between videos
    clip_durations = []
    t = 0
    while t < total_needed:
        time_to_drop = drop_relative - t
        if time_to_drop > 2.0:
            dur = random.uniform(2.5, 3.5)  # slow, stay on one clip
        elif time_to_drop > 0:
            dur = random.uniform(1.5, 2.0)  # building up
        elif time_to_drop > -3.0:
            dur = random.uniform(0.4, 0.8)  # DROP — fast cuts
        elif time_to_drop > -6.0:
            dur = random.uniform(0.6, 1.2)  # post-drop energy
        else:
            dur = random.uniform(1.5, 2.5)  # outro, slow down

        if t + dur > total_needed:
            dur = total_needed - t
        if dur > 0.1:
            clip_durations.append(dur)
            t += dur

    # 3. Extract clips from videos
    clips = []
    for i, dur in enumerate(clip_durations):
        vid = videos[i % len(videos)]
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", vid],
            capture_output=True, text=True
        )
        vid_duration = float(probe.stdout.strip())

        max_start = max(0, vid_duration - dur - 0.3)
        start = random.uniform(0.1, max_start) if max_start > 0.1 else 0

        out_clip = os.path.join(tmpdir, f"clip_{i:03d}.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(dur),
            "-i", vid,
            "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}",
            "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            out_clip,
        ], capture_output=True, timeout=10)

        if os.path.exists(out_clip) and os.path.getsize(out_clip) > 1000:
            clips.append(out_clip)

        if i > len(videos) * 5:
            break

    # 3. Concat all clips
    concat_file = os.path.join(tmpdir, "concat.txt")
    with open(concat_file, "w") as f:
        for c in clips:
            f.write(f"file '{c}'\n")

    merged = os.path.join(tmpdir, "merged.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c", "copy", merged,
    ], capture_output=True, timeout=30)

    # 4. Add audio
    audio_duration = audio_end - audio_start
    subprocess.run([
        "ffmpeg", "-y",
        "-i", merged,
        "-ss", str(audio_start), "-t", str(audio_duration), "-i", audio_path,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        output_path,
    ], capture_output=True, timeout=30)

    # Cleanup
    import shutil
    shutil.rmtree(tmpdir)

    if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
        raise RuntimeError("Video generation failed")


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

    # Check if this is a video-based category (has a "video" subfolder)
    video_dir = os.path.join(IMAGES_DIR, category, color, "video")
    if os.path.isdir(video_dir) and glob.glob(os.path.join(video_dir, "*.mp4")):
        generate_video_clips_ffmpeg(
            video_dir=video_dir,
            audio_path=audio_path,
            audio_start=analysis["clip_start"],
            audio_end=analysis["clip_end"],
            drop_time=analysis["drop_time"],
            output_path=output_file,
        )
    else:
        # Photo-based slideshow
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
}

HASHTAGS = {
    "italy": "#housemusic #italy #fyp #xyzbca #viral #targetaudience #foryou #techno #deephouse #italianvibes #dolcevita #summer",
    "party": "#housemusic #fyp #viral #club #nightlife #rave #techno #deephouse #dancefloor #xyzbca #foryou #nightout",
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
