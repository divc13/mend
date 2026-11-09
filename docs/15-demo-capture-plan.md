# 15 — Demo capture plan

The demo was captured from the real integrated web app, not from slides. The
recording is **RECORDED** in `fixtures/demo/captures/mend-replay-demo.mp4`
(91.6 s, H.264, 1920×1080, silent). Narration, captions and real repair media
remain human production steps.

## Current status (2026-11-09)

| Prerequisite | Status | Evidence |
|---|---|---|
| Web app in this worktree | **PRESENT** | `apps/web` integrated on `main`; build passes |
| Playwright module | **PRESENT** | `tests/node_modules/playwright`; E2E 32 passed |
| Playwright CLI | Available | `npm --prefix tests run test:e2e` |
| ffmpeg | Available for capture via `ffmpeg-static` | MP4 produced locally; not a repo dependency |
| REPLAY fixtures/UI | **PRESENT** | Demo room with 9 scenarios; mode badge verified |
| Recording | **RECORDED** | `mend-replay-demo.mp4`, 5 scenarios, manifest |
| Narration / captions | **PENDING (human)** | Silent recording only |
| Real repair media | **BLOCKED_ON_HUMAN** | No repair performed; no consent |

The harness is deliberately fail-soft: it reports `PENDING` with a reason instead
of producing a fake recording.

```text
$ node scripts/demo/capture-replay-demo.mjs
MEND REPLAY capture harness
STATUS: PENDING
Reason: playwright module is not installed in this repository.
- require/import of "playwright" failed from <repository-root>
- The CLI may be available via npx cache, but the recording harness needs the module.
ffmpeg for MP4 conversion: MISSING
No recording was produced. Merge the web app, install Playwright, then rerun.
```

The output above is the real command output with the repository path abbreviated;
it is not a simulated transcript.

## What the harness does

[`scripts/demo/capture-replay-demo.mjs`](../scripts/demo/capture-replay-demo.mjs):

1. Checks whether the `playwright` module can be imported.
2. Checks whether `BASE_URL` responds.
3. Refuses to record if the page does not show `REPLAY / SIMULATION`.
4. Launches Chromium at 1920×1080 with video recording enabled.
5. Walks the configured REPLAY scenarios using stable `data-testid` selectors.
6. Captures screenshots at scene boundaries.
7. Writes a `capture-manifest.json` with the URL, timestamps, checks and video path.
8. Never inserts a transaction link, quote ID or claim that was not on screen.

It does **not** add narration, music, captions or a fake repair clip. Those are
edited separately from the script in [13 — Demo script](./13-demo-script.md).

## Usage (after integration)

```bash
# Requires the integrated web app and a resolvable playwright dependency.
BASE_URL=http://localhost:3000 \
OUT_DIR=fixtures/demo/captures \
SCENARIOS=successful-repair,failed-durability,prompt-injection,sponsorship-uncertainty,judge-replay \
node scripts/demo/capture-replay-demo.mjs
```

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Integrated web app |
| `OUT_DIR` | `fixtures/demo/captures` | Video and manifest output (git-ignored unless approved) |
| `SCENARIOS` | all five | Comma-separated REPLAY scenarios |
| `CAPTURE_SECONDS` | `90` | Maximum continuous capture length |
| `HEADLESS` | `true` | Set `false` to watch the run |

Do not commit large video files unless the repository policy allows it. The demo
video is a submission artifact, not source code.

## UI selector contract

The harness assumes these stable hooks. The Frontend track should either implement
them or update this contract and the harness together.

| Hook | Expected |
|---|---|
| `[data-testid="mode-badge"]` | Visible text includes `REPLAY / SIMULATION` |
| `[data-testid="scenario-successful-repair"]` | Scenario A button |
| `[data-testid="scenario-failed-durability"]` | Scenario B button |
| `[data-testid="scenario-prompt-injection"]` | Scenario C button |
| `[data-testid="scenario-sponsorship-uncertainty"]` | Scenario D button |
| `[data-testid="scenario-judge-replay"]` | Scenario E button |
| `[data-testid="case-timeline"]` | Case timeline container |
| `[data-testid="payment-split"]` | Visible `72` / `8` split |
| `[data-testid="warranty-state"]` | Visible `WARRANTY_REOPENED` or equivalent |
| `[data-testid="passport"]` | Asset passport container |

If the app cannot provide these hooks, update both the contract and the harness
before recording. Do not paper over a missing state with an edited screenshot.

## Recording flow

1. Start the integrated local stack in `REPLAY` mode.
2. Confirm the mode badge is visible on every page.
3. Run `node scripts/demo/check-docs.mjs` before capture.
4. Run the harness with the five scenarios.
5. Watch the raw recording; confirm there is no live transaction link and no
   private data in frame.
6. Record narration separately from the script.
7. Add captions from the `.vtt` in [13 — Demo script](./13-demo-script.md).
8. Insert only real transaction links; otherwise keep replay labels.
9. Human review the final cut against
   [12 — Evidence package](./12-real-world-evidence-package.md).
10. Publish only after explicit human approval.

## Video specification

| Property | Target |
|---|---|
| Resolution | 1920×1080 |
| Frame rate | 30 fps |
| Video codec | H.264, `yuv420p` for compatibility |
| Audio | AAC, 48 kHz stereo; narration clear above music |
| Container | `.mp4` |
| Captions | Burned in **and** a separate `.vtt` |
| Loudness | Narration roughly −16 LUFS integrated; music lower |
| Length | 90 seconds target |

The browser records WebM. Conversion to the delivery MP4 requires ffmpeg, which is
**not installed** in this environment. The conversion commands are intentionally
not documented until ffmpeg is available and the exact pipeline is tested. The
required operations are:

- transcode video to H.264 with `yuv420p`;
- encode narration/music to AAC;
- set `faststart` for web playback;
- either burn captions or mux the `.vtt` track;
- verify duration, resolution, audio and caption sync.

Document the dependency as `ffmpeg` and verify it in CI or the production
environment before claiming the video is ready.

## Audio and narration

- Record narration with a real human voice or a licensed synthetic voice that is
  disclosed.
- Do not clone a person’s voice without consent.
- Keep the music bed licensed for the intended publication.
- Provide a transcript for accessibility and review.

## Physical repair media

The harness only records the software. The repair clip comes from
[12 — Real-world evidence package](./12-real-world-evidence-package.md). If no
repair has been performed, use the honest title card
`REPAIR MEDIA NOT YET COLLECTED`; do not substitute unrelated stock footage.

## Capture manifest

The harness writes a manifest with:

```json
{
  "status": "RECORDED",
  "mode": "REPLAY / SIMULATION",
  "baseUrl": "http://localhost:3000",
  "startedAt": "<ISO timestamp>",
  "scenarios": ["successful-repair"],
  "checks": ["mode badge visible", "no live transaction link"],
  "video": "fixtures/demo/captures/<file>.webm",
  "notes": "No narration, music or physical media."
}
```

The manifest is evidence about the capture, not about the physical repair.

## Failure handling

| Failure | Action |
|---|---|
| Playwright missing | Report `PENDING`; add the dependency or use a documented manual capture |
| Web app unreachable | Report `PENDING`; do not record another site |
| Mode badge missing | Abort; the recording would be dishonest |
| Scenario button missing | Abort and update the selector contract |
| ffmpeg missing | Keep the WebM; report the conversion dependency; do not claim an MP4 exists |
| Repair media missing | Use the honest “not collected” card |

## Acceptance checklist

- [ ] Web app is integrated and reachable.
- [ ] Playwright is a pinned project dependency.
- [ ] Mode badge is visible in every frame.
- [ ] All five REPLAY scenarios run.
- [ ] No live transaction link appears in REPLAY.
- [ ] Narration matches the 90-second script.
- [ ] Captions are burned in and provided as `.vtt`.
- [ ] ffmpeg is installed and the MP4 is verified.
- [ ] Repair media is real or labelled staged.
- [ ] A human reviews the final cut.

## Related documents

- [13 — Demo script](./13-demo-script.md)
- [12 — Evidence package](./12-real-world-evidence-package.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)
- [Capture harness](../scripts/demo/capture-replay-demo.mjs)

---

[Docs index](./README.md) · [← Submission package](./14-submission-package.md) · [Next: integration evidence →](./16-integration-evidence.md)
