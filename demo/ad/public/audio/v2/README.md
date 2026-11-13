# MEND v2 audio — 5:00 live cut, final v1 George VO

This folder is the v2 audio/timing package. It does not modify the v1 audio in
`demo/ad/public/audio/vo/` or the v1 music bed.

## Final voice

The final voice is the **existing v1 ElevenLabs George render**:

- `demo/ad/public/audio/vo/<scene>.mp3`
- `demo/ad/public/audio/vo/<scene>.timestamps.json`
- Voice: George (`JBFqnCBsd6RMkjVDRZzb`), `eleven_multilingual_v2`, 128 kbps.

The v2 ElevenLabs endpoint is blocked with HTTP 401
`detected_unusual_activity` (Free Tier disabled). No new v2 synthesis was
performed and no ElevenLabs characters were consumed. The macOS placeholder
was removed from the final path.

`demo/ad/public/audio/v2/vo/` contains **byte-identical copies of the v1
George mp3s and v1 timestamps**. The v2 mixer (`build-audio-mix-v2.mjs`)
prefers `v2/vo`, so this mirror guarantees it uses George, not a placeholder.
The source of truth remains `demo/ad/public/audio/vo/`.

## What is here

| Path | Purpose |
| --- | --- |
| `vo/<scene>.mp3` | Nine v1 George copies for the v2 mixer (44.1 kHz, mono, 128 kbps). |
| `vo/<scene>.timestamps.json` | v1 word timing copies. |
| `voice-selection.json` | Final voice, v1 reuse status, blocked-v2 evidence, character usage. |
| `voice-timeline.json` | Every word with relative and absolute times, including J-cut `voOffset`. |
| `cue-sheet.json` | 66 character/live actions mapped to absolute times, with SFX suggestions. |
| `sfx/` | Six short synthesized SFX cues. |
| `sfx/sfx-manifest.json` | Canonical source, license, duration, peak and intended use. |
| `sfx-manifest.json` | Generated compatibility `entries` for `build-audio-mix-v2.mjs`. |

Music is reused, not regenerated:
`demo/ad/public/audio/music/music-1.mp3` (Mixkit Free License).

## Timing model

- Scene starts and durations come from `demo/ad/script-v2.json`.
- Scene `vo` text and word timings are reused from v1.
- `voStart = scene.start + scene.voOffset`.
- Negative `voOffset` (0.3–0.5 s) is a J-cut: the next line starts under the
  previous picture.
- A word's absolute time is `voStart + word.start`.
- A cue's absolute time is `voStart + word.start + cue.offset`.
- `cue-sheet.json` uses numeric absolute `at` (for the v2 audio mixer) and
  keeps the spoken anchor word in `anchor`. It also gives `sceneTime` and
  `voTime` for editing.
- `script-v2.json` sets `visualOffset: 0` for the v2 compositor. The picture
  cut lands on `scene.start`; the voice lead is carried only by the negative
  `voOffset` in the audio mix. This avoids double-shifting the picture and
  keeps `cue-sheet.json` aligned with both picture and audio.
- `sfx-manifest.json` at the v2 root is a generated compatibility file for
  `scripts/demo/build-audio-mix-v2.mjs` (`entries` with `name`/`at`/`volume`).
  The canonical source/license manifest is `sfx/sfx-manifest.json`.

## Rebuild

```bash
# Rebuild timeline, cue sheet and mixer-compatible SFX entries from v1 timestamps
node demo/ad/scripts/build-v2-timeline.mjs

# Verify JSON
node -e "for (const f of ['demo/ad/script-v2.json','demo/ad/public/audio/v2/voice-timeline.json','demo/ad/public/audio/v2/cue-sheet.json','demo/ad/public/audio/v2/voice-selection.json','demo/ad/public/audio/v2/sfx/sfx-manifest.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"
```

If the ElevenLabs account is later unblocked and a fresh v2 read is wanted,
`demo/ad/scripts/generate-v2-vo-elevenlabs.mjs` is available as an optional
path. It is not needed for the current final cut.

The v2 compositor reads `demo/ad/src/v2/script.generated.json` and
`demo/ad/src/v2/cues.generated.json`. Those are produced by
`demo/ad/scripts/sync-v2.cjs`; they are intentionally not modified here. Run
the sync step in the render pipeline so the compositor picks up this script
and cue sheet.

## SFX

All six cues are original synthesis, generated locally with FFmpeg lavfi
(sine tones, filtered noise, envelopes, compression). No Mixkit/Pexels sample
was downloaded or embedded. They are dedicated to the public domain under
CC0 1.0. Regenerate with:

```bash
./demo/ad/scripts/generate-v2-sfx.sh
```

No API key is written to any file in this folder.
