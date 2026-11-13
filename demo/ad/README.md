# MEND 5:00 advertisement

This folder is the Remotion composition for the MEND 5:00 film. The current v2
cut uses `script-v2.json`; the earlier v1 cut uses `script.json`. Change the
relevant JSON, then re-render; no timeline editing is required.

## Final outputs

- `out/mend-ad-v2-master.mp4` — current 5:00 v2 master, 1920×1080, 30fps, H.264/AAC, −13.88 LUFS.
- `out/mend-ad-v2-thumbnail.png` — v2 thumbnail.
- `out/mend-ad-v2-contact-sheet.png` — v2 scene contact sheet.
- `out/mend-ad-v2.srt`, `out/mend-ad-v2.vtt` — v2 captions.
- `out/mend-ad-v2-silent.mp4` — v2 silent picture lock.
- v1 history: `out/mend-ad-5min.mp4`, `out/mend-ad-thumbnail.png`, `out/mend-ad.srt`, `out/mend-ad.vtt`, `out/mend-ad-silent.mp4`.

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

## v2 live cut (current)

The v2 film is `MendAdV2` and is built from:

- `script-v2.json` — faster 5:00 timeline; reuses the v1 George VO lines with J-cut offsets.
- `public/audio/v2/voice-timeline.json` and `cue-sheet.json` — word-level cues from the existing v1 ElevenLabs timestamps.
- `public/assets/live/*.mp4` — real app interactions: report, steward award, bid reveal, inspector accept, passport and `/how-it-works`.
- `src/characters/*` — paper-cut Sam, stick-figure council/bidders/contractor/inspector/neighbor.
- `src/v2/*` — v2 composition, scenes and cue helpers.

Render v2:

```bash
node demo/ad/scripts/sync-v2.cjs
node scripts/demo/render-v2.mjs
# -> demo/ad/out/mend-ad-v2-master.mp4
```

Capture live app clips:

```bash
node scripts/demo/stage-pothole-case.mjs BIDDING
node scripts/demo/capture-live-ad.mjs
```

The capture script stages `WO-PATH-001-0002` through `BIDDING`,
`COMPLETION_SUBMITTED` and `CLOSED` so the steward award, bid reveal, inspector
accept and passport are real app interactions at capture time. No runtime
`?demo=` flag is used.

The final v2 audio mix uses the existing v1 George VO because the ElevenLabs
free tier returned HTTP 401 `detected_unusual_activity` for v2 synthesis. The
voice is labelled in `public/audio/v2/voice-selection.json`; do not claim a new
v2 voice take.

The end card QR is a placeholder until `siteUrl` is set in `script-v2.json` and
the close scene is re-rendered.
