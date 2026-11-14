#!/usr/bin/env node
/** Render the tight v3 pitch and mux the continuous voice/music/SFX bed. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const draft = process.argv.includes('--draft');
const out = path.join(ROOT, draft ? 'demo/ad/out/mend-ad-v3-draft.mp4' : 'demo/ad/out/mend-ad-v3-silent.mp4');
const args = [
  'remotion', 'render', 'demo/ad/src/index.ts', 'MendAdV3', out,
  '--concurrency=8', '--codec=h264', '--crf=18', '--pixel-format=yuv420p',
];
if (draft) args.push('--frames=0-149');
let result = spawnSync('npx', args, { cwd: ROOT, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
if (!draft) {
  result = spawnSync('node', ['scripts/demo/build-audio-mix-v3.mjs', '--video', out], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`rendered: ${out}`);
