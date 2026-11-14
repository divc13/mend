#!/usr/bin/env node
/**
 * Mix the tight v3 voice bed with continuous music and action SFX, then mux it
 * onto the v3 silent render. The voice is already one continuous track.
 *
 * Audio pass 2 (quality plan):
 *  - voice: 75 Hz high-pass -> gentle 2:1 compression -> +2.5 dB presence @ 3 kHz
 *  - music: Mountains bed at 0.26, lifted to 0.34 under the close card, ducked
 *    3.5:1 / threshold 0.08 / 550 ms release, 2 s music tail fade
 *  - SFX: three transition whooshes, merge pop, bid tick, receipt print, stamp
 *  - master: two-pass loudnorm I=-14 TP=-1.5 LRA=9, then a -1.0 dBFS sample-peak
 *    safety limiter. The script prints the encoded I/LRA/TP after every build.
 *
 * Usage:
 *   node scripts/demo/build-audio-mix-v3.mjs --no-mux
 *   node scripts/demo/build-audio-mix-v3.mjs --test
 *   node scripts/demo/build-audio-mix-v3.mjs
 *   node scripts/demo/build-audio-mix-v3.mjs --video demo/ad/out/mend-ad-v3-draft.mp4 --test
 *
 * --no-mux writes mix-v3.m4a but never touches the master. --test writes
 * mix-v3-test.m4a. The normal path refuses to mux a video that is more than
 * 0.5s shorter than the script, so a short draft can never overwrite the master.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
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
const noMux = args.includes('--no-mux');
const script = JSON.parse(readFileSync(path.join(AD, 'script-v3.json'), 'utf8'));
const total = script.durationSeconds;
const videoArg = path.resolve(ROOT, arg('video', 'demo/ad/out/mend-ad-v3-silent.mp4'));
const voice = path.join(AD, 'public/audio/v3/voice-v3.mp3');
const music = path.join(AD, 'public/audio/music/music-1.mp3');
const sfxDir = path.join(AD, 'public/audio/v2/sfx');
if (!ffmpegPath) throw new Error('ffmpeg-static missing');
if (!existsSync(voice)) throw new Error(`voice bed missing: ${voice}`);
if (!existsSync(music)) throw new Error(`music missing: ${music}`);
await mkdir(OUT, { recursive: true });

const run = (ffmpegArgs, options = {}) => {
  const result = spawnSync(ffmpegPath, ffmpegArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status}): ${result.stderr?.slice(-1600) ?? ''}`);
  }
  return result;
};

const probeDuration = (file) => {
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = `${probe.stderr}${probe.stdout}`.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
};

let videoDuration = null;
if (!test && !noMux) {
  if (!existsSync(videoArg)) throw new Error(`silent video missing: ${videoArg}`);
  videoDuration = probeDuration(videoArg);
  if (videoDuration === null || videoDuration < total - 0.5) {
    throw new Error(
      `refusing to mux ${videoDuration?.toFixed(2) ?? 'unknown'}s video onto a ${total}s mix; ` +
        'wait for the full silent render (use --test for a filter check)',
    );
  }
}

// Two tiny CC0 cues are synthesized here so the v3 audio stays deterministic
// without adding third-party samples. Existing v2 SFX cover stamp/paper/click.
const cueDir = path.join(OUT, '.audio-v3-cues');
await mkdir(cueDir, { recursive: true });
const makeCue = (name, lavfi, filter) => {
  const file = path.join(cueDir, `${name}.wav`);
  run([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', lavfi,
    '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', file,
  ]);
  return file;
};
const mergePop = makeCue(
  'merge-pop',
  // A soft pitch-drop plus a tiny high transient: a "material merge" pop.
  'aevalsrc=0.5*sin(2*PI*(150*t-250*t*t))*exp(-18*t)+0.18*sin(2*PI*1800*t)*exp(-90*t):s=48000:d=0.18',
  'lowpass=f=2600,afade=t=in:st=0:d=0.002,afade=t=out:st=0.08:d=0.10',
);
const bidTick = makeCue(
  'bid-tick',
  // Short two-tone tick for the sealed-bid score reveal.
  'aevalsrc=0.55*sin(2*PI*1500*t)*exp(-80*t)+0.35*sin(2*PI*900*t)*exp(-65*t):s=48000:d=0.09',
  'highpass=f=300,afade=t=in:st=0:d=0.001,afade=t=out:st=0.02:d=0.06',
);

const sfx = [];
const add = (file, at, volume = 0.5, filter = null) => {
  if (existsSync(file) && Number.isFinite(at)) sfx.push({ file, at, volume, filter });
};
const sfxFile = (name) => path.join(sfxDir, `${name}.mp3`);
const sceneAt = Object.fromEntries(script.scenes.map((scene) => [scene.id, scene.start]));

// Only the three biggest hard cuts keep a whoosh: into the live app, into the
// DAO authorization, and into the close card. Every other cut is a clean hard cut.
// Scene starts come from script-v3.json, so the 0.60 s breaths cannot drift the
// whooshes or the prize-card lift off the picture.
for (const at of [sceneAt.report, sceneAt.dao, sceneAt.close]) {
  add(sfxFile('whoosh'), Math.max(0, at - 0.08), 0.30);
}
add(sfxFile('camera-shutter'), 5.9, 0.65);
// Report clicks follow the action table in demo/ad/src/v3/lib/actions.ts:
// photo 11.48, privacy 14.76, duplicate 17.17, submit 26.19.
for (const at of [11.48, 14.76, 17.17, 26.19]) add(sfxFile('ui-click'), at, 0.38);
add(mergePop, 19.28, 0.42);
add(sfxFile('dao-stamp'), sceneAt.dao + 15.8, 0.55);
add(bidTick, sceneAt.bids + 3.12, 0.34);
add(sfxFile('dao-stamp'), sceneAt.repair + 15.0, 0.52);
add(sfxFile('cash'), sceneAt.payment + 1.37, 0.40);
add(sfxFile('page-turn'), sceneAt.passport + 2.84, 0.36);
add(sfxFile('ui-click'), sceneAt.payment + 0.6, 0.4);
add(sfxFile('ui-click'), sceneAt.tech + 1.2, 0.32);
// A trimmed, high-passed page-turn reads as a receipt printer at the tech close.
add(sfxFile('page-turn'), sceneAt.tech + 26.84, 0.42, 'atrim=0:0.30,highpass=f=600,afade=t=out:st=0.18:d=0.12');
add(sfxFile('dao-stamp'), sceneAt.close + 0.91, 0.62);

const inputs = ['-i', voice, '-stream_loop', '-1', '-i', music];
const filters = [];

// Voice: clean the low end, level lightly, add intelligibility presence, then
// hold the v1 George performance at a consistent level. The bed is padded to the
// exact runtime before splitting so the sidechain key never dies at the last word.
filters.push(
  '[0:a]highpass=f=75:poles=2,' +
    'acompressor=threshold=0.1:ratio=2:attack=12:release=220:makeup=1.25:knee=3:detection=rms,' +
    'equalizer=f=3000:width_type=q:width=1.0:g=2.5,' +
    'loudnorm=I=-14.5:TP=-1.5:LRA=7,' +
    'aresample=48000,aformat=channel_layouts=stereo,' +
    `apad=whole_dur=${total},atrim=0:${total},asplit=2[voSide][voMix]`,
);

// Music: 0.26 base, +0.08 lift over the last 3 s before the close card, then a
// full 2 s tail fade. The fade ends exactly at the last frame so the QR card
// holds under music instead of being cut by a short master fade.
const closeLiftEnd = sceneAt.close;
const closeLiftStart = Math.max(0, closeLiftEnd - 3);
const baseMusic = 0.26;
const closeMusic = 0.34;
const musicGain = `${baseMusic}+${(closeMusic - baseMusic).toFixed(2)}*min(max((t-${closeLiftStart})/${(closeLiftEnd - closeLiftStart).toFixed(2)},0),1)`;
filters.push(
  `[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,` +
    `volume='${musicGain}':eval=frame,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[music]`,
);
// Gentle 3.5:1 duck (threshold 0.08, 550 ms release) leaves the bed present
// between sentences instead of pumping it to silence.
filters.push(
  '[music][voSide]sidechaincompress=threshold=0.08:ratio=3.5:attack=20:release=550[ducked]',
);

let next = 2;
const sfxLabels = [];
for (const item of sfx) {
  inputs.push('-i', item.file);
  const idx = next++;
  const ms = Math.round(item.at * 1000);
  const prefix = item.filter ? `${item.filter},` : '';
  filters.push(
    `[${idx}:a]${prefix}aresample=48000,aformat=channel_layouts=stereo,` +
      `volume=${item.volume},adelay=${ms}|${ms}[sfx${idx}]`,
  );
  sfxLabels.push(`[sfx${idx}]`);
}
if (sfxLabels.length) {
  filters.push(
    `${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest[sfxMix]`,
  );
  filters.push(
    `[voMix][ducked][sfxMix]amix=inputs=3:normalize=0:duration=longest,` +
      `afade=t=in:st=0:d=0.12,afade=t=out:st=${(total - 0.03).toFixed(2)}:d=0.03,` +
      `atrim=0:${total}[pre]`,
  );
} else {
  filters.push(
    `[voMix][ducked]amix=inputs=2:normalize=0:duration=longest,` +
      `afade=t=in:st=0:d=0.12,afade=t=out:st=${(total - 0.03).toFixed(2)}:d=0.03,` +
      `atrim=0:${total}[pre]`,
  );
}

const premaster = path.join(cueDir, 'premaster.wav');
run([
  '-y', '-hide_banner', '-loglevel', 'error',
  ...inputs, '-filter_complex', filters.join(';'), '-map', '[pre]',
  '-t', String(total), '-ar', '48000', '-c:a', 'pcm_f32le', premaster,
]);

// Two-pass loudnorm. The premaster is measured once, then normalized linearly;
// the final alimiter is only a true-peak safety catch, not a leveling stage.
const measurement = spawnSync(
  ffmpegPath,
  [
    '-hide_banner', '-nostats', '-i', premaster,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json',
    '-f', 'null', '-',
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (measurement.status !== 0) {
  throw new Error(`loudnorm measurement failed: ${measurement.stderr?.slice(-1200) ?? ''}`);
}
const measurementText = measurement.stderr ?? '';
const jsonStart = measurementText.lastIndexOf('{');
const jsonEnd = measurementText.lastIndexOf('}');
if (jsonStart < 0 || jsonEnd <= jsonStart) {
  throw new Error(`could not read loudnorm JSON: ${measurementText.slice(-1200)}`);
}
const measured = JSON.parse(measurementText.slice(jsonStart, jsonEnd + 1));

const limiterLimit = 0.89; // -1.0 dBFS ceiling; encoded true peak measured -1.3 dBTP
const finalFilter =
  'loudnorm=I=-14:TP=-1.5:LRA=9' +
  `:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}` +
  `:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}` +
  `:offset=${measured.target_offset}:linear=true,` +
  `aresample=48000,aformat=channel_layouts=stereo,` +
  `alimiter=limit=${limiterLimit}:attack=5:release=50:level=0`;

const mix = path.join(OUT, test ? 'mix-v3-test.m4a' : 'mix-v3.m4a');
run([
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', premaster, '-af', finalFilter, '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', mix,
]);

const report = spawnSync(
  ffmpegPath,
  ['-hide_banner', '-nostats', '-i', mix, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const reportText = report.stderr ?? '';
// Only parse the final Summary block; the per-frame lines start at I: -70.
const summary = reportText.slice(reportText.lastIndexOf('Summary:'));
const pick = (label) => summary.match(new RegExp(`${label}\\s*:\\s*(-?[\\d.]+)`))?.[1] ?? '?';
console.log(`mix: ${mix}`);
console.log(`duration: ${total}s; sfx: ${sfx.length}; video: ${videoDuration?.toFixed(2) ?? 'not muxed'}`);
const integrated = Number(pick('I'));
const truePeak = Number(pick('Peak'));
console.log(
  `loudness: I=${pick('I')} LUFS, LRA=${pick('LRA')} LU, TP=${pick('Peak')} dBTP`,
);
console.log(
  `loudnorm input: I=${measured.input_i}, TP=${measured.input_tp}, LRA=${measured.input_lra}`,
);
if (Number.isFinite(truePeak) && truePeak > -1) {
  console.warn(`warning: true peak ${truePeak} dBTP is above the -1.0 dBTP ceiling`);
}
if (Number.isFinite(integrated) && Math.abs(integrated + 14) > 0.3) {
  console.warn(`warning: integrated loudness ${integrated} LUFS is outside -14.3..-13.7`);
}

// The voice bed has 0.60 s of deliberate air between lines; the music must fill
// every one. Fail loudly if any stretch of the finished mix is silent >1.2 s.
const silenceProbe = spawnSync(
  ffmpegPath,
  ['-hide_banner', '-nostats', '-i', mix, '-af', 'silencedetect=n=-50dB:d=1.2', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const silenceHits = (silenceProbe.stderr ?? '').match(/silence_start/g)?.length ?? 0;
console.log(`silence: ${silenceHits} gap(s) over 1.2 s at -50 dB (music must cover breaths)`);
if (silenceHits > 0) {
  console.warn('warning: the mix has a silence longer than 1.2 s; check the music bed');
}

await rm(cueDir, { recursive: true, force: true });
if (test || noMux) {
  console.log(noMux ? 'mix written; master not touched (--no-mux)' : 'mix (test only, not muxed)');
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
