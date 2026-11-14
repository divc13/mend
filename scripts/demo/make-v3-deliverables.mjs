#!/usr/bin/env node
/**
 * Build the v3 delivery extras from the finished master:
 *   - verbatim, sentence-sized SRT + VTT captions
 *   - designed 1920x1080 PNG thumbnail + 1280x720 JPG
 *   - 3x3 contact sheet (1920x1080) covering all nine scenes
 *
 * Caption timing
 * --------------
 * v3 reuses the v1 ElevenLabs George read, trimmed and concatenated. The v1
 * per-scene alignment (`public/audio/vo/<scene>.timestamps.json`) therefore
 * still describes the words. Word times are mapped to the v3 mix with:
 *
 *     v3 absolute = scene.start + 24ms decoder offset + v1 character time
 *
 * The 24 ms is the decoded MP3 lead-in that remains after the v3
 * `silenceremove` pass (it keeps 30 ms of leading silence). No spoken text is
 * invented: cues are built only from the scene `vo` text and its characters.
 * If an alignment file is missing or its text does not match, the script falls
 * back to proportional character timing inside the scene and logs the fact.
 *
 * Usage:
 *   node scripts/demo/make-v3-deliverables.mjs
 *   node scripts/demo/make-v3-deliverables.mjs --master demo/ad/out/mend-ad-v3-master.mp4
 *   node scripts/demo/make-v3-deliverables.mjs --captions-only
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
const captionsOnly = args.includes('--captions-only');

const script = JSON.parse(readFileSync(path.join(AD, 'script-v3.json'), 'utf8'));
const voiceTimeline = JSON.parse(
  readFileSync(path.join(AD, 'public/audio/v3/voice-timeline.json'), 'utf8'),
);
const total = script.durationSeconds;
const captionEnd = total;
const master = path.resolve(ROOT, arg('master', 'demo/ad/out/mend-ad-v3-master.mp4'));
const font = '/System/Library/Fonts/Helvetica.ttc';
const remotionBin = path.join(ROOT, 'node_modules/.bin/remotion');
const thumbnailEntry = path.join(HERE, 'thumbnail-v3/index.ts');

if (!ffmpegPath) throw new Error('ffmpeg-static missing');
if (!existsSync(master)) throw new Error(`master missing: ${master}`);
if (!existsSync(remotionBin)) throw new Error(`remotion CLI missing: ${remotionBin}`);
if (!existsSync(thumbnailEntry)) throw new Error(`thumbnail composition missing: ${thumbnailEntry}`);

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

const probeVideoSize = (file) => {
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = `${probe.stderr}${probe.stdout}`.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
};

const masterDuration = probeDuration(master);
if (masterDuration === null || masterDuration < total - 0.5) {
  throw new Error(`master is ${masterDuration?.toFixed(2) ?? 'unknown'}s, expected ~${total}s`);
}

// ---------------------------------------------------------------------------
// Caption model
// ---------------------------------------------------------------------------

const MAX_LINE = 42;
const MAX_LINES = 2;
const MAX_CUE_SECONDS = 6.0;
const MIN_CUE_SECONDS = 3.0;
const WORD_OFFSET = 0.024;
const SPEECH_LEAD = 0.08;
const SPEECH_HOLD = 0.42;

const BAD_BREAK_BEFORE = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'that', 'this', 'it', 'is', 'was', 'has', 'have', 'had', 'as', 'at', 'by',
  'from', 'one', 'two', 'three', 'no', 'not', 'be', 'are', 'were', 'will',
  'can', 'could', 'should', 'would', 'into', 'onto', 'over', 'under', 'after',
  'before', 'than', 'then', 'so', 'if', 'when', 'while', 'every', 'each',
  'all', 'some', 'any', 'most', 'more', 'less', 'very', 'just', 'also', 'only',
  'own', 'same', 'new', 'real', 'human', 'private', 'public',
]);
const BAD_BREAK_AFTER = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'was', 'has', 'have', 'had', 'are', 'were', 'be', 'as', 'at', 'by',
  'from', 'that', 'this',
]);

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

const wrapCaption = (text) => {
  if (text.length <= MAX_LINE) return [text];
  let best = null;
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== ' ') continue;
    const a = text.slice(0, i);
    const b = text.slice(i + 1);
    if (a.length > MAX_LINE || b.length > MAX_LINE || b.length === 0) continue;
    let score = Math.abs(a.length - b.length);
    const last = a[a.length - 1];
    if (/[.!?]/.test(last)) score -= 60;
    else if (/[,;:]/.test(last)) score -= 16;
    else score += 6;
    const lastWord = a.split(' ').at(-1) ?? '';
    const firstWord = b.split(' ')[0] ?? '';
    if (BAD_BREAK_BEFORE.has(firstWord.toLowerCase())) score += 10;
    if (BAD_BREAK_AFTER.has(lastWord.toLowerCase())) score += 14;
    // Keep proper-noun pairs such as "Agent Market" together.
    if (/^[A-Z]/.test(lastWord) && /^[A-Z]/.test(firstWord)) score += 20;
    if (/^[a-z]/.test(b) && /[A-Za-z]$/.test(a)) score += 2;
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best?.lines ?? null;
};

const tokenizeWords = (text, startAt, span) => {
  const raw = text.match(/\S+/g) ?? [];
  if (raw.length === 0) return [];
  const totalChars = raw.reduce((sum, word) => sum + word.length, 0);
  let consumed = 0;
  return raw.map((word) => {
    const start = startAt + (consumed / totalChars) * span;
    consumed += word.length;
    const end = startAt + (consumed / totalChars) * span;
    return {
      word,
      start,
      end,
      sentenceEnd: /[.!?]$/.test(word),
      clauseEnd: /[,;:]$/.test(word),
      timing: 'proportional',
    };
  });
};

const wordsFromAlignment = (scene, alignment) => {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } =
    alignment;
  if (!Array.isArray(characters) || !Array.isArray(starts) || !Array.isArray(ends)) return null;
  const text = characters.join('');
  if (text !== scene.vo) return null;

  const words = [];
  let i = 0;
  while (i < characters.length) {
    while (i < characters.length && /\s/.test(characters[i])) i += 1;
    if (i >= characters.length) break;
    const first = i;
    while (i < characters.length && !/\s/.test(characters[i])) i += 1;
    const last = i - 1;
    const word = text.slice(first, last + 1);
    const after = characters[last + 1];
    words.push({
      word,
      start: scene.start + WORD_OFFSET + starts[first],
      end: scene.start + WORD_OFFSET + ends[last],
      sentenceEnd: /[.!?]$/.test(word) && (!after || /\s/.test(after)),
      clauseEnd: /[,;:]$/.test(word),
      timing: 'alignment',
    });
  }
  return words;
};

const wordsForScene = (scene) => {
  const alignmentPath = path.join(AD, 'public/audio/vo', `${scene.id}.timestamps.json`);
  if (existsSync(alignmentPath)) {
    const timestampFile = JSON.parse(readFileSync(alignmentPath, 'utf8'));
    const words = wordsFromAlignment(scene, timestampFile.alignment);
    if (words) return { words, timing: 'alignment' };
  }
  console.warn(
    `warning: ${scene.id} has no matching v1 word alignment; ` +
      'falling back to proportional character timing inside the scene.',
  );
  return {
    words: tokenizeWords(
      scene.vo,
      scene.start + WORD_OFFSET,
      Math.max(0.1, scene.voDuration - 0.1),
    ),
    timing: 'proportional',
  };
};

const sentenceRanges = (words) => {
  const ranges = [];
  let start = 0;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].sentenceEnd) {
      ranges.push([start, i]);
      start = i + 1;
    }
  }
  if (start < words.length) ranges.push([start, words.length - 1]);
  return ranges;
};

const unitFromRange = (words, a, b) => {
  const text = words.slice(a, b + 1).map((word) => word.word).join(' ');
  return {
    a,
    b,
    text,
    start: words[a].start,
    end: words[b].end,
    duration: words[b].end - words[a].start,
    sentenceEnd: words[b].sentenceEnd,
    clauseEnd: words[b].clauseEnd,
  };
};

/**
 * Split a scene into clause-sized units. Whole sentences stay whole when they
 * fit in two 42-character lines and six seconds; otherwise they break at
 * commas/colons, then at word boundaries. The unit DP below recombines them.
 */
const unitsForScene = (words) => {
  const units = [];
  const push = (a, b) => {
    const unit = unitFromRange(words, a, b);
    if (!wrapCaption(unit.text)) {
      throw new Error(`unwrappable caption unit: ${JSON.stringify(unit.text)}`);
    }
    units.push(unit);
  };

  for (const [i0, i1] of sentenceRanges(words)) {
    const whole = unitFromRange(words, i0, i1);
    if (
      whole.duration <= MAX_CUE_SECONDS &&
      whole.text.length <= MAX_LINE * MAX_LINES &&
      wrapCaption(whole.text)
    ) {
      push(i0, i1);
      continue;
    }

    const clauses = [];
    let clauseStart = i0;
    for (let i = i0; i <= i1; i += 1) {
      if (words[i].clauseEnd) {
        clauses.push([clauseStart, i]);
        clauseStart = i + 1;
      }
    }
    if (clauseStart <= i1) clauses.push([clauseStart, i1]);

    for (const [a, b] of clauses) {
      const clause = unitFromRange(words, a, b);
      if (
        clause.duration <= MAX_CUE_SECONDS &&
        clause.text.length <= MAX_LINE * MAX_LINES &&
        wrapCaption(clause.text)
      ) {
        push(a, b);
        continue;
      }

      let cursor = a;
      while (cursor <= b) {
        let end = cursor;
        while (end + 1 <= b) {
          const next = words.slice(cursor, end + 2).map((word) => word.word).join(' ');
          const duration = words[end + 1].end - words[cursor].start;
          if (duration > MAX_CUE_SECONDS || next.length > MAX_LINE * MAX_LINES || !wrapCaption(next)) {
            break;
          }
          end += 1;
        }
        push(cursor, end);
        cursor = end + 1;
      }
    }
  }

  return units;
};

/** Pack clause units into 3-6s, two-line cues. */
const packUnits = (units) => {
  const n = units.length;
  const dp = Array(n + 1).fill(null);
  dp[0] = { cost: 0, prev: -1 };

  for (let j = 1; j <= n; j += 1) {
    for (let i = j - 1; i >= 0; i -= 1) {
      if (!dp[i]) continue;
      const duration = units[j - 1].end - units[i].start;
      if (duration > MAX_CUE_SECONDS + 1e-9) break;
      const text = units.slice(i, j).map((unit) => unit.text).join(' ');
      if (text.length > MAX_LINE * MAX_LINES || !wrapCaption(text)) break;

      let cost = 1.4 + (duration - 4.2) ** 2 * 0.55;
      if (duration < MIN_CUE_SECONDS) cost += (MIN_CUE_SECONDS - duration) ** 2 * 9;
      if (duration > 5.7) cost += (duration - 5.7) ** 2 * 2;
      if (j < n && !units[j - 1].sentenceEnd) cost += units[j - 1].clauseEnd ? 0.4 : 3.0;
      if (i > 0 && !units[i - 1].sentenceEnd) cost += 1.5;

      const totalCost = dp[i].cost + cost;
      if (!dp[j] || totalCost < dp[j].cost) dp[j] = { cost: totalCost, prev: i };
    }
  }

  if (!dp[n]) throw new Error('caption packer could not cover the scene');
  const segments = [];
  let j = n;
  while (j > 0) {
    const state = dp[j];
    if (!state || state.prev < 0) throw new Error('caption packer produced a broken path');
    segments.push({ i: state.prev, j });
    j = state.prev;
  }
  return segments.reverse();
};

const buildCaptionCues = () => {
  const cues = [];
  const timingSources = {};
  const sceneCueCounts = {};

  for (const scene of voiceTimeline.scenes) {
    const { words, timing } = wordsForScene(scene);
    timingSources[scene.id] = timing;
    const units = unitsForScene(words);
    const segments = packUnits(units);
    sceneCueCounts[scene.id] = segments.length;
    for (const segment of segments) {
      const a = units[segment.i].a;
      const b = units[segment.j - 1].b;
      const text = words.slice(a, b + 1).map((word) => word.word).join(' ');
      const lines = wrapCaption(text);
      if (!lines || lines.length > MAX_LINES) {
        throw new Error(`caption overflow: ${JSON.stringify(text)}`);
      }
      cues.push({
        sceneId: scene.id,
        speechStart: words[a].start,
        speechEnd: words[b].end,
        text,
        lines,
      });
    }
  }

  // Display times: a small lead-in, a short hold after the last word, never
  // overlapping the next cue, and the final cue pinned to the end of the cut.
  const displayCues = [];
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const next = cues[index + 1];
    const previous = displayCues[index - 1];
    let start = Math.max(0, cue.speechStart - SPEECH_LEAD);
    if (previous) start = Math.max(start, previous.endMs / 1000 + 0.02);
    let end;
    if (!next) {
      end = captionEnd;
    } else {
      end = Math.min(
        cue.speechEnd + SPEECH_HOLD,
        next.speechStart - 0.03,
        start + MAX_CUE_SECONDS,
      );
      if (end < cue.speechEnd) {
        end = Math.min(cue.speechEnd, next.speechStart - 0.01, start + MAX_CUE_SECONDS);
      }
    }
    end = Math.max(end, start + 0.2);
    displayCues.push({
      ...cue,
      startMs: Math.round(start * 1000),
      endMs: Math.round(end * 1000),
      duration: end - start,
    });
  }
  return { cues: displayCues, timingSources, sceneCueCounts };
};

const { cues, timingSources, sceneCueCounts } = buildCaptionCues();

// Keep rounded milliseconds monotonic and make the final cue exact.
for (let i = 0; i < cues.length; i += 1) {
  if (i > 0 && cues[i].startMs < cues[i - 1].endMs) cues[i].startMs = cues[i - 1].endMs;
  if (cues[i].endMs <= cues[i].startMs) cues[i].endMs = cues[i].startMs + 250;
}
cues.at(-1).endMs = Math.round(captionEnd * 1000);
cues.at(-1).duration = (cues.at(-1).endMs - cues.at(-1).startMs) / 1000;

// ---------------------------------------------------------------------------
// Caption validation
// ---------------------------------------------------------------------------

const cueText = normalize(cues.map((cue) => cue.text).join(' '));
const spokenText = normalize(voiceTimeline.scenes.map((scene) => scene.vo).join(' '));
if (cueText !== spokenText) {
  throw new Error('caption text does not match the spoken script');
}
if (cues.at(-1).endMs !== Math.round(captionEnd * 1000)) {
  throw new Error(`final caption does not end at ${captionEnd.toFixed(3)}s`);
}

for (let i = 0; i < cues.length; i += 1) {
  const cue = cues[i];
  if (cue.startMs < 0 || cue.endMs > Math.round(captionEnd * 1000)) {
    throw new Error(`cue ${i + 1} is outside 00:00.000-${captionEnd.toFixed(3)}s`);
  }
  if (i > 0 && cue.startMs < cues[i - 1].endMs) {
    throw new Error(`cue ${i + 1} overlaps cue ${i}`);
  }
  if (cue.lines.length > MAX_LINES) throw new Error(`cue ${i + 1} has more than two lines`);
  for (const line of cue.lines) {
    if (line.length > MAX_LINE) {
      throw new Error(`cue ${i + 1} line is ${line.length} chars: ${JSON.stringify(line)}`);
    }
  }
}

const shortCues = cues.filter((cue) => cue.duration < MIN_CUE_SECONDS);
const longCues = cues.filter((cue) => cue.duration > MAX_CUE_SECONDS + 1e-6);
const gaps = cues.slice(1).map((cue, index) => cue.startMs - cues[index].endMs);

// ---------------------------------------------------------------------------
// Caption files
// ---------------------------------------------------------------------------

const clockMs = (ms, separator) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
};

const srt = cues
  .map(
    (cue, index) =>
      `${index + 1}\n${clockMs(cue.startMs, ',')} --> ${clockMs(cue.endMs, ',')}\n${cue.lines.join('\n')}\n`,
  )
  .join('\n');
const vtt =
  'WEBVTT\n\n' +
  cues
    .map(
      (cue, index) =>
        `${index + 1}\n${clockMs(cue.startMs, '.')} --> ${clockMs(cue.endMs, '.')}\n${cue.lines.join('\n')}\n`,
    )
    .join('\n');

const srtPath = path.join(OUT, 'mend-ad-v3-verbatim.srt');
const vttPath = path.join(OUT, 'mend-ad-v3-verbatim.vtt');
await writeFile(srtPath, srt);
await writeFile(vttPath, vtt);

// ---------------------------------------------------------------------------
// Thumbnail + contact sheet
// ---------------------------------------------------------------------------

const frames = [
  { id: 'hook', label: '01 HOOK / 2s', at: 2, file: '01-hook.png' },
  { id: 'report', label: '02 REPORT / 24s', at: 24, file: '02-report.png' },
  { id: 'dao', label: '03 DAO / 43s', at: 43, file: '03-dao.png' },
  { id: 'bids', label: '04 BIDS / 62s', at: 62, file: '04-bids.png' },
  { id: 'repair', label: '05 INSPECT / 74s', at: 74, file: '05-inspect.png' },
  { id: 'payment', label: '06 PAYMENT / 84s', at: 84, file: '06-payment.png' },
  { id: 'passport', label: '07 PASSPORT / 102s', at: 102, file: '07-passport.png' },
  { id: 'tech', label: '08 TECH / 135s', at: 135, file: '08-tech.png' },
  { id: 'close', label: '09 CLOSE / 145s', at: 145, file: '09-close.png' },
];

let thumbnailPng = null;
let thumbnailJpg = null;
let contactSheet = null;

if (!captionsOnly) {
  thumbnailPng = path.join(OUT, 'mend-ad-v3-thumbnail.png');
  thumbnailJpg = path.join(OUT, 'mend-ad-v3-thumbnail-1280.jpg');
  contactSheet = path.join(OUT, 'mend-ad-v3-contact-sheet.png');

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'mend-v3-sheet-'));
  try {
    const emptyPublic = path.join(tmp, 'thumb-public');
    await mkdir(emptyPublic, { recursive: true });

    const remotion = spawnSync(
      remotionBin,
      [
        'still',
        thumbnailEntry,
        'MendV3Thumbnail',
        thumbnailPng,
        '--image-format=png',
        '--overwrite',
        `--public-dir=${emptyPublic}`,
        '--log=error',
      ],
      { cwd: ROOT, stdio: 'inherit' },
    );
    if (remotion.status !== 0) {
      throw new Error(`remotion thumbnail failed (${remotion.status})`);
    }

    run(['-i', thumbnailPng, '-frames:v', '1'], thumbnailJpg, [
      '-vf',
      'scale=1280:720:flags=lanczos',
      '-q:v',
      '2',
      '-an',
    ]);

    for (const frame of frames) {
      run(
        ['-ss', String(frame.at), '-i', master, '-frames:v', '1', '-an'],
        path.join(tmp, frame.file),
        ['-vf', 'scale=640:360:flags=lanczos,setsar=1'],
      );
    }

    const inputs = frames.flatMap((frame) => ['-i', path.join(tmp, frame.file)]);
    const filters = frames.map((frame, index) => {
      const label = frame.label.replace(/:/g, '\\:').replace(/'/g, "\\'");
      return (
        `[${index}:v]` +
        `drawtext=fontfile=${font}:text='${label}':fontsize=18:fontcolor=white:` +
        `box=1:boxcolor=0x071b15@0.78:boxborderw=8:x=(w-text_w)/2:y=12,` +
        `drawbox=x=0:y=0:w=640:h=360:color=0x071b15:t=2[v${index}]`
      );
    });
    const stack = frames.map((_, index) => `[v${index}]`).join('');
    filters.push(
      `${stack}xstack=inputs=${frames.length}:layout=` +
        '0_0|640_0|1280_0|0_360|640_360|1280_360|0_720|640_720|1280_720:fill=0x071b15[sheet]',
    );
    run(
      inputs,
      contactSheet,
      ['-filter_complex', filters.join(';'), '-map', '[sheet]', '-frames:v', '1'],
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Image validation + report
// ---------------------------------------------------------------------------

if (!captionsOnly) {
  const thumbSize = probeVideoSize(thumbnailPng);
  const thumbJpgSize = probeVideoSize(thumbnailJpg);
  const sheetSize = probeVideoSize(contactSheet);
  if (thumbSize?.width !== 1920 || thumbSize?.height !== 1080) {
    throw new Error(`thumbnail is ${thumbSize?.width}x${thumbSize?.height}, expected 1920x1080`);
  }
  if (thumbJpgSize?.width !== 1280 || thumbJpgSize?.height !== 720) {
    throw new Error(`thumbnail JPG is ${thumbJpgSize?.width}x${thumbJpgSize?.height}, expected 1280x720`);
  }
  if (sheetSize?.width !== 1920 || sheetSize?.height !== 1080) {
    throw new Error(`contact sheet is ${sheetSize?.width}x${sheetSize?.height}, expected 1920x1080`);
  }
}

const minDisplay = Math.min(...cues.map((cue) => cue.duration));
const maxDisplay = Math.max(...cues.map((cue) => cue.duration));
const maxGap = Math.max(...gaps);

console.log(`srt: ${srtPath}`);
console.log(`vtt: ${vttPath}`);
if (!captionsOnly) {
  console.log(`thumbnail: ${thumbnailPng}`);
  console.log(`thumbnail 1280: ${thumbnailJpg}`);
  console.log(`contact sheet: ${contactSheet}`);
}
console.log(`master duration: ${masterDuration.toFixed(3)}s`);
console.log(
  `captions: ${cues.length} cues, ${minDisplay.toFixed(2)}-${maxDisplay.toFixed(2)}s display, ` +
    `${shortCues.length} under ${MIN_CUE_SECONDS}s, ${longCues.length} over ${MAX_CUE_SECONDS}s`,
);
console.log(
  `captions: final end ${clockMs(cues.at(-1).endMs, '.')} ` +
    `(${clockMs(Math.round(captionEnd * 1000), '.')} required), max gap ${Math.round(maxGap)}ms, ` +
    `word timing: ${Object.entries(timingSources).map(([id, source]) => `${id}=${source}`).join(', ')}`,
);
if (shortCues.length > 0) {
  console.log(
    'limitation: short cues kept verbatim because joining the next sentence would exceed ' +
      `${MAX_CUE_SECONDS}s or ${MAX_LINE * MAX_LINES} characters: ` +
      shortCues.map((cue) => `${cue.sceneId}:${cue.duration.toFixed(2)}s`).join(', '),
  );
}
