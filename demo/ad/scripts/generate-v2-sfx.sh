#!/usr/bin/env bash
# Generate the six v2 SFX cues from scratch with FFmpeg.
# No third-party samples are used; every sound is synthesized here.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FFMPEG="${FFMPEG:-$ROOT/node_modules/ffmpeg-static/ffmpeg}"
OUT="$ROOT/demo/ad/public/audio/v2/sfx"
mkdir -p "$OUT"

common=(-ac 2 -ar 44100 -b:a 128k)

# 1. Whoosh — filtered pink-noise swell with a short room tail.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:duration=0.55:sample_rate=44100:amplitude=0.7" \
  -af "highpass=f=260,lowpass=f=6800,volume=4.5,afade=t=in:st=0:d=0.10,afade=t=out:st=0.10:d=0.44,aecho=0.8:0.65:38:0.22,alimiter=limit=0.95" \
  "${common[@]}" "$OUT/whoosh.mp3"

# 2. UI click — two very short decaying sine pips.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc=0.5*sin(2*PI*1900*t)*exp(-95*t)+0.22*sin(2*PI*950*t)*exp(-65*t):d=0.12:s=44100" \
  -af "highpass=f=300,volume=0.8,alimiter=limit=0.95" \
  "${common[@]}" "$OUT/ui-click.mp3"

# 3. Camera shutter — two band-passed mechanical clicks plus a low body thump.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=white:duration=0.06:sample_rate=44100:amplitude=0.8" \
  -f lavfi -i "anoisesrc=color=white:duration=0.08:sample_rate=44100:amplitude=0.7" \
  -f lavfi -i "sine=frequency=140:duration=0.10:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=1200,lowpass=f=8200,afade=t=out:st=0.008:d=0.052[a0];[1:a]highpass=f=900,lowpass=f=7200,afade=t=out:st=0.008:d=0.072,adelay=110|110[a1];[2:a]afade=t=out:st=0.005:d=0.095,volume=0.35[a2];[a0][a1][a2]amix=inputs=3:duration=longest:normalize=0,volume=1.65,aecho=0.8:0.55:22:0.18,alimiter=limit=0.95[a]" \
  -map "[a]" "${common[@]}" "$OUT/camera-shutter.mp3"

# 4. DAO stamp — low thud, wooden body, tiny transient.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc=0.8*sin(2*PI*75*t)*exp(-14*t)+0.35*sin(2*PI*150*t)*exp(-25*t)+0.16*(random(0)*2-1)*exp(-90*t):d=0.42:s=44100" \
  -af "lowpass=f=1600,volume=1.8,aecho=0.8:0.5:30:0.16,alimiter=limit=0.95" \
  "${common[@]}" "$OUT/dao-stamp.mp3"

# 5. Cash — four staggered metallic pings over a small low clunk.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=2400:duration=0.38:sample_rate=44100" \
  -f lavfi -i "sine=frequency=3100:duration=0.32:sample_rate=44100" \
  -f lavfi -i "sine=frequency=3800:duration=0.26:sample_rate=44100" \
  -f lavfi -i "sine=frequency=720:duration=0.16:sample_rate=44100" \
  -filter_complex "[0:a]afade=t=out:st=0.01:d=0.37,volume=0.32[a0];[1:a]afade=t=out:st=0.01:d=0.31,volume=0.26,adelay=70|70[a1];[2:a]afade=t=out:st=0.01:d=0.25,volume=0.20,adelay=145|145[a2];[3:a]afade=t=out:st=0.005:d=0.155,volume=0.28[a3];[a0][a1][a2][a3]amix=inputs=4:duration=longest:normalize=0,volume=16,aecho=0.8:0.6:55:0.24,alimiter=limit=0.95[a]" \
  -map "[a]" "${common[@]}" "$OUT/cash.mp3"

# 6. Page turn — two short paper-noise swishes with a flutter.
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:duration=0.30:sample_rate=44100:amplitude=0.65" \
  -f lavfi -i "anoisesrc=color=pink:duration=0.22:sample_rate=44100:amplitude=0.55" \
  -filter_complex "[0:a]highpass=f=700,lowpass=f=6200,tremolo=f=16:d=0.25,afade=t=in:st=0:d=0.02,afade=t=out:st=0.04:d=0.26[a0];[1:a]highpass=f=900,lowpass=f=7000,tremolo=f=20:d=0.22,afade=t=in:st=0:d=0.01,afade=t=out:st=0.03:d=0.19,adelay=105|105[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0,volume=9,aecho=0.8:0.5:24:0.14,alimiter=limit=0.95[a]" \
  -map "[a]" "${common[@]}" "$OUT/page-turn.mp3"

printf 'Wrote SFX to %s\n' "$OUT"
ls -l "$OUT"
