# MEND product pitch (v3)

This folder is the Remotion composition for MEND's demo film. The **current cut is
v3**, a recorded 2:32.40 product pitch. The earlier 5:00 v2 and v1 cuts are kept
as history; see [History](#history).

## Current cut: v3 (2:32.40)

- `out/mend-ad-v3-master.mp4` — v3 master: 1920×1080, 30fps, H.264/AAC,
  48 kHz stereo, 2:32.40, 59 MB. See [Render verification](#render-verification).
- Composition `MendAdV3`, built from `script-v3.json`.
- Full-bleed live app for the whole product tour, with animated paper-cut cast
  dioramas overlaid in the app margins and tech-stack callouts inside each beat (Next.js/React, Fastify/Postgres, NEAR AI, Rust on NEAR, Sputnik DAO,
  OutLayer, 1Click, Agent Market, NEP-366 relayer).
- One continuous voice/music/SFX bed.
- Live interactions: report, steward award, bid reveal, inspector accept,
  payment/accounting, passport and tech.
- Close: paper-cut Sam + stick-figure Neighbor and a labelled QR placeholder.
  The v2 5:00 cast cut remains in the v2 history.

## Render v3

```bash
# from the repository root
npm install
node demo/ad/scripts/sync-v3.cjs          # copy script-v3.json into src/v3
node scripts/demo/render-v3.mjs           # render silent v3 + mux mix-v3.m4a
# -> demo/ad/out/mend-ad-v3-silent.mp4
# -> demo/ad/out/mend-ad-v3-master.mp4
```

`sync-v3.cjs` writes `src/v3/script.generated.json` so Remotion can import the
timeline statically. `render-v3.mjs` renders `MendAdV3` at 1920×1080/30fps, then
calls `scripts/demo/build-audio-mix-v3.mjs` to build and mux the audio bed.

## Capture v3 app clips

The live clips are under `public/assets/live/` (ignored by git). The current v3
cut expects the pothole case to be staged and then captured:

```bash
node scripts/demo/stage-pothole-case.mjs BIDDING
node scripts/demo/capture-live-ad.mjs
node scripts/demo/capture-payment-live.mjs   # app on :3100, case CLOSED
```

`capture-live-ad.mjs` records report, steward award, bid reveal, inspector accept,
passport and tech. `capture-payment-live.mjs` records the CLOSED accounting view
used by the payment beat. The capture scripts drive the real app; no runtime
`?demo=` flag is used. Missing media falls back to a branded placeholder.

## V3 voice: trimmed v1 George, not a new synth

The v3 narration is **not a new voice take**. `scripts/demo/build-v3-voice.mjs`
trims leading/trailing silence from the existing v1 ElevenLabs George lines
(`public/audio/vo/*.mp3`), concatenates them with a 0.12 s air gap and writes
`public/audio/v3/voice-v3.mp3` plus the scene timeline. ElevenLabs v2
synthesis is blocked on the free tier (HTTP 401 `detected_unusual_activity`), so
v3 reuses the proven v1 render. Do not describe it as a new v3 voice.

## Render verification

Final v3 master rendered 2026-11-14:

- Duration 2:32.40 at 1920×1080, 30fps; H.264 video + AAC 48 kHz stereo audio;
  59 MB.
- Loudness `input_i −14.35 LUFS`, true peak `−1.30 dBTP`; no silence gap longer
  than 1.2 s.
- SHA-256
  `9c9b0aae091d06e5b8c1b1df75c0f54fbe208ed517545ab6554d8a558a07a5d5`.

## History

### v2 (5:00, retained)

- `out/mend-ad-v2-master.mp4` — 5:00 v2 master, 1920×1080, 30fps, H.264/AAC.
- `out/mend-ad-v2-thumbnail.png`, `out/mend-ad-v2-thumbnail-1280.jpg`.
- `out/mend-ad-v2-contact-sheet.png`.
- `out/mend-ad-v2.srt`, `out/mend-ad-v2.vtt`.
- `out/mend-ad-v2-silent.mp4`.

Render v2 as history:

```bash
node demo/ad/scripts/sync-v2.cjs
node scripts/demo/render-v2.mjs
```

`script-v2.json` is the slower 5:00 timeline. It also reuses the v1 George VO
lines; see `public/audio/v2/voice-selection.json`. The v2 close uses the
stick-figure cast.

### v1 (5:00, retained)

- `out/mend-ad-5min.mp4`, `out/mend-ad-thumbnail.png`, `out/mend-ad.srt`,
  `out/mend-ad.vtt`, `out/mend-ad-silent.mp4`.

Render v1 with the `MendAd` composition, `script.json` and
`node scripts/demo/build-audio-mix.mjs`.

## Audio

- **Voice (v3):** trimmed/concatenated v1 ElevenLabs George
  (`JBFqnCBsd6RMkjVDRZzb`), not a new synthesis. Source v1 output is 44.1 kHz;
  the v3 bed is 48 kHz.
- **Music:** “Mountains” by Andrew Ev (Mixkit Free License). The licensed
  `music-1.mp3` bed is trimmed to the v3 duration. See
  `public/audio/music-selection.json` and `CREDITS.md`.
- **Mix:** `build-audio-mix-v3.mjs` mixes one continuous voice track, ducked
  music and action SFX, then normalizes to I=−14 LUFS / TP=−1 dBTP, 48 kHz
  stereo AAC. The v3 bed is `out/mix-v3.m4a`.

## Honesty

- The pothole software scenario is `REPLAY / SIMULATION`; the UI says
  `REPLAY DATA · REAL APP`.
- The pothole and repair footage is illustrative Pexels stock footage, not a real
  MEND repair.
- The contracts, DAO vote, AI signature and Agent Market listing shown in the
  tech beat are real testnet/production evidence; the film says so.
- The v3 voice is a trimmed v1 George bed, not a new voice.
- The end-card QR is a placeholder until `siteUrl` is set in `script-v3.json` and
  the close is re-rendered. No hosted demo is claimed.
- No transaction link is invented, no AI approval is claimed, and no city
  adoption is implied.

## Dependencies

- Remotion `4.0.320` (root devDependency)
- `ffmpeg-static` for audio/video processing
- Playwright (from `tests/`) for `scripts/demo/capture-live-ad.mjs` and
  `scripts/demo/capture-payment-live.mjs`

Large media and generated outputs are intentionally not committed; keep them
outside git or upload the final master to YouTube/unlisted.
