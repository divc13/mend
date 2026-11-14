#!/usr/bin/env node
/**
 * Build the v4 Liam voice/music/SFX bed, then mux it onto the v4 silent render.
 *
 * The v4 script has 0.45 s music-only handoffs. Voice lines are placed at their
 * scripted starts instead of concatenated, so a line can be replaced without
 * re-timing the rest of the film. Music is ducked under voice and lifted into
 * the close card. The master is two-pass loudnorm to -14 LUFS / -1.5 dBTP.
 *
 * Usage:
 *   node scripts/demo/build-audio-mix-v4.mjs --no-mux
 *   node scripts/demo/build-audio-mix-v4.mjs --test
 *   node scripts/demo/build-audio-mix-v4.mjs --video demo/ad/out/mend-ad-v4-silent.mp4
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
const script = JSON.parse(readFileSync(path.join(AD, 'script-v4.json'), 'utf8'));
const total = Number(script.durationSeconds);
const videoArg = path.resolve(ROOT, arg('video', 'demo/ad/out/mend-ad-v4-silent.mp4'));
const voiceDir = path.join(AD, 'public/audio/v4/vo');
const music = path.join(AD, 'public/audio/music/music-1.mp3');
const sfxDir = path.join(AD, 'public/audio/v2/sfx');
if (!ffmpegPath) throw new Error('ffmpeg-static missing');
if (!existsSync(music)) throw new Error(`music missing: ${music}`);
if (!Number.isFinite(total) || total < 60) throw new Error(`bad script-v4 duration: ${total}`);
await mkdir(OUT, { recursive: true });

const run = (ffmpegArgs, options = {}) => {
  const result = spawnSync(ffmpegPath, ffmpegArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status}): ${result.stderr?.slice(-1800) ?? ''}`);
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
      `refusing to mux ${videoDuration?.toFixed(2) ?? 'unknown'}s video onto a ${total.toFixed(2)}s mix; ` +
        'wait for the full silent render (use --test for a filter check)',
    );
  }
}

const scenes = script.scenes;
const sceneAt = Object.fromEntries(scenes.map((scene) => [scene.id, Number(scene.start)]));
const sceneLen = Object.fromEntries(scenes.map((scene) => [scene.id, Number(scene.sceneDuration)]));
const voiceFile = (id) => path.join(voiceDir, `${id}.mp3`);
for (const scene of scenes) {
  if (!existsSync(voiceFile(scene.id))) throw new Error(`voice missing for ${scene.id}: ${voiceFile(scene.id)}`);
}

// Small deterministic cues so v4 does not depend on new third-party samples.
const cueDir = path.join(OUT, '.audio-v4-cues');
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
  'aevalsrc=0.5*sin(2*PI*(150*t-250*t*t))*exp(-18*t)+0.18*sin(2*PI*1800*t)*exp(-90*t):s=48000:d=0.18',
  'lowpass=f=2600,afade=t=in:st=0:d=0.002,afade=t=out:st=0.08:d=0.10',
);
const bidTick = makeCue(
  'bid-tick',
  'aevalsrc=0.55*sin(2*PI*1500*t)*exp(-80*t)+0.35*sin(2*PI*900*t)*exp(-65*t):s=48000:d=0.09',
  'highpass=f=300,afade=t=in:st=0:d=0.001,afade=t=out:st=0.02:d=0.06',
);

const sfx = [];
const add = (file, at, volume = 0.5, filter = null) => {
  if (existsSync(file) && Number.isFinite(at)) sfx.push({ file, at, volume, filter });
};
const sfxFile = (name) => path.join(sfxDir, `${name}.mp3`);

// Section whooshes and tactile cues. Action-level clicks are intentionally kept
// sparse: the Liam read and the app capture carry the detail; the mix should not
// sound like a click track.
for (const at of [sceneAt.report, sceneAt.dao, sceneAt.close]) {
  add(sfxFile('whoosh'), Math.max(0, at - 0.08), 0.28);
}
add(sfxFile('camera-shutter'), sceneAt.report + 0.55, 0.65);
add(sfxFile('ui-click'), sceneAt.report + Math.min(3.0, sceneLen.report * 0.22), 0.34);
add(mergePop, sceneAt.report + Math.min(6.5, sceneLen.report * 0.48), 0.38);
add(sfxFile('dao-stamp'), sceneAt.dao + sceneLen.dao * 0.78, 0.52);
add(bidTick, sceneAt.bids + sceneLen.bids * 0.22, 0.32);
add(sfxFile('dao-stamp'), sceneAt.repair + sceneLen.repair * 0.82, 0.5);
add(sfxFile('cash'), sceneAt.payment + sceneLen.payment * 0.36, 0.38);
add(sfxFile('page-turn'), sceneAt.passport + sceneLen.passport * 0.3, 0.34);
add(sfxFile('page-turn'), sceneAt.tech + sceneLen.tech * 0.82, 0.36,
  'atrim=0:0.30,highpass=f=600,afade=t=out:st=0.18:d=0.12');
add(sfxFile('dao-stamp'), sceneAt.close + 0.92, 0.62);

const inputs = [];
const filters = [];
const voiceLabels = [];
let inputIndex = 0;
const nextInput = (file) => {
  inputs.push('-i', file);
  return inputIndex++;
};

// Voice lines: trim only edge silence, clean the low end, add intelligibility
// presence, then place at the scripted start. A 20 ms fade keeps edits inaudible.
for (const scene of scenes) {
  const idx = nextInput(voiceFile(scene.id));
  const at = Math.max(0, Number(scene.start) + Number(scene.voOffset ?? 0));
  const ms = Math.round(at * 1000);
  const label = `vo${idx}`;
  filters.push(
    `[${idx}:a]silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,` +
      `areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,` +
      'highpass=f=75:poles=2,' +
      'acompressor=threshold=0.1:ratio=2:attack=12:release=220:makeup=1.2:knee=3:detection=rms,' +
      'equalizer=f=3000:width_type=q:width=1.0:g=2.2,' +
      'aresample=48000,aformat=channel_layouts=stereo,' +
      'afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.02,areverse,' +
      `adelay=${ms}|${ms},apad=whole_dur=${total},atrim=0:${total}[${label}]`,
  );
  voiceLabels.push(`[${label}]`);
}
filters.push(
  `${voiceLabels.join('')}amix=inputs=${voiceLabels.length}:normalize=0:duration=longest,` +
    `atrim=0:${total},asplit=2[voSide][voMix]`,
);

// Music: continuous bed, slight lift into the close, ducked under speech.
const closeStart = sceneAt.close;
const liftStart = Math.max(0, closeStart - 3);
const baseMusic = 0.25;
const closeMusic = 0.34;
const musicIdx = nextInput(music);
const musicGain =
  `${baseMusic}+${(closeMusic - baseMusic).toFixed(2)}*` +
  `min(max((t-${liftStart})/${Math.max(0.01, closeStart - liftStart)},0),1)`;
filters.push(
  `[${musicIdx}:a]atrim=0:${total},asetpts=PTS-STARTPTS,aresample=48000,` +
    `aformat=channel_layouts=stereo,volume='${musicGain}':eval=frame,` +
    `afade=t=out:st=${(total - 2).toFixed(2)}:d=2[music]`,
);
filters.push('[music][voSide]sidechaincompress=threshold=0.08:ratio=3.2:attack=20:release=520[ducked]');

const sfxLabels = [];
for (const item of sfx) {
  const idx = nextInput(item.file);
  const ms = Math.round(item.at * 1000);
  const prefix = item.filter ? `${item.filter},` : '';
  filters.push(
    `[${idx}:a]${prefix}aresample=48000,aformat=channel_layouts=stereo,` +
      `volume=${item.volume},adelay=${ms}|${ms}[sfx${idx}]`,
  );
  sfxLabels.push(`[sfx${idx}]`);
}
if (sfxLabels.length) {
  filters.push(`${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest[sfxMix]`);
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

const measurement = spawnSync(
  ffmpegPath,
  ['-hide_banner', '-nostats', '-i', premaster,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (measurement.status !== 0) throw new Error(`loudnorm measurement failed: ${measurement.stderr?.slice(-1200) ?? ''}`);
const measurementText = measurement.stderr ?? '';
const jsonStart = measurementText.lastIndexOf('{');
const jsonEnd = measurementText.lastIndexOf('}');
if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error(`could not read loudnorm JSON: ${measurementText.slice(-1200)}`);
const measured = JSON.parse(measurementText.slice(jsonStart, jsonEnd + 1));

const finalFilter =
  'loudnorm=I=-14:TP=-1.5:LRA=9' +
  `:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}` +
  `:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}` +
  `:offset=${measured.target_offset}:linear=true,` +
  'aresample=48000,aformat=channel_layouts=stereo,' +
  'alimiter=limit=0.89:attack=5:release=50:level=0';

const mix = path.join(OUT, test ? 'mix-v4-test.m4a' : 'mix-v4.m4a');
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
const summary = reportText.slice(reportText.lastIndexOf('Summary:'));
const pick = (label) => summary.match(new RegExp(`${label}\\s*:\\s*(-?[\\d.]+)`))?.[1] ?? '?';
console.log(`mix: ${mix}`);
console.log(`duration: ${total}s; scenes: ${scenes.length}; sfx: ${sfx.length}; video: ${videoDuration?.toFixed(2) ?? 'not muxed'}`);
console.log(`loudness: I=${pick('I')} LUFS, LRA=${pick('LRA')} LU, TP=${pick('Peak')} dBTP`);
const integrated = Number(pick('I'));
const truePeak = Number(pick('Peak'));
if (Number.isFinite(truePeak) && truePeak > -1) console.warn(`warning: true peak ${truePeak} dBTP above -1.0`);
if (Number.isFinite(integrated) && Math.abs(integrated + 14) > 0.3) {
  console.warn(`warning: integrated loudness ${integrated} LUFS outside -14.3..-13.7`);
}

const silenceProbe = spawnSync(
  ffmpegPath,
  ['-hide_banner', '-nostats', '-i', mix, '-af', 'silencedetect=n=-50dB:d=1.2', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const silenceHits = (silenceProbe.stderr ?? '').match(/silence_start/g)?.length ?? 0;
console.log(`silence: ${silenceHits} gap(s) over 1.2 s at -50 dB`);
if (silenceHits > 0) console.warn('warning: mix has a silence longer than 1.2 s');

await rm(cueDir, { recursive: true, force: true });
if (test || noMux) {
  console.log(noMux ? 'mix written; master not touched (--no-mux)' : 'mix (test only, not muxed)');
  process.exit(0);
}
const final = path.join(OUT, 'mend-ad-v4-master.mp4');
const mux = spawnSync(ffmpegPath, [
  '-y', '-i', videoArg, '-i', mix, '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', final,
], { stdio: 'inherit' });
if (mux.status !== 0) throw new Error(`mux failed (${mux.status})`);
console.log(`final: ${final}`);
