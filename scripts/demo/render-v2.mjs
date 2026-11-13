#!/usr/bin/env node
/**
 * Render the v2 film and mux the v2 audio mix.
 *
 *   node scripts/demo/render-v2.mjs --draft
 *   node scripts/demo/render-v2.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const draft = args.includes('--draft');
const composition = args.includes('--composition') ? args[args.indexOf('--composition') + 1] : 'MendAdV2';
const out = path.join(ROOT, draft ? 'demo/ad/out/mend-ad-v2-draft.mp4' : 'demo/ad/out/mend-ad-v2-silent.mp4');
const renderArgs = [
  'remotion',
  'render',
  'demo/ad/src/index.ts',
  composition,
  out,
  '--concurrency=4',
  '--codec=h264',
  '--crf=18',
  '--pixel-format=yuv420p',
];
if (draft) renderArgs.push('--frames=0-149');
const render = spawnSync('npx', renderArgs, { cwd: ROOT, stdio: 'inherit' });
if (render.status !== 0) process.exit(render.status ?? 1);
if (!draft) {
  const mix = spawnSync('node', ['scripts/demo/build-audio-mix-v2.mjs', '--video', out], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (mix.status !== 0) process.exit(mix.status ?? 1);
}
console.log(`rendered: ${out}`);
