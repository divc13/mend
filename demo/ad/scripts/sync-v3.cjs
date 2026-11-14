#!/usr/bin/env node
/**
 * Copy the current ad timeline into src so Remotion can import it statically.
 *
 * v4 is the Liam-voiced 9-scene cut. If it exists it wins; otherwise the v3
 * timeline stays the source of truth so older renders remain reproducible.
 * Audio scripts are intentionally untouched: they own their own timelines.
 *
 * script-v4.json arrives before the voice render finishes, so its scene
 * timings can still be null. In that case this script derives a provisional
 * timeline from the per-scene Liam alignment files (or a word-count estimate
 * as a last resort) and records how it did so in `timingSource`. Re-running
 * once the parent fills the real numbers replaces the provisional values.
 *
 * The capture action log travels with it so the player can derive source
 * trims, playback rates and camera punches from the scripted scene lengths
 * instead of hard-coded v3 seconds.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const candidates = ['script-v4.json', 'script-v3.json'];
const source = candidates.map((file) => path.join(root, file)).find((file) => fs.existsSync(file));
if (!source) {
  console.error(`[mend-ad:v3] no timeline found (looked for ${candidates.join(', ')})`);
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(source, 'utf8'));
const isV4 = path.basename(source) === 'script-v4.json';
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const round = (value) => Math.round(value * 100) / 100;

const ESTIMATE_WPM = 165;
const estimateSeconds = (text) => {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return round((words / ESTIMATE_WPM) * 60 + 0.25);
};

const alignmentSeconds = (scene) => {
  if (!isV4) return null;
  const file = path.join(root, 'public/audio/v4/vo', `${scene.id}.timestamps.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ends = payload?.alignment?.character_end_times_seconds;
    const last = Array.isArray(ends) ? ends[ends.length - 1] : null;
    return typeof last === 'number' && Number.isFinite(last) ? round(last + 0.25) : null;
  } catch {
    return null;
  }
};

let timingSource = isV4 ? 'script-v4' : 'script-v3';
const complete = script.scenes.every(
  (scene) => num(scene.start) !== null && num(scene.sceneDuration) !== null && num(scene.duration) !== null,
) && num(script.durationSeconds) !== null;

if (!complete) {
  let cursor = 0;
  let usedAudio = false;
  let usedEstimate = false;
  script.scenes = script.scenes.map((scene) => {
    const handoff = num(scene.handoff) ?? num(scene.gap) ?? 0.45;
    const aligned = alignmentSeconds(scene);
    const voDuration = num(scene.duration) ?? aligned ?? estimateSeconds(scene.vo);
    if (aligned !== null) usedAudio = true;
    if (aligned === null && num(scene.duration) === null) usedEstimate = true;
    const sceneDuration = num(scene.sceneDuration) ?? round(voDuration + handoff);
    const start = round(cursor);
    cursor = round(cursor + sceneDuration);
    return {
      ...scene,
      start,
      duration: voDuration,
      voDuration,
      handoff,
      gap: num(scene.gap) ?? handoff,
      sceneDuration,
    };
  });
  script.durationSeconds = round(cursor);
  timingSource = usedAudio ? 'derived-v4-audio' : usedEstimate ? 'derived-v4-estimate' : 'derived-v4';
} else {
  script.scenes = script.scenes.map((scene) => ({
    ...scene,
    voDuration: num(scene.voDuration) ?? num(scene.duration) ?? 0,
    gap: num(scene.gap) ?? num(scene.handoff) ?? 0.45,
    handoff: num(scene.handoff) ?? num(scene.gap) ?? 0.45,
  }));
}
script.timingSource = timingSource;

const target = path.join(root, 'src/v3/script.generated.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(script, null, 2)}\n`);

const actionsPath = path.join(root, 'public/assets/live/actions.json');
const clipsTarget = path.join(root, 'src/v3/lib/source-clips.generated.json');
if (fs.existsSync(actionsPath)) {
  const capture = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
  const clips = Object.fromEntries(
    Object.entries(capture.clips || {}).map(([id, clip]) => [
      id,
      {
        id,
        durationMs: clip.durationMs ?? 0,
        actions: (clip.actions || []).map((action) => ({
          atMs: action.atMs,
          action: action.action,
          ok: Boolean(action.ok),
        })),
      },
    ]),
  );
  fs.writeFileSync(clipsTarget, `${JSON.stringify({ generatedAt: capture.generatedAt, clips }, null, 2)}\n`);
} else {
  console.warn('[mend-ad:v3] no public/assets/live/actions.json; keeping existing clip metadata');
}

const seconds = Math.round(script.durationSeconds);
const mm = Math.floor(seconds / 60);
const ss = String(seconds % 60).padStart(2, '0');
console.log(
  `[mend-ad:v3] ${path.basename(source)} (${timingSource}) -> ${script.scenes.length} scenes, ${script.durationSeconds}s (${mm}:${ss})`,
);
