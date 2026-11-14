#!/usr/bin/env node
/**
 * Build a tight v3 narration bed from the existing v1 George VO.
 *
 * ElevenLabs v2 synthesis is blocked on the free tier (HTTP 401), so v3 keeps
 * the proven v1 voice but trims leading/trailing silence and runs the lines
 * back-to-back with a short air gap. The resulting scene starts are written to
 * demo/ad/script-v3.json for Remotion.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const AD = path.join(ROOT, 'demo/ad');
const V1 = path.join(AD, 'public/audio/vo');
const OUT = path.join(AD, 'public/audio/v3');
const TMP = path.join(OUT, '.trim');
const ORDER = ['hook', 'report', 'dao', 'bids', 'repair', 'payment', 'passport', 'tech', 'close'];
const GAP = 0.12;
const TAIL = 0.25;

function run(args, options = {}) {
  const result = spawnSync(ffmpegPath, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr?.slice(-1200) ?? result.status}`);
  }
  return result;
}

function audioDuration(file) {
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = (result.stderr || '').match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) throw new Error(`could not read duration: ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

await mkdir(TMP, { recursive: true });
const v2 = JSON.parse(readFileSync(path.join(AD, 'script-v2.json'), 'utf8'));
const source = Object.fromEntries(v2.scenes.map((scene) => [scene.id, scene]));
const STACK = {
  hook: [
    { name: 'Next.js + React', purpose: 'walletless resident client' },
  ],
  report: [
    { name: 'Next.js + React', purpose: 'report flow, no wallet' },
    { name: 'Browser EXIF', purpose: 'GPS + metadata stripped before upload' },
    { name: 'Fastify + Postgres', purpose: 'duplicate merge, one case ledger' },
    { name: 'NEAR AI', purpose: 'private triage; no payment authority' },
  ],
  dao: [
    { name: 'Sputnik DAO', purpose: '2-of-3 human scope approval' },
    { name: 'NEAR AI', purpose: 'advice only; cannot move money' },
  ],
  bids: [
    { name: 'Deterministic scoring', purpose: 'policy hash; no LLM picks the winner' },
    { name: 'Rust on NEAR', purpose: 'escrow holds the budget' },
  ],
  repair: [
    { name: 'Human inspector', purpose: 'checklist + evidence signature' },
    { name: 'Rust on NEAR', purpose: 'payment waits for acceptance' },
  ],
  payment: [
    { name: 'Rust escrow on NEAR', purpose: '100 funded → 20 refund / 72 pay / 8 holdback' },
  ],
  passport: [
    { name: 'Fastify + Postgres', purpose: 'same work order, one durable history' },
    { name: 'NEAR passport', purpose: 'repair attached to the asset' },
  ],
  tech: [
    { name: 'Next.js + React', purpose: 'walletless client' },
    { name: 'Fastify', purpose: 'API + authorization' },
    { name: 'Postgres', purpose: 'case + timeline state' },
    { name: 'Rust on NEAR', purpose: 'escrow + policy' },
    { name: 'Sputnik DAO', purpose: '2-of-3 approval' },
    { name: 'NEAR AI', purpose: 'private triage' },
    { name: 'OutLayer', purpose: 'deterministic scorer + receipt' },
    { name: '1Click', purpose: 'cross-chain quote / sponsorship' },
    { name: 'Agent Market', purpose: 'evidence review (self-hire disclosed)' },
    { name: 'NEP-366 relayer', purpose: 'gasless actions' },
  ],

  close: [
    { name: 'MEND', purpose: 'maintenance with memory' },
  ],
};


const segments = [];
const timeline = [];
let cursor = 0;

for (const id of ORDER) {
  const input = path.join(V1, `${id}.mp3`);
  if (!existsSync(input)) throw new Error(`missing v1 VO: ${input}`);
  const trimmed = path.join(TMP, `${id}.wav`);
  // Trim leading/trailing silence only; keep the read's internal phrasing.
  run([
    '-y',
    '-i',
    input,
    '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,aresample=48000,pan=stereo|c0=c0|c1=c1',
    '-c:a',
    'pcm_s16le',
    trimmed,
  ]);
  const duration = Number(audioDuration(trimmed).toFixed(3));
  const start = Number(cursor.toFixed(3));
  const scene = source[id];
  timeline.push({
    id,
    start,
    duration,
    voDuration: duration,
    gap: GAP,
    vo: scene.vo,
    caption: scene.caption,
    stack: STACK[id],
  });
  segments.push(trimmed);
  // Add a tiny air gap after every line except the last; the last gets TAIL.
  const gap = id === ORDER.at(-1) ? TAIL : GAP;
  const silence = path.join(TMP, `${id}-gap.wav`);
  run(['-y', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(gap), '-c:a', 'pcm_s16le', silence]);
  segments.push(silence);
  cursor += duration + gap;
}

const total = Number(cursor.toFixed(3));

// Scene duration includes the small air gap to the next line; the voice
// timeline keeps the pure spoken duration.
for (let index = 0; index < timeline.length; index += 1) {
  const next = timeline[index + 1];
  timeline[index].sceneDuration = Number(
    ((next ? next.start : total) - timeline[index].start).toFixed(3),
  );
}


const list = path.join(TMP, 'concat.txt');
await writeFile(list, segments.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
const voice = path.join(OUT, 'voice-v3.mp3');
run([
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  list,
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'libmp3lame',
  '-b:a',
  '192k',
  voice,
]);

const script = {
  version: 3,
  title: 'MEND — live proof, no slides',
  fps: 30,
  width: 1920,
  height: 1080,
  siteUrl: '',
  durationSeconds: total,
  voice: {
    name: 'George',
    source: 'v1 ElevenLabs render',
    track: 'public/audio/v3/voice-v3.mp3',
    note: 'v1 lines trimmed and concatenated; v2 synthesis blocked with HTTP 401.',
  },
  scenes: timeline,
  cuts: { master: timeline.map((scene) => scene.id) },
};
await writeFile(path.join(AD, 'script-v3.json'), `${JSON.stringify(script, null, 2)}\n`);
await writeFile(path.join(OUT, 'voice-timeline.json'), `${JSON.stringify({ total, scenes: timeline }, null, 2)}\n`);
await rm(TMP, { recursive: true, force: true });
console.log(`voice: ${voice}`);
console.log(`total: ${total}s; scenes: ${timeline.length}`);
for (const scene of timeline) console.log(scene.id, scene.start, scene.duration);

// Per-scene stack callouts are intentionally concise and tied to the proof on
// screen. The names match the stacked architecture in /how-it-works.

