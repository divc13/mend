#!/usr/bin/env node
/** Render the v4 Liam cut and mux the new voice/music/SFX bed. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const draft = process.argv.includes('--draft');
const out = path.join(ROOT, draft ? 'demo/ad/out/mend-ad-v4-draft.mp4' : 'demo/ad/out/mend-ad-v4-silent.mp4');

// Always regenerate the Remotion-imported timeline so the render cannot use an
// older script. The sync script prefers script-v4 and retains v3 as fallback.
let result = spawnSync('node', ['demo/ad/scripts/sync-v3.cjs'], { cwd: ROOT, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

const args = [
  'remotion', 'render', 'demo/ad/src/index.ts', 'MendAdV3', out,
  '--concurrency=8', '--codec=h264', '--crf=18', '--pixel-format=yuv420p',
];
if (draft) args.push('--frames=0-149');
result = spawnSync('npx', args, { cwd: ROOT, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
if (!draft) {
  result = spawnSync('node', ['scripts/demo/build-audio-mix-v4.mjs', '--video', out], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`rendered: ${out}`);
