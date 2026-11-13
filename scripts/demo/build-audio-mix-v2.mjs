#!/usr/bin/env node
/**
 * Build the v2 audio mix (VO + music + SFX) and mux it onto the silent v2 render.
 *
 * Usage:
 *   node scripts/demo/build-audio-mix-v2.mjs --video demo/ad/out/mend-ad-v2-silent.mp4
 *
 * Reads:
 *   demo/ad/script-v2.json
 *   demo/ad/public/audio/v2/vo/<scene>.mp3
 *   demo/ad/public/audio/v2/cue-sheet.json (optional)
 *   demo/ad/public/audio/v2/sfx-manifest.json (optional)
 *   demo/ad/public/audio/music/music-1.mp3
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
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const scriptPath = path.resolve(ROOT, arg('script', 'demo/ad/script-v2.json'));
const videoArg = path.resolve(ROOT, arg('video', 'demo/ad/out/mend-ad-v2-silent.mp4'));
const cut = arg('cut', 'master');
const script = JSON.parse(readFileSync(scriptPath, 'utf8'));
const scenes = script.scenes.filter((s) => (script.cuts?.[cut] ?? script.cuts.master).includes(s.id));
const total = Math.max(...scenes.map((s) => s.start + s.duration));
const music = path.join(AD, 'public/audio/music/music-1.mp3');
if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary');
if (!existsSync(videoArg)) throw new Error(`silent video not found: ${videoArg}`);
if (!existsSync(music)) throw new Error(`music not found: ${music}`);

const vo = scenes.map((scene) => {
  const v2 = path.join(AD, 'public/audio/v2/vo', `${scene.id}.mp3`);
  const v1 = path.join(AD, 'public/audio/vo', `${scene.id}.mp3`);
  return { scene, file: existsSync(v2) ? v2 : v1 };
});
const missing = vo.filter((v) => !existsSync(v.file));
if (missing.length) throw new Error(`missing VO: ${missing.map((m) => m.scene.id).join(', ')}`);

const cueSheetPath = path.join(AD, 'public/audio/v2/cue-sheet.json');
const cueSheet = existsSync(cueSheetPath) ? JSON.parse(readFileSync(cueSheetPath, 'utf8')) : null;
const sfxManifestPath = path.join(AD, 'public/audio/v2/sfx-manifest.json');
const sfxManifest = existsSync(sfxManifestPath) ? JSON.parse(readFileSync(sfxManifestPath, 'utf8')) : null;

const sfxDir = path.join(AD, 'public/audio/v2/sfx');
const sfx = [];
function addSfx(name, at, volume = 0.5) {
  const file = path.join(sfxDir, `${name}.mp3`);
  if (existsSync(file) && Number.isFinite(at) && at >= 0) sfx.push({ file, at, volume, name });
}
if (sfxManifest?.entries) {
  for (const entry of sfxManifest.entries) {
    addSfx(entry.name ?? entry.cue, Number(entry.at ?? entry.time ?? 0), entry.volume ?? 0.5);
  }
} else {
  for (const scene of scenes) addSfx('whoosh', Math.max(0, scene.start - 0.12), 0.35);
  if (cueSheet?.cues) {
    for (const cue of cueSheet.cues) {
      const action = String(cue.action ?? '').toLowerCase();
      const at = Number(cue.at ?? cue.time ?? NaN);
      if (!Number.isFinite(at)) continue;
      if (/photo|shutter|camera/.test(action)) addSfx('shutter', at, 0.7);
      else if (/vote|stamp|authoriz/.test(action)) addSfx('stamp', at, 0.55);
      else if (/cash|payment|pay/.test(action)) addSfx('cash', at, 0.45);
      else if (/page|passport|record/.test(action)) addSfx('page', at, 0.4);
      else if (/reveal|click|award|accept/.test(action)) addSfx('click', at, 0.45);
    }
  }
}

await mkdir(OUT, { recursive: true });
const inputs = ['-stream_loop', '-1', '-i', music];
let nextIndex = 1;
const voFilters = [];
const voLabelList = [];
for (const { scene, file } of vo) {
  inputs.push('-i', file);
  const idx = nextIndex++;
  const at = Math.max(0, (scene.start + (scene.voOffset ?? 0)) * 1000);
  voFilters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(at)}|${Math.round(at)}[vo${idx}]`);
  voLabelList.push(`[vo${idx}]`);
}
const voLabels = voLabelList.join('');
const sfxFilters = [];
const sfxLabelList = [];
for (const item of sfx) {
  inputs.push('-i', item.file);
  const idx = nextIndex++;
  sfxFilters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${item.volume},adelay=${Math.round(item.at * 1000)}|${Math.round(item.at * 1000)}[sfx${idx}]`);
  sfxLabelList.push(`[sfx${idx}]`);
}
const sfxLabels = sfxLabelList.join('');

const filters = [];
filters.push(...voFilters, ...sfxFilters);
filters.push(`${voLabels}amix=inputs=${vo.length}:normalize=0:duration=longest,asplit=2[voSide][voMix]`);
filters.push(`[0:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.20[music]`);
filters.push(`[music][voSide]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=500[ducked]`);
let mixInputs = `[voMix][ducked]`;
let mixCount = 2;
if (sfx.length) {
  filters.push(`${sfxLabels}amix=inputs=${sfx.length}:normalize=0:duration=longest[sfxMix]`);
  mixInputs += '[sfxMix]';
  mixCount += 1;
}
filters.push(`${mixInputs}amix=inputs=${mixCount}:normalize=0:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, total - 4)}:d=4,alimiter=limit=0.95,loudnorm=I=-14:TP=-1:LRA=11,apad=whole_dur=${total}[aout]`);

const mixPath = path.join(OUT, 'mix-v2.m4a');
const mix = spawnSync(
  ffmpegPath,
  ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[aout]', '-t', String(total), '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', mixPath],
  { stdio: 'inherit' },
);
if (mix.status !== 0) throw new Error(`audio mix failed (${mix.status})`);

const finalPath = path.join(OUT, `mend-ad-v2-${cut}.mp4`);
const mux = spawnSync(
  ffmpegPath,
  ['-y', '-i', videoArg, '-i', mixPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-ar', '48000', '-b:a', '320k', '-shortest', '-movflags', '+faststart', finalPath],
  { stdio: 'inherit' },
);
if (mux.status !== 0) throw new Error(`mux failed (${mux.status})`);
console.log(`final: ${finalPath}`);
console.log(`duration: ${total}s; cut: ${cut}; vo: ${vo.length}; sfx: ${sfx.length}`);
