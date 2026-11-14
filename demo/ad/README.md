# MEND product pitch (v4)

This folder is the Remotion composition for MEND's demo film. The **current cut is
v4**, a recorded 3:33.57 product pitch with a new Liam narration. The 2:37 v3
master is retained as a fallback; earlier v2 and v1 cuts are kept as history.

## Current cut: v4 (3:33.57)

- `out/mend-ad-v4-master.mp4` — v4 master: 1920×1080, 30fps, H.264/AAC,
  48 kHz stereo, 3:33.57, 61 MB. See [Render verification](#render-verification).
- Composition `MendAdV3` renders the v4 timeline from `script-v4.json`.
- Full-bleed live app for the whole product tour, with animated paper-cut cast
  dioramas overlaid in the app margins and tech-stack callouts inside each beat
  (Next.js/React, Fastify/Postgres, NEAR AI, Rust escrow, Sputnik DAO, OutLayer,
  1Click, Agent Market, NEP-366 relayer, 42 testnet tx).
- One continuous Liam voice/music/SFX bed, with 0.45 s music-only section
  handoffs and a 1.2 s close tail.
- Live interactions: report, steward award, bid reveal, inspector accept,
  payment/accounting, passport and tech.
- Close: paper-cut Sam + stick-figure Neighbor and a **real QR to
  https://mend-demo.vercel.app**.

## Render v4

```bash
# from the repository root
npm install
node demo/ad/scripts/sync-v3.cjs          # prefers script-v4.json
node scripts/demo/render-v4.mjs           # render silent v4 + mux mix-v4.m4a
# -> demo/ad/out/mend-ad-v4-silent.mp4
# -> demo/ad/out/mend-ad-v4-master.mp4
```

`sync-v3.cjs` writes `src/v3/script.generated.json` so Remotion can import the
timeline statically. `render-v4.mjs` renders `MendAdV3` at 1920×1080/30fps, then
calls `scripts/demo/build-audio-mix-v4.mjs` to build and mux the audio bed.
`make-v4-deliverables.mjs` rebuilds captions, thumbnail and contact sheet.

## Capture app clips

The live clips are under `public/assets/live/` (ignored by git). The cut expects
the pothole case to be staged and then captured:

```bash
node scripts/demo/stage-pothole-case.mjs BIDDING
node scripts/demo/capture-live-ad.mjs
node scripts/demo/capture-payment-live.mjs   # app on :3100, case CLOSED
```

`capture-live-ad.mjs` records report, steward award, bid reveal, inspector accept,
passport and tech. `capture-payment-live.mjs` records the CLOSED accounting view
used by the payment beat. The capture scripts drive the real app; no runtime
`?demo=` flag is used. Missing media falls back to a branded placeholder.

## V4 voice: new Liam synthesis

The v4 narration is a **new ElevenLabs synthesis** using **Liam**
(`TX3LPaxmHKxFdv7VOQHJ`), model `eleven_multilingual_v2`, output
`mp3_44100_128`, stability `0.42`, similarity `0.80`, style `0.38`, speaker boost
on and speed `1.0`. `demo/ad/scripts/generate-v4-vo-elevenlabs.mjs` writes nine
scene MP3s and word-alignment timestamps under `public/audio/v4/vo/`;
`scripts/demo/retime-v4-voice.mjs` rebuilds the scene starts from the actual MP3
durations. It is not the v1 George render and must not be labelled as such.

## Render verification

Final v4 master rendered 2026-11-15:

- Duration 3:33.57 at 1920×1080, 30fps; H.264 video + AAC 48 kHz stereo audio;
  61 MB.
- Loudness `input_i −13.9 LUFS`, LRA `2.4 LU`, true peak `−1.4 dBTP`; no silence
  gap longer than 1.2 s; stereo L/R are balanced. Verbatim captions are generated
  from all nine Liam word alignments (48 cues).
- SHA-256
  `080e87b6d93d4a7756e48df8c024cffc51b6253e3601d197c3ba3f2d549bcd7b`.

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

- **Voice (v4):** new ElevenLabs Liam (`TX3LPaxmHKxFdv7VOQHJ`) synthesis at
  44.1 kHz, placed at scripted scene starts and rendered into the 48 kHz bed.
  It is not the v1 George render.
- **Music:** “Mountains” by Andrew Ev (Mixkit Free License). The licensed
  `music-1.mp3` bed is looped/trimmed to the v4 duration. See
  `public/audio/music-selection.json` and `CREDITS.md`.
- **Mix:** `build-audio-mix-v4.mjs` mixes nine Liam lines, ducked music and
  sparse action SFX, then normalizes to I=−14 LUFS / TP=−1.5 dBTP, 48 kHz
  stereo AAC. The v4 bed is `out/mix-v4.m4a`.

## Honesty

- The pothole software scenario is `REPLAY / SIMULATION`; the UI says
  `REPLAY DATA · REAL APP`.
- The pothole and repair footage is illustrative Pexels stock footage, not a real
  MEND repair.
- The contracts, DAO vote, AI signature and Agent Market listing shown in the
  tech beat are real testnet/production evidence; the film says so.
- The v4 voice is a new **Liam** synthesis, not the v1 George render.
- The end-card QR is generated from `siteUrl` in `script-v4.json`; the current
  `siteUrl` is https://mend-demo.vercel.app. Re-render the close only if that URL changes.
- No transaction link is invented, no AI approval is claimed, and no city
  adoption is implied.

## Dependencies

- Remotion `4.0.320` (root devDependency)
- `ffmpeg-static` for audio/video processing
- Playwright (from `tests/`) for `scripts/demo/capture-live-ad.mjs` and
  `scripts/demo/capture-payment-live.mjs`

Large media and generated outputs are intentionally not committed; keep them
outside git or upload the final master to YouTube/unlisted.
