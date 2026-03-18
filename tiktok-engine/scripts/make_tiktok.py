"""
TikTok Old Money Italy — Montage automatisé v3
  - Cuts ultra rapides: 0.10-0.13s par image (~7-10 cuts/seconde)
  - 3 extraits vidéo insérés entre les photos (1-2s chacun)
  - PAS de filtre — DA bleue native des photos
  - Audio commence 1-2s avant le drop
"""

import os
import glob
import random
import numpy as np
from PIL import Image
from moviepy import (
    ImageClip, AudioFileClip, VideoFileClip,
    concatenate_videoclips,
)

# ─── CONFIG ───────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
VIDEOS_DIR = os.path.join(BASE_DIR, "videos", "prepped")
AUDIO_FILE = os.path.join(BASE_DIR, "Wake up vFINAL.wav")
OUTPUT_FILE = os.path.join(BASE_DIR, "output_tiktok.mp4")

WIDTH, HEIGHT = 864, 576

AUDIO_START = 40.5
AUDIO_END = 55.5
TOTAL_DURATION = AUDIO_END - AUDIO_START  # 15s

# Durée des extraits vidéo (secondes)
VIDEO_CLIP_DURATION = 1.5

# Positions où insérer les 3 extraits vidéo (en secondes dans la timeline)
# Inspiré de la ref: milieu de chaque "phase"
VIDEO_INSERT_TIMES = [4.5, 8.5, 12.0]


# ─── UTILS ─────────────────────────────────────────────────────────

def get_all_images() -> list:
    all_files = []
    for cat_dir in sorted(glob.glob(os.path.join(IMAGES_DIR, "*"))):
        if not os.path.isdir(cat_dir):
            continue
        cat_name = os.path.basename(cat_dir)
        if cat_name == "pinterest":
            continue
        for ext in ("*.jpg", "*.png", "*.jpeg"):
            files = glob.glob(os.path.join(cat_dir, "**", ext), recursive=True)
            for f in files:
                all_files.append((f, cat_name))
    return all_files


def get_video_clips() -> list:
    """Récupère tous les fichiers vidéo disponibles."""
    videos = []
    for ext in ("*.mp4", "*.mov", "*.avi"):
        videos.extend(glob.glob(os.path.join(VIDEOS_DIR, "**", ext), recursive=True))
    return videos


def is_real_photo(img_path: str) -> bool:
    try:
        img = Image.open(img_path).convert("RGB")
        if img.width < 200 or img.height < 200:
            return False
        arr = np.array(img.resize((64, 64)), dtype=np.float32)
        return np.var(arr) > 800
    except Exception:
        return False


def prepare_image(img_path: str, target_w: int, target_h: int) -> np.ndarray:
    img = Image.open(img_path).convert("RGB")
    target_ratio = target_w / target_h
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:
        new_h = int(img.width / target_ratio)
        top = (img.height - new_h) // 2
        img = img.crop((0, top, img.width, top + new_h))

    img = img.resize((target_w, target_h), Image.LANCZOS)
    return np.array(img)


def prepare_video_clip(video_path: str, duration: float):
    """Charge un extrait vidéo pré-converti (déjà au bon format)."""
    clip = VideoFileClip(video_path)

    # Prendre un extrait
    max_start = max(0, clip.duration - duration - 0.5)
    start = random.uniform(0.3, max_start) if max_start > 0.3 else 0
    clip = clip.subclipped(start, min(start + duration, clip.duration))

    # Supprimer l'audio
    clip = clip.without_audio()

    return clip


def generate_photo_sections(total_duration: float, video_insert_times: list,
                            video_clip_duration: float) -> list:
    """
    Génère les sections de photos entre les extraits vidéo.
    Retourne une liste de (start, end, type) pour chaque section.
    """
    sections = []
    current = 0.0

    for vt in sorted(video_insert_times):
        if vt > current:
            sections.append((current, vt, "photos"))
        sections.append((vt, vt + video_clip_duration, "video"))
        current = vt + video_clip_duration

    if current < total_duration:
        sections.append((current, total_duration, "photos"))

    return sections


def generate_cut_durations_for_section(section_duration: float, phase_start_time: float) -> list:
    """Génère les durées de cut pour une section de photos."""
    phases = [
        (0.0, 4.0, 0.13),
        (4.0, 6.0, 0.13),
        (6.0, 9.0, 0.10),
        (9.0, 12.0, 0.13),
        (12.0, 15.0, 0.17),
    ]

    durations = []
    elapsed = 0.0

    while elapsed < section_duration:
        global_time = phase_start_time + elapsed
        cut_speed = 0.13
        for ps, pe, speed in phases:
            if ps <= global_time < pe:
                cut_speed = speed
                break

        variation = random.uniform(-0.02, 0.02)
        dur = max(0.07, cut_speed + variation)

        if elapsed + dur > section_duration:
            dur = section_duration - elapsed

        if dur > 0.03:
            durations.append(dur)
            elapsed += dur

    return durations


# ─── MAIN ──────────────────────────────────────────────────────────

def make_tiktok():
    print(f"TikTok Old Money Italy — v3 (cuts rapides + video clips)")
    print(f"   Format: {WIDTH}x{HEIGHT}")
    print(f"   Audio: {AUDIO_START}s -> {AUDIO_END}s ({TOTAL_DURATION}s)")
    print(f"   Video inserts at: {VIDEO_INSERT_TIMES}")
    print()

    # 1. Charger images et vidéos
    all_images = get_all_images()
    real_photos = [(f, cat) for f, cat in all_images if is_real_photo(f)]
    random.shuffle(real_photos)
    print(f"Photos disponibles: {len(real_photos)}")

    video_files = get_video_clips()
    random.shuffle(video_files)
    print(f"Videos disponibles: {len(video_files)}")

    if len(video_files) < 3:
        print("ATTENTION: moins de 3 vidéos disponibles!")

    # 2. Générer la structure: sections photos + vidéos
    sections = generate_photo_sections(TOTAL_DURATION, VIDEO_INSERT_TIMES, VIDEO_CLIP_DURATION)

    print(f"\nStructure du montage:")
    for start, end, stype in sections:
        print(f"  {start:5.1f}s - {end:5.1f}s  ({end-start:.1f}s)  [{stype}]")

    # 3. Construire les clips
    all_clips = []
    photo_idx = 0
    video_idx = 0
    total_photos = 0

    for start, end, stype in sections:
        section_dur = end - start

        if stype == "video":
            # Insérer un extrait vidéo
            if video_idx < len(video_files):
                vpath = video_files[video_idx]
                print(f"\n  Video clip: {os.path.basename(vpath)} ({VIDEO_CLIP_DURATION}s)")
                try:
                    vclip = prepare_video_clip(vpath, section_dur)
                    # Si le clip est plus court que prévu, on pad avec la dernière frame
                    if vclip.duration < section_dur:
                        vclip = vclip.with_duration(section_dur)
                    all_clips.append(vclip)
                    video_idx += 1
                    continue
                except Exception as e:
                    print(f"  Erreur video: {e}, fallback photos")

        # Section photos: cuts rapides
        cut_durations = generate_cut_durations_for_section(section_dur, start)

        for dur in cut_durations:
            if photo_idx >= len(real_photos):
                random.shuffle(real_photos)
                photo_idx = 0

            img_path, cat = real_photos[photo_idx]
            img_array = prepare_image(img_path, WIDTH, HEIGHT)
            clip = ImageClip(img_array, duration=dur)
            all_clips.append(clip)
            photo_idx += 1
            total_photos += 1

    print(f"\n{total_photos} photos + {video_idx} video clips")

    # 4. Assembler
    print("\nAssemblage...")
    video = concatenate_videoclips(all_clips, method="compose")

    # 5. Audio
    print("Ajout audio...")
    audio = AudioFileClip(AUDIO_FILE).subclipped(AUDIO_START, AUDIO_END)

    video_duration = min(video.duration, audio.duration)
    video = video.with_duration(video_duration)
    video = video.with_audio(audio.with_duration(video_duration))

    # 6. Export
    print(f"\nExport -> {OUTPUT_FILE}")
    video.write_videofile(
        OUTPUT_FILE,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        bitrate="5000k",
        preset="medium",
        logger="bar",
    )

    print(f"\nDone! {OUTPUT_FILE}")
    print(f"   {total_photos} photos + {video_idx} videos | {video_duration:.1f}s | {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    make_tiktok()
