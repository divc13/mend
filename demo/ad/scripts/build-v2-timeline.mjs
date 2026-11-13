import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const adDir = path.join(root, 'demo/ad');
const scriptPath = path.join(adDir, 'script-v2.json');
const outDir = path.join(adDir, 'public/audio/v2');
const sfxManifestPath = path.join(outDir, 'sfx/sfx-manifest.json');

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const voiceSource = script.voice?.source === 'v1' ? 'v1' : 'v2';
const voDir =
  voiceSource === 'v1'
    ? path.join(adDir, 'public/audio/vo')
    : path.join(adDir, 'public/audio/v2/vo');
const sfxManifest = JSON.parse(fs.readFileSync(sfxManifestPath, 'utf8'));
const sfxById = Object.fromEntries(sfxManifest.files.map((f) => [f.id, f]));

const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

function round(value, places = 3) {
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

function normalizeWord(value) {
  return value.toLowerCase().replaceAll('’', "'");
}

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
    if (starts[first] == null || ends[last] == null) continue;
    words.push({
      word: match[0],
      start: round(starts[first]),
      end: round(ends[last]),
      charStart: first,
      charEnd: last + 1,
    });
  }
  return words;
}

function loadWords(scene) {
  const file = path.join(voDir, `${scene.id}.timestamps.json`);
  if (!fs.existsSync(file)) throw new Error(`missing timestamps: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  let words;
  if (Array.isArray(data.words) && data.words.length > 0) {
    words = data.words.map((w) => ({
      word: w.word,
      start: round(w.start),
      end: round(w.end),
      charStart: w.charStart ?? null,
      charEnd: w.charEnd ?? null,
    }));
  } else if (data.alignment) {
    words = wordsFromAlignment(data.alignment);
  } else if (data.normalized_alignment) {
    words = wordsFromAlignment(data.normalized_alignment);
  } else {
    throw new Error(`no words or alignment in ${file}`);
  }

  const expected = [...scene.vo.matchAll(WORD_RE)].length;
  if (words.length !== expected) {
    throw new Error(
      `${scene.id}: timestamp words ${words.length} != script words ${expected}; refusing to build a drifting cue sheet`,
    );
  }
  const alignmentEnd =
    data.alignment?.character_end_times_seconds?.at(-1) ??
    data.normalized_alignment?.character_end_times_seconds?.at(-1);
  const duration =
    Number.isFinite(data.duration_seconds) && data.duration_seconds > 0
      ? data.duration_seconds
      : Number.isFinite(alignmentEnd) && alignmentEnd > 0
        ? alignmentEnd
        : Math.max(...words.map((w) => w.end));
  return { data, words, file, duration };
}

const sceneTimelines = script.scenes.map((scene) => {
  const { data, words, file, duration } = loadWords(scene);
  const voStart = round(scene.start + scene.voOffset);
  const voEnd = round(voStart + duration);
  const absoluteWords = words.map((w, i) => ({
    i: i + 1,
    word: w.word,
    start: w.start,
    end: w.end,
    absStart: round(voStart + w.start),
    absEnd: round(voStart + w.end),
  }));

  return {
    id: scene.id,
    chapter: scene.chapter,
    start: scene.start,
    duration: scene.duration,
    end: scene.start + scene.duration,
    voOffset: scene.voOffset,
    voStart,
    voEnd,
    voDuration: round(duration),
    gapBeforeNext:
      scene.id === script.scenes.at(-1).id
        ? round(scene.start + scene.duration - voEnd)
        : round(
            script.scenes[script.scenes.findIndex((s) => s.id === scene.id) + 1].start -
              voEnd,
          ),
    text: scene.vo,
    wordCount: words.length,
    words: absoluteWords,
    firstWord: absoluteWords[0] ?? null,
    lastWord: absoluteWords.at(-1) ?? null,
    source: path.relative(root, file),
    audio: path.relative(root, path.join(voDir, `${scene.id}.mp3`)),
    provider:
      data.provider ?? (voiceSource === 'v1' ? 'elevenlabs_v1_reuse' : 'elevenlabs'),
    voice:
      voiceSource === 'v1'
        ? script.voice.name
        : data.voice_name ?? data.voice_id ?? null,
  };
});

const firstData = JSON.parse(
  fs.readFileSync(path.join(voDir, `${script.scenes[0].id}.timestamps.json`), 'utf8'),
);

const totalWords = sceneTimelines.reduce((sum, s) => sum + s.wordCount, 0);
const speechSeconds = round(
  sceneTimelines.reduce((sum, s) => sum + s.voDuration, 0),
);
const allScenesFit = sceneTimelines.every((s) => s.voEnd <= s.end + 0.001);
const gaps = sceneTimelines.slice(0, -1).map((s) => s.gapBeforeNext);

const voiceTimeline = {
  version: 1,
  generatedAt: new Date().toISOString(),
  runtimeSeconds: script.runtimeSeconds,
  fps: script.fps,
  voice: {
    provider:
      voiceSource === 'v1'
        ? 'elevenlabs_v1_reuse'
        : firstData.provider ?? 'elevenlabs',
    name: voiceSource === 'v1' ? script.voice.name : firstData.voice_name ?? firstData.voice_id,
    voiceId: firstData.voice_id,
    model: firstData.model_id,
    outputFormat: firstData.output_format,
    sampleRate: firstData.sample_rate ?? (voiceSource === 'v1' ? 44100 : null),
    source: voiceSource,
    intended: script.voice,
    status: voiceSource === 'v1' ? 'final_v1_george_reuse' : 'generated',
    note:
      voiceSource === 'v1'
        ? 'Final voice is the existing v1 ElevenLabs George render. No v2 synthesis was performed. Word times come from the v1 with-timestamps alignment; scene starts and voOffset come from script-v2.json.'
        : 'ElevenLabs with-timestamps alignment.',
  },
  timingModel: {
    sceneStart: 'absolute seconds from script-v2.json',
    voStart: 'scene.start + scene.voOffset (negative = J-cut)',
    wordAbsolute: 'voStart + word.start',
    cueAbsolute: 'voStart + word.start + cue.offset',
  },
  scenes: sceneTimelines,
  totals: {
    scenes: sceneTimelines.length,
    words: totalWords,
    speechSeconds,
    runtimeSeconds: script.runtimeSeconds,
    speechDensity: round(speechSeconds / script.runtimeSeconds),
    cueCount: script.scenes.reduce((sum, s) => sum + s.cues.length, 0),
    voOffsetRange: [
      Math.min(...script.scenes.map((s) => s.voOffset)),
      Math.max(...script.scenes.map((s) => s.voOffset)),
    ],
    allScenesFit,
    minGapBeforeNext: Math.min(...gaps),
  },
};

fs.writeFileSync(
  path.join(outDir, 'voice-timeline.json'),
  `${JSON.stringify(voiceTimeline, null, 2)}\n`,
);

const SFX_PLAN = {
  whoosh: { gainDb: -12, note: 'short transition / J-cut wash' },
  'ui-click': { gainDb: -10, note: 'dry UI tick' },
  'camera-shutter': { gainDb: -5, note: 'hero live-action accent' },
  'dao-stamp': { gainDb: -8, note: 'authorization / acceptance thud' },
  cash: { gainDb: -10, note: 'payment split accent' },
  'page-turn': { gainDb: -10, note: 'ledger / passport scroll' },
};

const ACTION_SFX = {
  'camera-shutter': 'camera-shutter',
  establish: 'whoosh',
  'near-miss': 'whoosh',
  'phone-raise': 'ui-click',
  'budget-set': 'ui-click',
  'award-receipt': 'dao-stamp',
  'receipt-stamp': 'dao-stamp',
  'hold-logo': 'whoosh',
  'app-open': 'whoosh',
  'photo-attach': 'ui-click',
  'report-typing': 'ui-click',
  'exif-strip': 'whoosh',
  'duplicate-scan': 'ui-click',
  'ai-suggest': 'ui-click',
  'authority-lock': 'ui-click',
  'work-order-merge': 'whoosh',
  'case-open': 'whoosh',
  'steward-scope': 'ui-click',
  'chain-lock': 'ui-click',
  'council-vote': 'ui-click',
  'dao-stamp': 'dao-stamp',
  'receipt-mint': 'dao-stamp',
  'bids-seal': 'whoosh',
  'window-close': 'whoosh',
  'score-reveal': 'ui-click',
  'winner-b': 'dao-stamp',
  'policy-hash': 'ui-click',
  'crew-arrive': 'whoosh',
  'evidence-hash': 'ui-click',
  'inspector-enter': 'whoosh',
  'checklist-fill': 'ui-click',
  'inspector-accept': 'dao-stamp',
  signature: 'ui-click',
  'funding-bar': 'ui-click',
  refund: 'cash',
  acceptance: 'ui-click',
  'contractor-paid': 'cash',
  holdback: 'cash',
  'case-scroll': 'page-turn',
  'receipt-open': 'page-turn',
  'leverage-chip': 'ui-click',
  'passport-open': 'page-turn',
  'reopen-work-order': 'whoosh',
  'history-scroll': 'page-turn',
  'no-new-bounty': 'ui-click',
  'passport-stamp': 'dao-stamp',
  'payment-ledger': 'page-turn',
  'how-it-works-open': 'whoosh',
  'testnet-badge': 'ui-click',
  'replay-badge': 'ui-click',
  'real-badge': 'ui-click',
  'contract-call': 'ui-click',
  'dao-vote-proof': 'ui-click',
  'agent-market': 'ui-click',
  'receipt-verify': 'ui-click',
  'phone-lower': 'ui-click',
  'end-card': 'whoosh',
  'logo-lockup': 'whoosh',
};

function sfxFor(action) {
  const id = ACTION_SFX[action];
  if (!id) return null;
  const file = sfxById[id];
  if (!file) throw new Error(`SFX id ${id} not in manifest`);
  return {
    id,
    file: `sfx/${file.file}`,
    gainDb: SFX_PLAN[id].gainDb,
    note: SFX_PLAN[id].note,
    license: file.license,
  };
}

const cues = [];
let cueNumber = 0;
for (const scene of script.scenes) {
  const timeline = sceneTimelines.find((s) => s.id === scene.id);
  for (const cue of scene.cues) {
    const target = normalizeWord(cue.at);
    const matches = timeline.words.filter((w) => normalizeWord(w.word) === target);
    const occurrence = cue.occurrence ?? 1;
    if (matches.length < occurrence) {
      throw new Error(
        `${scene.id}: cue "${cue.at}" occurrence ${occurrence} not found (${matches.length} matches)`,
      );
    }
    const word = matches[occurrence - 1];
    const offset = cue.offset ?? 0;
    const time = round(timeline.voStart + word.start + offset);
    if (time < 0 || time > script.runtimeSeconds) {
      throw new Error(`${scene.id}: cue ${cue.action} time ${time} outside 0-300`);
    }
    cueNumber += 1;
    cues.push({
      n: cueNumber,
      sceneId: scene.id,
      chapter: scene.chapter,
      action: cue.action,
      actor: cue.actor ?? null,
      // `at` is numeric absolute seconds for the existing v2 audio mixer.
      // `anchor` preserves the spoken word from script-v2.json.
      at: time,
      anchor: cue.at,
      anchorOccurrence: occurrence,
      occurrence,
      wordIndex: word.i,
      word: word.word,
      wordStart: word.start,
      wordEnd: word.end,
      absoluteWordStart: word.absStart,
      absoluteWordEnd: word.absEnd,
      offset,
      time,
      sceneTime: round(time - scene.start),
      voTime: round(word.start + offset),
      sfx: sfxFor(cue.action),
      note: cue.note ?? null,
    });
  }
}

// The script lists cues in semantic order; the sheet must be chronological.
cues.sort((a, b) => a.time - b.time || a.sceneId.localeCompare(b.sceneId));
cues.forEach((cue, index) => {
  cue.n = index + 1;
});

const byScene = {};
for (const scene of script.scenes) {
  const sceneCues = cues.filter((c) => c.sceneId === scene.id);
  byScene[scene.id] = {
    count: sceneCues.length,
    firstTime: sceneCues[0]?.time ?? null,
    lastTime: sceneCues.at(-1)?.time ?? null,
    actions: sceneCues.map((c) => c.action),
  };
}

const cueSheet = {
  version: 1,
  generatedAt: new Date().toISOString(),
  runtimeSeconds: script.runtimeSeconds,
  source: {
    script: 'demo/ad/script-v2.json',
    timeline: 'demo/ad/public/audio/v2/voice-timeline.json',
    sfxManifest: 'demo/ad/public/audio/v2/sfx/sfx-manifest.json',
  },
  cueCount: cues.length,
  cues,
  byScene,
  sfxPlan: {
    defaultGainDb: -10,
    duckMusicDb: -6,
    notes: [
      'Times are absolute seconds from the start of the 5:00 cut.',
      'sceneTime is relative to the scene start; voTime is relative to the VO start (which may be a J-cut).',
      'Negative voOffset means the VO starts before the scene picture; the first cue in a scene can therefore land before its scene.start.',
      'SFX gain is relative to the mastered VO/music mix; adjust per playback and keep UI ticks under the narration.',
    ],
    files: sfxManifest.files.map((f) => ({
      id: f.id,
      file: `sfx/${f.file}`,
      durationSeconds: f.durationSeconds,
      license: f.license,
      source: f.source,
    })),
  },
  totals: {
    scenes: script.scenes.length,
    cues: cues.length,
    cuesWithSfx: cues.filter((c) => c.sfx).length,
    words: totalWords,
    allScenesFit,
  },
};

fs.writeFileSync(
  path.join(outDir, 'cue-sheet.json'),
  `${JSON.stringify(cueSheet, null, 2)}\n`,
);

// Compatibility manifest for scripts/demo/build-audio-mix-v2.mjs, which reads
// public/audio/v2/sfx-manifest.json and expects `entries` with name/at/volume.
// The canonical, human-readable manifest stays at sfx/sfx-manifest.json.
const mixEntries = cues
  .filter((cue) => cue.sfx)
  .map((cue) => ({
    name: cue.sfx.id,
    at: cue.time,
    volume: round(10 ** (cue.sfx.gainDb / 20), 3),
    gainDb: cue.sfx.gainDb,
    cue: `${cue.sceneId}.${cue.action}`,
    sceneId: cue.sceneId,
    action: cue.action,
    file: cue.sfx.file,
    license: cue.sfx.license,
  }));

const mixManifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  canonical: 'sfx/sfx-manifest.json',
  source: 'Synthesized locally with FFmpeg lavfi; no third-party samples. See sfx/sfx-manifest.json.',
  license: 'CC0-1.0 (original synthesis)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  note: 'Compatibility entries for scripts/demo/build-audio-mix-v2.mjs. Regenerate with build-v2-timeline.mjs; do not hand-edit.',
  entries: mixEntries,
};

fs.writeFileSync(
  path.join(outDir, 'sfx-manifest.json'),
  `${JSON.stringify(mixManifest, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      voiceTimeline: path.relative(root, path.join(outDir, 'voice-timeline.json')),
      cueSheet: path.relative(root, path.join(outDir, 'cue-sheet.json')),
      sfxMixManifest: path.relative(root, path.join(outDir, 'sfx-manifest.json')),
      scenes: voiceTimeline.scenes.length,
      words: totalWords,
      speechSeconds,
      speechDensity: voiceTimeline.totals.speechDensity,
      allScenesFit,
      minGapBeforeNext: voiceTimeline.totals.minGapBeforeNext,
      cues: cues.length,
      cuesWithSfx: cueSheet.totals.cuesWithSfx,
    },
    null,
    2,
  ),
);
