#!/usr/bin/env node
/**
 * Build the final audio mix and mux it onto the silent Remotion render.
 *
 * Usage:
 *   node scripts/demo/build-audio-mix.mjs --video demo/ad/out/mend-ad-silent.mp4
 *
 * Requires:
 *   demo/ad/script.json
 *   demo/ad/public/audio/vo/<scene>.mp3
 *   demo/ad/public/audio/music/music-1.mp3 (or music-2)
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const AD = path.join(ROOT, 'demo/ad');
const OUT = path.join(AD, 'out');
const script = JSON.parse(readFileSync(path.join(AD, 'script.json'), 'utf8'));
const args = process.argv.slice(2);
const videoArg = args.includes('--video') ? args[args.indexOf('--video') + 1] : path.join(OUT, 'mend-ad-silent.mp4');
const cut = args.includes('--cut') ? args[args.indexOf('--cut') + 1] : 'master';
const scenes = script.scenes.filter((s) => (script.cuts?.[cut] ?? script.cuts.master).includes(s.id));
const total = Math.max(...scenes.map((s) => s.start + s.duration));

if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary');
if (!existsSync(videoArg)) throw new Error(`silent video not found: ${videoArg}`);

const musicCandidates = ['music-1.mp3', 'music-2.mp3'].map((f) => path.join(AD, 'public/audio/music', f));
const music = musicCandidates.find((f) => existsSync(f));
if (!music) throw new Error('no music file found; run the ElevenLabs music generator or add a licensed track');

const vo = scenes.map((s) => ({ scene: s, file: path.join(AD, 'public/audio/vo', `${s.id}.mp3`) }));
const missing = vo.filter((v) => !existsSync(v.file));
if (missing.length) throw new Error(`missing VO: ${missing.map((m) => m.scene.id).join(', ')}`);

await mkdir(OUT, { recursive: true });

const inputs = [];
const filters = [];
let inputIndex = 1; // music is input 0
for (const { scene, file } of vo) {
  inputs.push('-i', file);
  const idx = inputIndex++;
  const delay = Math.round(scene.start * 1000);
  filters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${delay}|${delay}[vo${idx}]`);
}
const voLabels = vo.map((_, i) => `[vo${i + 1}]`).join('');
filters.push(`${voLabels}amix=inputs=${vo.length}:normalize=0:duration=longest,asplit=2[voSide][voMix]`);
filters.push(`[0:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.22[music]`);
filters.push(`[music][voSide]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=500[ducked]`);
filters.push(`[voMix][ducked]amix=inputs=2:normalize=0:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, total - 4)}:d=4,alimiter=limit=0.95,loudnorm=I=-14:TP=-1:LRA=11,apad=whole_dur=${total}[aout]`);

const mixPath = path.join(OUT, 'mix.m4a');
const mix = spawnSync(
  ffmpegPath,
  [
    '-y',
    '-stream_loop', '-1', '-i', music,
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[aout]',
    '-t', String(total),
    '-ar', '48000',
    '-c:a', 'aac',
    '-b:a', '320k',
    mixPath,
  ],
  { stdio: 'inherit' },
);
if (mix.status !== 0) throw new Error(`audio mix failed (${mix.status})`);

const finalPath = path.join(OUT, `mend-ad-${cut}.mp4`);
const mux = spawnSync(
  ffmpegPath,
  [
    '-y',
    '-i', videoArg,
    '-i', mixPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-ar', '48000',
    '-b:a', '320k',
    '-shortest',
    '-movflags', '+faststart',
    finalPath,
  ],
  { stdio: 'inherit' },
);
if (mux.status !== 0) throw new Error(`mux failed (${mux.status})`);
console.log(`final: ${finalPath}`);
console.log(`duration: ${total}s; cut: ${cut}; music: ${path.basename(music)}`);
