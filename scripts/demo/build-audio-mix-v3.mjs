#!/usr/bin/env node
/**
 * Mix the tight v3 voice bed with continuous music and action SFX, then mux it
 * onto the v3 silent render. The voice is already one continuous track.
 *
 * Usage:
 *   node scripts/demo/build-audio-mix-v3.mjs
 *   node scripts/demo/build-audio-mix-v3.mjs --video demo/ad/out/mend-ad-v3-silent.mp4
 *   node scripts/demo/build-audio-mix-v3.mjs --video demo/ad/out/mend-ad-v3-draft.mp4 --test
 *
 * --test only writes mix-v3-test.m4a. The normal path refuses to mux a video
 * that is more than 0.5s shorter than the script, so a short draft can never
 * overwrite the master.
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
const test = args.includes('--test');
const script = JSON.parse(readFileSync(path.join(AD, 'script-v3.json'), 'utf8'));
const total = script.durationSeconds;
const videoArg = path.resolve(ROOT, arg('video', 'demo/ad/out/mend-ad-v3-silent.mp4'));
const voice = path.join(AD, 'public/audio/v3/voice-v3.mp3');
const music = path.join(AD, 'public/audio/music/music-1.mp3');
const sfxDir = path.join(AD, 'public/audio/v2/sfx');
if (!ffmpegPath) throw new Error('ffmpeg-static missing');
if (!existsSync(videoArg)) throw new Error(`silent video missing: ${videoArg}`);
if (!existsSync(voice)) throw new Error(`voice bed missing: ${voice}`);
if (!existsSync(music)) throw new Error(`music missing: ${music}`);

const probeDuration = (file) => {
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = `${probe.stderr}${probe.stdout}`.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
};
const videoDuration = probeDuration(videoArg);
if (!test && (videoDuration === null || videoDuration < total - 0.5)) {
  throw new Error(
    `refusing to mux ${videoDuration?.toFixed(2) ?? 'unknown'}s video onto a ${total}s mix; ` +
      'wait for the full silent render (use --test for a filter check)',
  );
}
await mkdir(OUT, { recursive: true });

const sfx = [];
const add = (name, at, volume = 0.5) => {
  const file = path.join(sfxDir, `${name}.mp3`);
  if (existsSync(file) && Number.isFinite(at)) sfx.push({ name, at, volume, file });
};
const sceneAt = Object.fromEntries(script.scenes.map((scene) => [scene.id, scene.start]));
for (const scene of script.scenes) add('whoosh', Math.max(0, scene.start - 0.08), 0.24);
add('camera-shutter', 5.9, 0.65);
for (const at of [10.1, 15.0, 21.0, 26.0]) add('ui-click', at, 0.38);
add('dao-stamp', 50.9, 0.55);
add('ui-click', 54.5, 0.45);
add('dao-stamp', 80.9, 0.52);
add('cash', 83.0, 0.40);
add('page-turn', 99.2, 0.36);
add('ui-click', sceneAt.payment + 0.6, 0.4);
add('ui-click', sceneAt.tech + 1.2, 0.32);

const inputs = ['-i', voice, '-stream_loop', '-1', '-i', music];
const filters = [];
// Pad/trim the voice to the exact runtime before splitting: the sidechain needs a
// full-length key or the ducked music dies when the last line ends (the v2 tail bug).
filters.push('[0:a]loudnorm=I=-14.5:TP=-1.5:LRA=7,aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=' + total + ',atrim=0:' + total + ',asplit=2[voSide][voMix]');
// Music keeps playing under the end card; only the final 1.5s fades.
filters.push(`[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.18,afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5[music]`);
filters.push('[music][voSide]sidechaincompress=threshold=0.045:ratio=7:attack=20:release=450[ducked]');
let next = 2;
const sfxLabels = [];
for (const item of sfx) {
  inputs.push('-i', item.file);
  const idx = next++;
  const ms = Math.round(item.at * 1000);
  filters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${item.volume},adelay=${ms}|${ms}[sfx${idx}]`);
  sfxLabels.push(`[sfx${idx}]`);
}
if (sfxLabels.length) {
  filters.push(`${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest[sfxMix]`);
  // The last line runs to ~152.1s, so only a 0.25s master fade is safe. The
  // limiter is pre-loudnorm (with auto-level off) to tame speech peaks and let
  // the -14 LUFS target be reached without pushing true peak over -1 dBTP.
  filters.push(`[voMix][ducked][sfxMix]amix=inputs=3:normalize=0:duration=longest,afade=t=in:st=0:d=0.12,afade=t=out:st=${Math.max(0, total - 0.25)}:d=0.25,alimiter=limit=0.6:level=0,loudnorm=I=-14:TP=-1.5:LRA=9,apad=whole_dur=${total}[aout]`);
} else {
  filters.push(`[voMix][ducked]amix=inputs=2:normalize=0:duration=longest,afade=t=in:st=0:d=0.12,afade=t=out:st=${Math.max(0, total - 0.25)}:d=0.25,alimiter=limit=0.6:level=0,loudnorm=I=-14:TP=-1.5:LRA=9,apad=whole_dur=${total}[aout]`);
}
const mix = path.join(OUT, test ? 'mix-v3-test.m4a' : 'mix-v3.m4a');
const mixResult = spawnSync(ffmpegPath, [
  '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[aout]',
  '-t', String(total), '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', mix,
], { stdio: 'inherit' });
if (mixResult.status !== 0) throw new Error(`audio mix failed (${mixResult.status})`);
if (test) {
  console.log(`mix (test only, not muxed): ${mix}`);
  console.log(`duration: ${total}s; video: ${videoDuration?.toFixed(2)}s; sfx: ${sfx.length}`);
  process.exit(0);
}
const final = path.join(OUT, 'mend-ad-v3-master.mp4');
const mux = spawnSync(ffmpegPath, [
  '-y', '-i', videoArg, '-i', mix, '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-c:a', 'copy',
  '-shortest', '-movflags', '+faststart', final,
], { stdio: 'inherit' });
if (mux.status !== 0) throw new Error(`mux failed (${mux.status})`);
console.log(`final: ${final}`);
console.log(`duration: ${total}s; video: ${videoDuration?.toFixed(2)}s; sfx: ${sfx.length}`);
