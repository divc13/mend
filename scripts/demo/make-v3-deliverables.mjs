#!/usr/bin/env node
/**
 * Build the v3 delivery extras from the finished master:
 *   - SRT + VTT captions from script-v3.json scene boundaries
 *   - 1920x1080 PNG thumbnail + 1280x720 JPG (bid-table frame)
 *   - 3x3 contact sheet (1920x1080) covering all nine scenes
 *
 * Usage:
 *   node scripts/demo/make-v3-deliverables.mjs
 *   node scripts/demo/make-v3-deliverables.mjs --master demo/ad/out/mend-ad-v3-master.mp4
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
const script = JSON.parse(readFileSync(path.join(AD, 'script-v3.json'), 'utf8'));
const total = script.durationSeconds;
const master = path.resolve(ROOT, arg('master', 'demo/ad/out/mend-ad-v3-master.mp4'));
const font = '/System/Library/Fonts/Helvetica.ttc';
if (!ffmpegPath) throw new Error('ffmpeg-static missing');
if (!existsSync(master)) throw new Error(`master missing: ${master}`);

const run = (input, output, extra = []) => {
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...input, ...extra, output], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status}) for ${output}`);
};

const probeDuration = (file) => {
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = `${probe.stderr}${probe.stdout}`.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
};
const masterDuration = probeDuration(master);
if (masterDuration === null || masterDuration < total - 0.5) {
  throw new Error(`master is ${masterDuration?.toFixed(2) ?? 'unknown'}s, expected ~${total}s`);
}

const clock = (seconds, separator) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s
    .toFixed(3)
    .padStart(6, '0')
    .replace('.', separator)}`;
};
const cues = script.scenes.map((scene, index) => {
  const next = script.scenes[index + 1];
  return {
    start: scene.start,
    end: next ? next.start : Math.min(total, masterDuration),
    text: scene.caption,
  };
});
const srt = cues
  .map((cue, index) => `${index + 1}\n${clock(cue.start, ',')} --> ${clock(cue.end, ',')}\n${cue.text}\n`)
  .join('\n');
const vtt =
  'WEBVTT\n\n' +
  cues
    .map(
      (cue, index) =>
        `${index + 1}\n${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${cue.text}\n`,
    )
    .join('\n');
const srtPath = path.join(OUT, 'mend-ad-v3.srt');
const vttPath = path.join(OUT, 'mend-ad-v3.vtt');
await writeFile(srtPath, srt);
await writeFile(vttPath, vtt);

const frames = [
  { label: '01 HOOK / 2s', at: 2, file: '01-hook.png' },
  { label: '02 REPORT / 24s', at: 24, file: '02-report.png' },
  { label: '03 DAO / 43s', at: 43, file: '03-dao.png' },
  { label: '04 BIDS / 62s', at: 62, file: '04-bids.png' },
  { label: '05 INSPECT / 74s', at: 74, file: '05-inspect.png' },
  { label: '06 PAYMENT / 84s', at: 84, file: '06-payment.png' },
  { label: '07 PASSPORT / 102s', at: 102, file: '07-passport.png' },
  { label: '08 TECH / 135s', at: 135, file: '08-tech.png' },
  { label: '09 CLOSE / 145s', at: 145, file: '09-close.png' },
];

const tmp = await mkdtemp(path.join(os.tmpdir(), 'mend-v3-sheet-'));
try {
  for (const frame of frames) {
    run(
      ['-ss', String(frame.at), '-i', master, '-frames:v', '1', '-an'],
      path.join(tmp, frame.file),
    );
  }

  const thumbnailPng = path.join(OUT, 'mend-ad-v3-thumbnail.png');
  run(['-ss', '62', '-i', master, '-frames:v', '1', '-an'], thumbnailPng);
  const thumbnailJpg = path.join(OUT, 'mend-ad-v3-thumbnail-1280.jpg');
  run(
    ['-ss', '62', '-i', master, '-frames:v', '1', '-an', '-vf', 'scale=1280:720:flags=lanczos'],
    thumbnailJpg,
    ['-q:v', '2'],
  );

  const inputs = frames.flatMap((frame) => ['-i', path.join(tmp, frame.file)]);
  const filters = frames.map((frame, index) => {
    const label = frame.label.replace(/:/g, '\\:');
    return (
      `[${index}:v]scale=640:360:flags=lanczos,setsar=1,` +
      `drawtext=fontfile=${font}:text='${label}':fontsize=18:fontcolor=white:` +
      `box=1:boxcolor=0x071b15@0.72:boxborderw=6:x=(w-text_w)/2:y=10,` +
      `drawbox=x=0:y=0:w=640:h=360:color=0x071b15:t=2[v${index}]`
    );
  });
  const stack = frames.map((_, index) => `[v${index}]`).join('');
  filters.push(
    `${stack}xstack=inputs=${frames.length}:layout=` +
      '0_0|640_0|1280_0|0_360|640_360|1280_360|0_720|640_720|1280_720:fill=0x071b15[sheet]',
  );
  const contactSheet = path.join(OUT, 'mend-ad-v3-contact-sheet.png');
  run(
    inputs,
    contactSheet,
    ['-filter_complex', filters.join(';'), '-map', '[sheet]', '-frames:v', '1'],
  );

  console.log(`srt: ${srtPath}`);
  console.log(`vtt: ${vttPath}`);
  console.log(`thumbnail: ${thumbnailPng}`);
  console.log(`thumbnail 1280: ${thumbnailJpg}`);
  console.log(`contact sheet: ${contactSheet}`);
  console.log(`master duration: ${masterDuration.toFixed(3)}s; frames: ${frames.length}`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
