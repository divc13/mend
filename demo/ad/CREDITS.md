# Credits — MEND ad

All stock footage and photography in this folder comes from **Pexels** and is used under the
[Pexels License](https://www.pexels.com/license/): free to use, including commercially; attribution is
not required; modification is allowed. We credit the creators here anyway so every asset has a
traceable provenance.

Retrieved: 2026-11-13.

## Important usage note

- This footage is **illustrative stock**, not documentary footage of a real MEND repair.
- Identifiable people in the footage are **not MEND endorsers, customers, team members, or
  contractors**. Do not caption or edit the footage in a way that implies they endorse MEND.
- The pothole repair scenario in the ad is a replay/simulation. The real contracts, DAO vote, AI
  signature, and Agent Market listing are separate, labelled testnet proof.
- Do not redistribute these files as standalone stock assets.

## Asset list

| Asset | File | Creator | Pexels page | Original |
| --- | --- | --- | --- | --- |
| Pothole / traffic | `footage/pothole.mp4` | CHRISTIAN BARDOT | [Motorbikes Navigating a Pothole in Urban Street](https://www.pexels.com/video/motorbikes-navigating-a-pothole-in-urban-street-34218247/) | 1920x1080, 25 fps, 7.2 s |
| Phone / reporting | `footage/phone.mp4` | Artem Podrez | [Close Up Video of a Man Using Cellphone](https://www.pexels.com/video/close-up-video-of-a-man-using-cellphone-8992783/) | 2160x3840 (page), 30 fps, 9.9 s |
| Phone / vertical proxy | `footage/phone-vertical.mp4` | Artem Podrez | [Close Up Video of a Man Using Cellphone](https://www.pexels.com/video/close-up-video-of-a-man-using-cellphone-8992783/) | 2160x3840 (page), 30 fps, 9.9 s |
| Repair / compaction | `footage/repair.mp4` | Suraphat Nuea-on | [Roller Compacting Asphalt on a Street](https://www.pexels.com/video/roller-compacting-asphalt-on-a-street-10333669/) | 1920x1080, 29.97 fps, 10.56 s |
| Roadworks / aerial | `footage/roadworks.mp4` | Jozef Papp | [Top View of Man Doing Road Works](https://www.pexels.com/video/top-view-of-man-doing-road-works-4115445/) | 3840x2160 (page), 25 fps, 20.8 s |
| Cyclist / wheels | `footage/cyclist.mp4` | Nothing Ahead | [Man Riding His Road Bike](https://www.pexels.com/video/man-riding-his-road-bike-9080400/) | 1920x1080, 29.97 fps, 6.08 s |
| Pothole still | `photos/pothole.jpg` | Erik Mclean | [Empty asphalt road with cracks going between coniferous trees on cloudy day](https://www.pexels.com/photo/empty-asphalt-road-with-cracks-going-between-coniferous-trees-on-cloudy-day-5688465/) | 3648x5472 JPEG |
| After still | `photos/after.jpg` | Nicolette Villavicencio | [Patched Hole in the Road](https://www.pexels.com/photo/patched-hole-in-the-road-6018646/) | 5184x3456 JPEG |

## Exact source URLs used

- Pothole video: `https://videos.pexels.com/video-files/34218247/14505627_1920_1080_25fps.mp4`
- Phone video: `https://videos.pexels.com/video-files/8992783/8992783-uhd_1440_2560_30fps.mp4`
- Repair video: `https://videos.pexels.com/video-files/10333669/10333669-hd_1920_1080_30fps.mp4`
- Roadworks video: `https://videos.pexels.com/video-files/4115445/4115445-uhd_2560_1440_25fps.mp4`
- Cyclist video (resolved from the Pexels download endpoint): `https://videos.pexels.com/video-files/9080400/9080400-hd_1920_1080_30fps.mp4`
  (requested via `https://www.pexels.com/download/video/9080400/`)
- Pothole photo: `https://images.pexels.com/photos/5688465/pexels-photo-5688465.jpeg`
- After photo: `https://images.pexels.com/photos/6018646/pexels-photo-6018646.jpeg`

## Output treatment

- All videos: 1920x1080, 30 fps, H.264 High, `yuv420p`, no audio, faststart. CRF 20.
- `roadworks.mp4` is trimmed to the first 10.0 s (source is 20.8 s).
- `phone.mp4` is a 16:9 composite: the vertical clip is scaled to 1080 px height and centered over a
  blurred, darkened fill made from the same clip. The untouched-shape 9:16 proxy is
  `phone-vertical.mp4` at 1080x1920.
- Photos are 1920x1080 JPEG at quality 90, center-cropped to 16:9, with EXIF/GPS metadata stripped.
- Per-file dimensions, durations, hashes, and processing notes are in
  [`public/assets/manifest.json`](public/assets/manifest.json).

## Music

| Asset | File | Track | Artist | Source | License |
| --- | --- | --- | --- | --- | --- |
| Music bed | `public/audio/music/music-1.mp3` | Mountains | Andrew Ev | [Mixkit](https://mixkit.co/free-stock-music/mountains/) | [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree) |

- Original track: 4:37 (`public/audio/music/mixkit-mountains.mp3`). The v2 cut used a 5:00 looped/edited bed (`music-1.mp3`); the current v3 cut trims the same licensed bed to 2:32.40.
- Direct source audio: `https://assets.mixkit.co/music/187/187.mp3`
- Retrieved: 2026-11-13.
- The license permits commercial and non-commercial use, including download, copy, modification,
  distribution, and public performance on web/social platforms and in online marketing ads. The
  license text does not require attribution; we credit the artist here for provenance.
- Not cleared for CDs/DVDs, TV/radio broadcast, video games, remixes, music-only tracks, or
  rights-management registration. The MEND ad is an online/social video, which is within the allowed
  uses.
- ElevenLabs Music was unavailable on the current Free plan (`402 paid_plan_required`), so this
  licensed track is the fallback. See `public/audio/music-selection.json` and
  `public/audio/music-error.json`.

## Music

- **“Mountains” — Andrew Ev** (Mixkit)
- Source: https://mixkit.co/free-stock-music/mood/uplifting/
- License: Mixkit Free License — free for commercial use. https://mixkit.co/license/#musicFree
- Edit: original 4:37.34 track plus a short tail, joined with a 3s crossfade to create the 5:00 v2 bed; the v3 cut trims it to 2:32.40.
- ElevenLabs Music was not available on the current free plan; this licensed track is the fallback.
