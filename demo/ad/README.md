# MEND 5:00 advertisement

This folder is the Remotion composition for the MEND 5:00 film. All copy, scene
timing, voice settings, music prompt and asset paths come from `script.json`.
Change the JSON, then re-render; no timeline editing is required.

## Final outputs

- `out/mend-ad-5min.mp4` — 5:00 master, 1920×1080, 30fps, H.264/AAC, loudness ≈ −14 LUFS.
- `out/mend-ad-thumbnail.png` — 1280×720 thumbnail.
- `out/mend-ad.srt`, `out/mend-ad.vtt` — captions.
- `out/mend-ad-master-fixed.mp4` — same master after the Tech-scene fix (kept for traceability).
- `out/mend-ad-silent.mp4` — silent picture lock used for the final audio mux.

## Quick start

```bash
# from the repository root
npm install
node demo/ad/scripts/sync-assets.cjs
npx remotion compositions demo/ad/src/index.ts
npx remotion studio demo/ad/src/index.ts        # live preview
```

Render the master:

```bash
npx remotion render demo/ad/src/index.ts MendAd demo/ad/out/mend-ad-silent.mp4 \
  --concurrency=4 --codec=h264 --crf=18 --pixel-format=yuv420p
node scripts/demo/build-audio-mix.mjs \
  --video demo/ad/out/mend-ad-silent.mp4 --cut master
```

`build-audio-mix.mjs` writes `out/mix.m4a` and `out/mend-ad-master.mp4`. Copy the
result to `out/mend-ad-5min.mp4` when it is the final picture lock.

## Iterating

- **Narration/timing:** edit `script.json` scenes, then regenerate only changed
  VO lines (see `public/audio/voice-selection.json` for the selected voice).
- **Visuals:** edit `src/scenes/*` or `src/components/*`; use `npx remotion still`
  at a frame number for a fast check.
- **Assets:** replace files under `public/assets/` and run
  `node demo/ad/scripts/sync-assets.cjs`; the composition checks the manifest and
  falls back to a branded placeholder when an asset is missing.
- **End card URL:** set `siteUrl` in `script.json`; the QR placeholder and
  `DEMO LINK IN DESCRIPTION` copy are generated from it. Re-render only the end
  card/close scene when the hosted URL is ready.
- **Cuts:** `script.json` has `master`, `submission` and `teaser` lists. Register
  more compositions in `src/Root.tsx` if needed.

## Audio

- Voice: ElevenLabs, George (`JBFqnCBsd6RMkjVDRZzb`), `eleven_multilingual_v2`,
  generated with timestamps. The account is on the Free tier, so output is
  44.1 kHz/128 kbps MP3; the final mix is resampled to 48 kHz.
- Music: “Mountains” by Andrew Ev (Mixkit Free License). ElevenLabs Music was
  unavailable on the free plan (HTTP 402 `paid_plan_required`); the licensed
  Mixkit fallback is used instead. See `public/audio/music-selection.json` and
  `CREDITS.md`.
- Final loudness: −13.8 LUFS integrated, true peak −0.8 dBFS.

## Honesty

- The pothole software scenario is `REPLAY / SIMULATION`.
- The pothole and repair footage is illustrative Pexels stock footage.
- The contracts, DAO vote, AI signature and Agent Market listing shown in the
  tech scene are real testnet/production evidence; the end card says so.
- No transaction link is invented, no AI approval is claimed, and no city
  adoption is implied.

## Dependencies

- Remotion `4.0.320` (root devDependency)
- `ffmpeg-static` for audio/video processing
- Playwright (from `tests/`) for `scripts/demo/capture-ad.mjs`

Large media and generated outputs are intentionally not committed; keep them
outside git or upload the final master to YouTube/unlisted.
