#!/usr/bin/env node
/**
 * Rebuild the v4 scene starts from the actual Liam MP3 durations.
 *
 * The generator normally does this after synthesis. This utility is the safe
 * recovery path when synthesis succeeds but a later cue-map validation fails:
 * it never calls ElevenLabs and never touches the audio. Handoffs come from the
 * script, so the 0.45 s section breaths and 1.2 s close tail stay intact.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const AD = path.join(ROOT, 'demo/ad');
const scriptPath = path.join(AD, 'script-v4.json');
const timelinePath = path.join(AD, 'public/audio/v4/voice-timeline.json');
const selectionPath = path.join(AD, 'public/audio/v4/voice-selection.json');
const voDir = path.join(AD, 'public/audio/v4/vo');

if (!ffmpegPath) throw new Error('ffmpeg-static missing');
const round = (value) => Number(value.toFixed(3));
const durationOf = (file) => {
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = `${probe.stderr}${probe.stdout}`.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`could not read audio duration: ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

const script = JSON.parse(readFileSync(scriptPath, 'utf8'));
const timelineExisting = JSON.parse(readFileSync(timelinePath, 'utf8'));
let cursor = 0;
const timelineScenes = [];

for (const scene of script.scenes) {
  const file = path.join(voDir, `${scene.id}.mp3`);
  const duration = round(durationOf(file));
  const handoff = round(scene.handoff ?? scene.gap ?? 0.45);
  const start = round(cursor);
  const sceneDuration = round(duration + handoff);
  const end = round(start + sceneDuration);
  const voOffset = Number(scene.voOffset ?? 0);
  const words = scene.vo.trim().split(/\s+/).filter(Boolean).length;
  scene.start = start;
  scene.duration = duration;
  scene.voDuration = duration;
  scene.sceneDuration = sceneDuration;
  scene.gap = handoff;
  timelineScenes.push({
    id: scene.id,
    chapter: scene.chapter,
    start,
    duration,
    sceneDuration,
    end,
    voOffset,
    voStart: round(start + voOffset),
    voEnd: round(start + voOffset + duration),
    voDuration: duration,
    handoff,
    words,
    wordsPerMinute: round((words / duration) * 60, 1),
    vo: scene.vo,
    caption: scene.caption,
  });
  cursor = end;
}

const total = round(cursor);
script.durationSeconds = total;
writeFileSync(scriptPath, `${JSON.stringify(script, null, 2)}\n`);

const timeline = {
  ...timelineExisting,
  version: 4,
  generatedAt: new Date().toISOString(),
  runtimeSeconds: total,
  timingModel: {
    sceneStart: 'absolute seconds from script-v4.json',
    voStart: 'scene.start + scene.voOffset (0 = no J-cut)',
    wordAbsolute: 'voStart + word.start',
    handoff: 'sceneDuration = audio duration + 0.45s (close + 1.2s)',
  },
  scenes: timelineScenes,
};
writeFileSync(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`);

const selection = JSON.parse(readFileSync(selectionPath, 'utf8'));
selection.scenes = timelineScenes.map((scene) => ({
  id: scene.id,
  characters: script.scenes.find((item) => item.id === scene.id).vo.length,
  words: scene.words,
  duration_seconds: scene.duration,
  scene_duration: scene.sceneDuration,
  start: scene.start,
  end: scene.end,
}));
selection.character_usage = {
  ...selection.character_usage,
  characters_planned: script.scenes.reduce((sum, scene) => sum + scene.vo.length, 0),
};
selection.render = {
  ...selection.render,
  generated_at: new Date().toISOString(),
  note: 'Timing rebuilt from actual Liam MP3 durations after synthesis; no audio regenerated.',
};
writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`);

console.log(`script-v4: ${script.scenes.length} scenes, ${total}s`);
for (const scene of timelineScenes) {
  console.log(
    `${scene.id.padEnd(8)} start ${String(scene.start).padStart(7)}  voice ${scene.duration.toFixed(2)}  scene ${scene.sceneDuration.toFixed(2)}`,
  );
}
