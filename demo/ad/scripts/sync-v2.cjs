#!/usr/bin/env node
/**
 * Build-time sync for the MEND v2 composition.
 *
 * The v2 film is assembled from four moving parts that may be produced by
 * different agents at different times:
 *   - script-v2.json              (optional; falls back to script.json)
 *   - public/audio/v2/cue-sheet.json
 *   - public/audio/v2/voice-timeline.json
 *   - public/assets/live/*        (live app captures)
 *
 * Remotion cannot import files that may not exist, so this script normalises
 * whatever is present into three generated JSON files under src/v2/. Re-run it
 * whenever the script, cue sheet, voice timeline or live captures change:
 *
 *   node demo/ad/scripts/sync-v2.cjs
 *
 * Nothing outside src/v2/ and this script is written.
 */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const srcDir = path.join(projectRoot, 'src');
const v2Dir = path.join(srcDir, 'v2');

const IGNORED = new Set(['.DS_Store', 'Thumbs.db', '.raw']);
const CANONICAL = [
  'hook',
  'report',
  'dao',
  'bids',
  'repair',
  'payment',
  'passport',
  'tech',
  'close',
];

const SCENE_TONES = {
  hook: 'dark',
  report: 'paper',
  dao: 'paper',
  bids: 'paper',
  repair: 'dark',
  payment: 'paper',
  passport: 'paper',
  tech: 'dark',
  close: 'paper',
};

// J-cuts: positive = picture starts after the voice line, negative = picture
// leads the voice line. The parent can override this with `visualOffset` in
// script-v2.json.
const DEFAULT_VISUAL_OFFSET = {
  hook: 0.4,
  report: -0.35,
  dao: 0.3,
  bids: -0.4,
  repair: 0.35,
  payment: -0.3,
  passport: 0.3,
  tech: -0.35,
  close: 0.4,
};

/**
 * Cues are pinned to the existing v1 ElevenLabs George VO. Each entry is
 * searched as a phrase in the v1 word alignment; the cue fires on the first
 * word of that phrase. `fraction` is only used if a timestamp file is missing
 * or the phrase cannot be found.
 */
const V1_CUE_SPECS = {
  hook: [
    { id: 'hook.establish', phrase: 'Every neighborhood has one', fraction: 0.02, kind: 'establish', label: 'Street, morning' },
    { id: 'hook.nearmiss', phrase: 'near miss', fraction: 0.4, kind: 'nearmiss', label: 'Near miss' },
    { id: 'hook.flash', phrase: 'This morning', fraction: 0.66, kind: 'flash', label: 'Phone flash' },
    { id: 'hook.decide', phrase: 'Sam decides', fraction: 0.72, kind: 'decide', label: 'Sam decides' },
    { id: 'hook.push', phrase: 'change that', fraction: 0.86, kind: 'push', label: 'Push in' },
  ],
  report: [
    { id: 'report.open', phrase: 'opens MEND', fraction: 0.04, kind: 'open', label: 'Open MEND' },
    { id: 'report.photo', phrase: 'A photo', fraction: 0.17, kind: 'photo', label: 'Photo + pin' },
    { id: 'report.strip', phrase: 'strips the GPS', fraction: 0.31, kind: 'strip', label: 'EXIF stripped' },
    { id: 'report.ai', phrase: 'Private AI', fraction: 0.47, kind: 'ai', label: 'Private AI draft' },
    { id: 'report.duplicate', phrase: 'checks for duplicates', fraction: 0.65, kind: 'duplicate', label: 'Duplicate found' },
    { id: 'report.merge', phrase: 'merges them privately', fraction: 0.82, kind: 'merge', label: 'Reports merged' },
  ],
  dao: [
    { id: 'dao.steward', phrase: 'steward', fraction: 0.06, kind: 'steward', label: 'Steward scope' },
    { id: 'dao.scope', phrase: 'a scope', fraction: 0.22, kind: 'scope', label: 'Scope' },
    { id: 'dao.budget', phrase: 'maximum budget', fraction: 0.37, kind: 'budget', label: 'Max budget' },
    { id: 'dao.vote1', phrase: 'Two of three', fraction: 0.54, kind: 'vote', label: 'Vote one' },
    { id: 'dao.vote2', phrase: 'council votes', fraction: 0.68, kind: 'vote', label: 'Vote two' },
    { id: 'dao.receipt', phrase: 'receipt', fraction: 0.84, kind: 'receipt', label: 'On-chain receipt' },
  ],
  bids: [
    { id: 'bids.seal', phrase: 'sealed bids', fraction: 0.06, kind: 'seal', label: 'Sealed bids' },
    { id: 'bids.close', phrase: 'window closes', fraction: 0.24, kind: 'close', label: 'Window closes' },
    { id: 'bids.policy', phrase: 'hash-pinned policy', fraction: 0.39, kind: 'policy', label: 'Policy pinned' },
    { id: 'bids.scoreB', phrase: 'B wins', fraction: 0.57, kind: 'score', label: 'B wins value' },
    { id: 'bids.winner', phrase: 'total value', fraction: 0.74, kind: 'winner', label: 'Award' },
    { id: 'bids.receipt', phrase: 'picks the winner', fraction: 0.9, kind: 'receipt', label: 'Score receipt' },
  ],
  repair: [
    { id: 'repair.start', phrase: 'repair begins', fraction: 0.05, kind: 'start', label: 'Repair starts' },
    { id: 'repair.clean', phrase: 'cleaned', fraction: 0.19, kind: 'clean', label: 'Clean' },
    { id: 'repair.fill', phrase: 'filled', fraction: 0.35, kind: 'fill', label: 'Fill' },
    { id: 'repair.compact', phrase: 'compacted', fraction: 0.51, kind: 'compact', label: 'Compact' },
    { id: 'repair.inspect', phrase: 'inspects the work', fraction: 0.69, kind: 'inspect', label: 'Independent inspection' },
    { id: 'repair.sign', phrase: 'signature', fraction: 0.86, kind: 'sign', label: 'Signature' },
    { id: 'repair.seal', phrase: 'sealed', fraction: 0.55, kind: 'seal', label: 'Seal' },
  ],
  payment: [
    { id: 'payment.accept', phrase: 'On acceptance', fraction: 0.07, kind: 'accept', label: 'Accepted' },
    { id: 'payment.split', phrase: 'seventy-two', fraction: 0.27, kind: 'split', label: 'Split' },
    { id: 'payment.hold', phrase: 'Eight stays', fraction: 0.35, kind: 'hold', label: 'Hold 8' },
    { id: 'payment.refund', phrase: 'Twenty was refunded', fraction: 0.45, kind: 'refund', label: 'Refund 20' },
    { id: 'payment.pay', phrase: 'gets paid', fraction: 0.61, kind: 'pay', label: 'Pay 72' },
    { id: 'payment.receipt', phrase: 'leverage', fraction: 0.9, kind: 'receipt', label: 'Receipt' },
  ],
  passport: [
    { id: 'passport.open', phrase: 'reopens', fraction: 0.07, kind: 'open', label: 'Open passport' },
    { id: 'passport.history', phrase: 'same history', fraction: 0.29, kind: 'history', label: 'History' },
    { id: 'passport.failure', phrase: 'failure', fraction: 0.49, kind: 'failure', label: 'Failure kept' },
    { id: 'passport.remedy', phrase: 'remedy', fraction: 0.67, kind: 'remedy', label: 'Remedy' },
    { id: 'passport.seal', phrase: 'one place', fraction: 0.86, kind: 'seal', label: 'Permanent record' },
  ],
  tech: [
    { id: 'tech.stack', phrase: 'Next.js', fraction: 0.05, kind: 'stack', label: 'Stack' },
    { id: 'tech.flow', phrase: 'Fastify API', fraction: 0.23, kind: 'flow', label: 'Request flow' },
    { id: 'tech.contracts', phrase: 'Rust contracts', fraction: 0.41, kind: 'contracts', label: 'NEAR contracts' },
    { id: 'tech.proof', phrase: 'live on NEAR testnet', fraction: 0.59, kind: 'proof', label: 'Live proof' },
    { id: 'tech.live', phrase: 'replay demo', fraction: 0.72, kind: 'live', label: 'Replay demo' },
    { id: 'tech.receipts', phrase: 'verifiable receipt', fraction: 0.9, kind: 'receipts', label: 'Verifiable receipts' },
  ],
  close: [
    { id: 'close.sunrise', phrase: 'This is maintenance', fraction: 0.04, kind: 'sunrise', label: 'Sunrise' },
    { id: 'close.sam', phrase: 'Report it', fraction: 0.21, kind: 'sam', label: 'Sam' },
    { id: 'close.neighbor', phrase: 'Fix it', fraction: 0.37, kind: 'neighbor', label: 'Neighbor' },
    { id: 'close.tagline', phrase: 'Remember it', fraction: 0.55, kind: 'tagline', label: 'Maintenance with memory' },
    { id: 'close.logo', phrase: 'MEND', fraction: 0.73, kind: 'logo', label: 'MEND' },
    { id: 'close.cta', phrase: 'Get it fixed', fraction: 0.87, kind: 'cta', label: 'Get it fixed' },
  ],
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (fs.existsSync(file)) {
      console.warn(`[mend-ad:v2] could not parse ${path.relative(projectRoot, file)}: ${error.message}`);
    }
    return null;
  }
}

function walk(dir, prefix = '') {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative.replaceAll(path.sep, '/'));
    }
  }
  return files;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (next !== previous) {
    fs.writeFileSync(file, next);
    return true;
  }
  return false;
}

function numberOr(value, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function canonicalSceneId(rawId, index, count) {
  const clean = String(rawId ?? '')
    .toLowerCase()
    .replace(/^[0-9]+[-_. ]*/, '')
    .replace(/[^a-z0-9]+/g, '-');
  const aliases = {
    problem: 'hook',
    intro: 'hook',
    'the-problem': 'hook',
    report: 'report',
    reporting: 'report',
    authorize: 'dao',
    authorization: 'dao',
    steward: 'dao',
    council: 'dao',
    bid: 'bids',
    bidding: 'bids',
    contractors: 'bids',
    fix: 'repair',
    inspection: 'repair',
    settle: 'payment',
    settlement: 'payment',
    pay: 'payment',
    remember: 'passport',
    warranty: 'passport',
    'under-the-hood': 'tech',
    technology: 'tech',
    stack: 'tech',
    end: 'close',
    outro: 'close',
    cta: 'close',
  };
  const mapped = aliases[clean] ?? clean;
  if (CANONICAL.includes(mapped)) {
    return mapped;
  }
  if (count === CANONICAL.length) {
    return CANONICAL[index] ?? 'hook';
  }
  return mapped || (CANONICAL[index] ?? 'hook');
}

function normaliseScenes(sourceScenes, fps) {
  const count = sourceScenes.length;
  let cursor = 0;
  return sourceScenes.map((raw, index) => {
    const scene = raw && typeof raw === 'object' ? raw : {};
    const rawId = firstString(scene.id, scene.sceneId, scene.slug, scene.visual, scene.name) || CANONICAL[index] || `scene-${index + 1}`;
    const id = canonicalSceneId(rawId, index, count);

    const startFrame = numberOr(scene.startFrame, NaN);
    const durationFrame = numberOr(scene.durationInFrames ?? scene.durationFrames, NaN);
    let start = numberOr(scene.start ?? scene.startSec ?? scene.startSeconds, NaN);
    let duration = numberOr(
      scene.duration ?? scene.durationSec ?? scene.durationSeconds ?? scene.length,
      NaN,
    );
    if (Number.isFinite(startFrame)) {
      start = startFrame / fps;
    }
    if (Number.isFinite(durationFrame)) {
      duration = durationFrame / fps;
    }
    // If a script expresses time in frames without saying so, detect it.
    if (Number.isFinite(start) && start > 900) {
      start = start / fps;
    }
    if (Number.isFinite(duration) && duration > 900) {
      duration = duration / fps;
    }
    if (!Number.isFinite(start)) {
      start = cursor;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = 20;
    }

    const captionRaw = scene.caption ?? scene.captions ?? scene.onScreenText ?? scene.on_screen_text ?? '';
    const caption = Array.isArray(captionRaw)
      ? captionRaw.filter((line) => typeof line === 'string' && line.trim()).join('\n')
      : firstString(captionRaw);
    const vo = firstString(scene.vo, scene.voiceover, scene.voiceOver, scene.voice, scene.narration);

    let visualOffset = numberOr(
      scene.visualOffset ?? scene.visualOffsetSec ?? scene.jCut ?? scene.cutOffset,
      NaN,
    );
    if (!Number.isFinite(visualOffset)) {
      const jCut = firstString(scene.jCut, scene.cut, scene.transition).toLowerCase();
      if (/visual.?lead|picture.?lead|before/.test(jCut)) {
        visualOffset = -0.4;
      } else if (/voice.?lead|after|delay/.test(jCut)) {
        visualOffset = 0.4;
      } else {
        visualOffset = DEFAULT_VISUAL_OFFSET[id] ?? 0;
      }
    }
    // Accept millisecond offsets too.
    if (Math.abs(visualOffset) > 10) {
      visualOffset = visualOffset / 1000;
    }

    cursor = start + duration;
    return {
      id,
      originalId: rawId,
      start: Math.max(0, Number(start.toFixed(3))),
      duration: Math.max(0.5, Number(duration.toFixed(3))),
      chapter: firstString(scene.chapter, scene.label, scene.kicker) || `0${index + 1} — ${id}`,
      vo,
      caption: caption || vo,
      visual: firstString(scene.visual, id),
      tone: scene.tone === 'dark' || scene.tone === 'paper' ? scene.tone : SCENE_TONES[id] ?? 'paper',
      visualOffset: Number(visualOffset.toFixed(3)),
    };
  });
}

function buildScript() {
  // Prefer the v2 timeline. It reuses the existing v1 George VO lines but
  // re-times the scenes for the faster live cut. Fall back to v1 if absent.
  const v2File = path.join(projectRoot, 'script-v2.json');
  const v1File = path.join(projectRoot, 'script.json');
  const v2Source = readJson(v2File);
  const source = v2Source ?? readJson(v1File);
  if (!source) {
    throw new Error('script-v2.json and script.json could not be read.');
  }
  const sourceName = v2Source
    ? 'script-v2.json (v1 George VO timing)'
    : 'script.json (v1 structure + v1 George VO timing)';
  const fps = numberOr(source.fps, 30);
  const width = numberOr(source.width, 1920);
  const height = numberOr(source.height, 1080);
  const scenes = normaliseScenes(source.scenes, fps);
  const end = scenes.reduce((max, scene) => Math.max(max, scene.start + scene.duration), 0);
  const explicitDuration = numberOr(source.durationInFrames ?? source.durationFrames, NaN);
  const durationInFrames = Number.isFinite(explicitDuration)
    ? Math.round(explicitDuration)
    : Math.round(end * fps);
  return {
    version: 2,
    source: sourceName,
    title: firstString(source.title) || 'MEND — Maintenance with memory',
    fps,
    width,
    height,
    siteUrl: firstString(source.siteUrl),
    durationInFrames,
    durationSeconds: Number((durationInFrames / fps).toFixed(3)),
    scenes,
    disclosures: Array.isArray(source.disclosures) ? source.disclosures : [],
  };
}

function flattenCueSheet(cueSheet) {
  if (!cueSheet) {
    return [];
  }
  const out = [];
  const add = (cue, sceneHint) => {
    if (!cue || typeof cue !== 'object') {
      return;
    }
    const at = numberOr(
      cue.at ?? cue.time ?? cue.start ?? cue.startSec ?? cue.startSeconds ?? cue.seconds,
      NaN,
    );
    const frame = numberOr(cue.frame ?? cue.startFrame, NaN);
    if (!Number.isFinite(at) && !Number.isFinite(frame)) {
      return;
    }
    out.push({ ...cue, __sceneHint: sceneHint, __at: Number.isFinite(at) ? at : frame / 30, __frame: frame });
  };
  if (Array.isArray(cueSheet)) {
    cueSheet.forEach((cue) => add(cue));
  } else if (Array.isArray(cueSheet.cues)) {
    cueSheet.cues.forEach((cue) => add(cue));
  }
  if (cueSheet && Array.isArray(cueSheet.scenes)) {
    cueSheet.scenes.forEach((scene) => {
      const sceneHint = firstString(scene.id, scene.sceneId, scene.scene, scene.name);
      const cues = Array.isArray(scene.cues) ? scene.cues : [];
      cues.forEach((cue) => add(cue, sceneHint));
    });
  }
  return out;
}

function flattenVoiceWords(timeline) {
  if (!timeline) {
    return [];
  }
  const words = [];
  const addWord = (word, sceneHint, sceneStart) => {
    if (!word || typeof word !== 'object') {
      return;
    }
    const text = firstString(word.word, word.text, word.value);
    const start = numberOr(word.start ?? word.startSec ?? word.from, NaN);
    const end = numberOr(word.end ?? word.endSec ?? word.to, NaN);
    if (!text || !Number.isFinite(start)) {
      return;
    }
    words.push({
      text,
      start: sceneStart + start,
      end: sceneStart + (Number.isFinite(end) ? end : start + 0.25),
      sceneHint,
    });
  };
  if (Array.isArray(timeline.words)) {
    timeline.words.forEach((word) => addWord(word));
  }
  if (Array.isArray(timeline.scenes)) {
    timeline.scenes.forEach((scene) => {
      const sceneHint = firstString(scene.id, scene.sceneId, scene.scene, scene.name);
      const sceneStart = numberOr(scene.start ?? scene.startSec ?? scene.startSeconds, 0);
      const sceneWords = Array.isArray(scene.words) ? scene.words : [];
      sceneWords.forEach((word) => addWord(word, sceneHint, sceneStart));
    });
  }
  return words.sort((a, b) => a.start - b.start);
}

const FALLBACK_CUES = {};

function normaliseCues(script, cueSheet, timeline) {
  const fps = script.fps;
  const flat = flattenCueSheet(cueSheet);
  const words = flattenVoiceWords(timeline);
  const sceneById = new Map(script.scenes.map((scene) => [scene.id, scene]));
  const result = [];
  const used = new Set();

  const pushCue = (cue) => {
    const key = `${cue.sceneId}:${cue.at.toFixed(3)}:${cue.id}`;
    if (used.has(key)) {
      return;
    }
    used.add(key);
    result.push(cue);
  };

  for (let i = 0; i < flat.length; i += 1) {
    const raw = flat[i];
    let sceneId = canonicalSceneId(
      firstString(raw.sceneId, raw.scene, raw.scene_id, raw.__sceneHint),
      -1,
      -1,
    );
    if (!sceneById.has(sceneId)) {
      const at = raw.__at;
      const found = script.scenes.find((scene) => at >= scene.start && at < scene.start + scene.duration);
      sceneId = found ? found.id : script.scenes[0]?.id ?? 'hook';
    }
    const scene = sceneById.get(sceneId);
    const at = Number.isFinite(raw.__at) ? raw.__at : (raw.__frame ?? 0) / fps;
    const relative = scene ? Math.max(0, at - scene.start) : at;
    const id = firstString(raw.id, raw.cueId, raw.name, raw.slug) || `${sceneId}.${result.filter((cue) => cue.sceneId === sceneId).length + 1}`;
    pushCue({
      id,
      sceneId,
      at: Number(relative.toFixed(3)),
      absolute: Number(at.toFixed(3)),
      frame: Math.round(relative * fps),
      absoluteFrame: Math.round(at * fps),
      kind: firstString(raw.kind, raw.type, raw.action, raw.role) || 'cue',
      label: firstString(raw.label, raw.title, raw.text, raw.description),
    });
  }

  // If a cue sheet exists but has only a handful of cues, enrich each scene
  // with the fallback semantic beats so every scene still has motion triggers.
  const perScene = new Map();
  for (const cue of result) {
    const list = perScene.get(cue.sceneId) ?? [];
    list.push(cue);
    perScene.set(cue.sceneId, list);
  }

  for (const scene of script.scenes) {
    const existing = (perScene.get(scene.id) ?? []).sort((a, b) => a.at - b.at);
    const fallback = FALLBACK_CUES[scene.id] ?? [];
    const needed = fallback.length;
    const useFallback = existing.length < Math.min(3, needed);
    if (!useFallback && existing.length > 0) {
      continue;
    }
    const sceneWords = words.filter((word) => {
      if (word.sceneHint) {
        return canonicalSceneId(word.sceneHint, -1, -1) === scene.id;
      }
      return word.start >= scene.start && word.start < scene.start + scene.duration;
    });
    const base = existing.length > 0 ? existing : [];
    fallback.forEach(([id, fraction, kind, label], index) => {
      if (base.some((cue) => cue.id === id)) {
        return;
      }
      // Map the fallback fraction onto a spoken word when a voice timeline is
      // available, otherwise use the scene's nominal duration.
      let relative = fraction * scene.duration;
      if (sceneWords.length > 0) {
        const target = scene.start + relative;
        const closest = sceneWords.reduce((best, word) =>
          Math.abs(word.start - target) < Math.abs(best.start - target) ? word : best,
        );
        relative = Math.max(0, closest.start - scene.start);
      }
      pushCue({
        id,
        sceneId: scene.id,
        at: Number(relative.toFixed(3)),
        absolute: Number((scene.start + relative).toFixed(3)),
        frame: Math.round(relative * fps),
        absoluteFrame: Math.round((scene.start + relative) * fps),
        kind,
        label,
        synthetic: true,
      });
    });
  }

  result.sort((a, b) => a.absolute - b.absolute);
  const scenes = {};
  for (const scene of script.scenes) {
    scenes[scene.id] = result.filter((cue) => cue.sceneId === scene.id);
  }
  const source = flat.length > 0 ? 'cue-sheet.json' : words.length > 0 ? 'voice-timeline.json + fallback beats' : 'script timing (fallback)';
  return {
    version: 2,
    source,
    fps,
    cues: result,
    scenes,
  };
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

function wordsFromAlignment(alignment) {
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const text = chars.join('');
  const words = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(text)) !== null) {
    const first = match.index;
    const last = match.index + match[0].length - 1;
    if (starts[first] == null || ends[last] == null) {
      continue;
    }
    words.push({
      word: match[0],
      start: starts[first],
      end: ends[last],
    });
  }
  return words;
}

function loadV1Words(scene) {
  const file = path.join(publicDir, 'audio', 'vo', `${scene.id}.timestamps.json`);
  const data = readJson(file);
  if (!data) {
    return { words: [], duration: scene.duration * 0.7, data: null, file };
  }
  let words = [];
  if (Array.isArray(data.words) && data.words.length > 0) {
    words = data.words
      .filter((word) => word && typeof word.word === 'string')
      .map((word) => ({
        word: word.word,
        start: numberOr(word.start, 0),
        end: numberOr(word.end, numberOr(word.start, 0) + 0.2),
      }));
  } else if (data.alignment?.characters) {
    words = wordsFromAlignment(data.alignment);
  } else if (data.normalized_alignment?.characters) {
    words = wordsFromAlignment(data.normalized_alignment);
  }
  const alignmentEnd =
    data.alignment?.character_end_times_seconds?.at(-1) ??
    data.normalized_alignment?.character_end_times_seconds?.at(-1);
  const duration =
    Number.isFinite(data.duration_seconds) && data.duration_seconds > 0
      ? data.duration_seconds
      : Number.isFinite(alignmentEnd) && alignmentEnd > 0
        ? alignmentEnd
        : Math.max(0.5, ...words.map((word) => word.end));
  return { words, duration, data, file };
}

const normaliseWord = (value) =>
  value.toLowerCase().replaceAll('’', "'").replace(/[^\p{L}\p{N}]+/gu, '');

/** Finds the first word of a phrase in the v1 word alignment. */
function phraseStart(words, phrase) {
  const phraseKey = normaliseWord(phrase);
  if (!phraseKey) {
    return null;
  }
  for (let index = 0; index < words.length; index += 1) {
    let accumulated = '';
    for (let cursor = index; cursor < words.length; cursor += 1) {
      accumulated += normaliseWord(words[cursor].word);
      if (accumulated === phraseKey) {
        return words[index].start;
      }
      if (!phraseKey.startsWith(accumulated)) {
        break;
      }
    }
  }
  return null;
}

/**
 * Builds cue-sheet-equivalent timing from the existing v1 George VO. No v2
 * synthesis and no script-v2 timing is used.
 */
function buildV1Cues(script) {
  const fps = script.fps;
  const cues = [];
  const perScene = {};
  const warnings = [];
  let voiceMeta = null;

  for (const scene of script.scenes) {
    const { words, duration, data } = loadV1Words(scene);
    if (data && !voiceMeta) {
      voiceMeta = {
        source: 'v1',
        provider: 'elevenlabs',
        name: data.voice_name ?? 'George',
        voiceId: data.voice_id ?? null,
        model: data.model_id ?? null,
        note: 'Existing v1 George render. Cues are derived from the v1 with-timestamps alignment; no v2 synthesis was performed.',
      };
    }
    const specs = V1_CUE_SPECS[scene.id] ?? [];
    const sceneCues = specs.map((spec) => {
      const found = phraseStart(words, spec.phrase);
      let at = found;
      if (at == null) {
        at = spec.fraction * duration;
        warnings.push(`${scene.id}: phrase not found: "${spec.phrase}"`);
      }
      at = Math.max(0, Math.min(scene.duration - 0.05, at));
      return {
        id: spec.id,
        sceneId: scene.id,
        at: Number(at.toFixed(3)),
        absolute: Number((scene.start + at).toFixed(3)),
        frame: Math.round(at * fps),
        absoluteFrame: Math.round((scene.start + at) * fps),
        kind: spec.kind,
        label: spec.label,
        phrase: spec.phrase,
        source: found == null ? 'fraction-fallback' : 'v1-george-alignment',
      };
    });
    // Chronological order keeps index-based cues intuitive in the scenes.
    sceneCues.sort((a, b) => a.at - b.at);
    perScene[scene.id] = sceneCues;
    cues.push(...sceneCues);
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[mend-ad:v2] cue warning: ${warning}`);
    }
  }

  return {
    version: 2,
    source: 'v1 George VO timestamps',
    fps,
    voice: voiceMeta ?? {
      source: 'v1',
      provider: 'elevenlabs',
      name: 'George',
      note: 'Existing v1 George render.',
    },
    cues,
    scenes: perScene,
  };
}

function main() {
  const script = buildScript();
  const cues = buildV1Cues(script);

  fs.mkdirSync(v2Dir, { recursive: true });
  const publicFiles = walk(publicDir).sort((a, b) => a.localeCompare(b));
  const characterFiles = walk(path.join(srcDir, 'characters')).sort((a, b) => a.localeCompare(b));

  const wrote = [
    writeJson(path.join(v2Dir, 'script.generated.json'), script),
    writeJson(path.join(v2Dir, 'cues.generated.json'), cues),
    writeJson(path.join(v2Dir, 'asset-manifest.json'), { files: publicFiles }),
    writeJson(path.join(v2Dir, 'characters.generated.json'), {
      source: characterFiles.length > 0 ? 'src/characters' : 'missing',
      files: characterFiles,
    }),
  ].filter(Boolean).length;

  const live = publicFiles.filter((file) => file.startsWith('assets/live/'));
  console.log(`[mend-ad:v2] script: ${script.source} (${script.scenes.length} scenes, ${script.durationInFrames} frames)`);
  console.log(`[mend-ad:v2] cues: ${cues.source} (${cues.cues.length} cues)`);
  console.log(`[mend-ad:v2] live assets: ${live.length} file(s)`);
  console.log(`[mend-ad:v2] characters: ${characterFiles.length} file(s)`);
  console.log(`[mend-ad:v2] wrote ${wrote} generated file(s) to src/v2/`);
}

main();
