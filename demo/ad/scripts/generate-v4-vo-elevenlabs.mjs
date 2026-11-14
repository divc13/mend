#!/usr/bin/env node
// Generate the nine v4 Liam VO files and rebuild the v4 timing artifacts.
//
// Usage:
//   set -a; . ./.env; set +a
//   node demo/ad/scripts/generate-v4-vo-elevenlabs.mjs
//
// The API key is read from ELEVEN_LABS_API_KEY and is never printed.
// Each scene is synthesized with with-timestamps. Files are written to a temp
// directory first; existing v4 files are replaced only after every scene passes.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const root = fileURLToPath(new URL('../../..', import.meta.url));
const adDir = path.join(root, 'demo/ad');
const scriptPath = path.join(adDir, 'script-v4.json');
const outDir = path.join(adDir, 'public/audio/v4');
const voDir = path.join(outDir, 'vo');
const tmpDir = path.join(voDir, '.elevenlabs-v4-tmp');

const key = process.env.ELEVEN_LABS_API_KEY;
if (!key) {
  console.error('ELEVEN_LABS_API_KEY is not set. Load .env first.');
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const voice = script.voice;
const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

const round = (value, places = 3) => {
  const m = 10 ** places;
  return Math.round(value * m) / m;
};
const normalize = (value) => value.toLowerCase().replaceAll('’', "'");
const words = (text) => {
  WORD_RE.lastIndex = 0;
  return [...text.matchAll(WORD_RE)].map((m) => m[0]);
};

function audioDuration(file) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = result.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`could not read audio duration for ${file}`);
  return round(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
}

function wordsFromAlignment(alignment) {
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const text = chars.join('');
  const found = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(text)) !== null) {
    const first = match.index;
    const last = match.index + match[0].length - 1;
    if (starts[first] == null || ends[last] == null) continue;
    found.push({
      word: match[0],
      start: round(starts[first]),
      end: round(ends[last]),
      charStart: first,
      charEnd: last + 1,
    });
  }
  return found;
}

// Exact text alignment is the normal case. If ElevenLabs normalises a token
// (numbers, V2, NEP-366), LCS-match the written words to aligned words and
// interpolate only the unmatched runs.
function alignWords(written, aligned, duration) {
  const a = written.map(normalize);
  const b = aligned.map((w) => normalize(w.word));
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  pairs.reverse();

  const times = new Array(written.length);
  for (const [wi, ai] of pairs) {
    times[wi] = { start: aligned[ai].start, end: aligned[ai].end };
  }

  const known = times.map((t, index) => (t ? index : null)).filter((v) => v !== null);
  const firstKnown = known[0] ?? null;
  const lastKnown = known.at(-1) ?? null;
  if (firstKnown !== null && firstKnown > 0) {
    const end = times[firstKnown].start;
    for (let k = 0; k < firstKnown; k += 1) {
      times[k] = {
        start: round((end * k) / firstKnown),
        end: round((end * (k + 1)) / firstKnown),
      };
    }
  }
  if (lastKnown !== null && lastKnown < times.length - 1) {
    const start = times[lastKnown].end;
    const count = times.length - 1 - lastKnown;
    for (let k = 1; k <= count; k += 1) {
      times[lastKnown + k] = {
        start: round(start + ((duration - start) * (k - 1)) / count),
        end: round(start + ((duration - start) * k) / count),
      };
    }
  }
  for (let k = 0; k < times.length; k += 1) {
    if (times[k]) continue;
    let prev = k - 1;
    while (prev >= 0 && !times[prev]) prev -= 1;
    let next = k + 1;
    while (next < times.length && !times[next]) next += 1;
    const start = prev >= 0 ? times[prev].end : 0;
    const end = next < times.length ? times[next].start : duration;
    const count = next - prev - 1;
    const slot = k - prev - 1;
    times[k] = {
      start: round(start + ((end - start) * slot) / Math.max(1, count)),
      end: round(start + ((end - start) * (slot + 1)) / Math.max(1, count)),
    };
  }

  let cursor = 0;
  return written.map((word, index) => {
    const t = times[index];
    const start = Math.max(cursor, t.start);
    const end = Math.max(start, t.end);
    cursor = end;
    return { word, start: round(start), end: round(end), charStart: null, charEnd: null };
  });
}

async function subscription() {
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': key },
  });
  if (!res.ok) return null;
  return res.json();
}

async function synthesize(scene) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}/with-timestamps?output_format=${voice.outputFormat}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      text: scene.vo,
      model_id: voice.model,
      voice_settings: voice.settings,
    }),
  });
  const raw = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    let detail = raw.toString('utf8');
    try {
      detail = JSON.stringify(JSON.parse(detail));
    } catch {}
    throw new Error(`${scene.id}: HTTP ${res.status} ${detail}`);
  }
  const data = JSON.parse(raw.toString('utf8'));
  if (!data.audio_base64 || !data.alignment) {
    throw new Error(`${scene.id}: response missing audio_base64 or alignment`);
  }
  return {
    audio: Buffer.from(data.audio_base64, 'base64'),
    alignment: data.alignment,
    normalized: data.normalized_alignment ?? null,
  };
}

const CUE_PLAN = {
  hook: [
    { at: 'pothole', action: 'establish', note: 'Open on the pothole everyone avoids' },
    { at: 'cyclist', action: 'near-miss', note: 'Raise the stakes: a near miss' },
    { at: 'starting', action: 'turn', note: 'You decide to act' },
  ],
  report: [
    { at: 'photo', action: 'privacy', note: 'A photo can reveal route, school, plate' },
    { at: 'browser', action: 'exif-strip', note: 'EXIF + GPS erased before upload' },
    { at: 'tutor', action: 'private-ai', note: 'Private AI is a tutor, not an approver' },
    { at: 'authority', action: 'authority-lock', note: 'No wallet, approval or payment authority' },
    { at: 'decide', action: 'human-decision', note: 'Humans decide' },
    { at: 'Fastify', action: 'ledger', note: 'Town clerk + ledger' },
  ],
  dao: [
    { at: 'Sputnik', action: 'committee', note: 'Sputnik DAO committee' },
    { at: 'Two', action: 'vote', note: '2 of 3 human votes' },
    { at: 'escrow', action: 'lockbox', note: 'Rust escrow lockbox' },
    { at: 'receipt', action: 'receipt', note: 'Every decision has a receipt' },
  ],
  bids: [
    { at: 'referee', action: 'score-rule', note: 'One hash-pinned scoring rule' },
    { at: 'OutLayer', action: 'outlayer', note: 'OutLayer is the referee' },
    { at: 'policy', action: 'policy-check', note: 'The policy is checkable' },
  ],
  repair: [
    { at: 'inspector', action: 'outside-inspector', note: 'A different human inspects' },
    { at: 'signature', action: 'signature', note: 'Checklist, evidence, signature' },
    { at: 'pays', action: 'lockbox-pay', note: 'Lockbox pays after the signature' },
  ],
  payment: [
    { at: 'hundred', action: 'funded', note: '100 funded' },
    { at: 'Twenty', action: 'refund', note: '20 refunded at award' },
    { at: 'Seventy-two', action: 'completion', note: '72 paid on acceptance' },
    { at: 'Eight', action: 'holdback', note: '8 held for durability' },
    { at: 'zero', action: 'escrow-zero', note: 'Escrow ends at zero' },
  ],
  passport: [
    { at: 'passport', action: 'passport-open', note: 'The asset gets a passport' },
    { at: 'history', action: 'same-history', note: 'Same case, same history' },
    { at: 'bounty', action: 'no-new-money', note: 'No new bounty, no new money' },
  ],
  tech: [
    { at: 'front', action: 'front-door', note: 'Next.js + React front door' },
    { at: 'clerk', action: 'town-clerk', note: 'Fastify + Postgres clerk and ledger' },
    { at: 'tutor', action: 'private-tutor', note: 'NEAR AI private tutor' },
    { at: 'lockbox', action: 'lockbox', note: 'Rust escrow lockbox' },
    { at: 'committee', action: 'committee', note: 'Sputnik committee' },
    { at: 'referee', action: 'referee', note: 'OutLayer referee' },
    { at: 'stamp', action: 'free-stamp', note: 'NEP-366 free stamp' },
    { at: 'inspector', action: 'outside-inspector', note: 'Agent Market outside inspector' },
    { at: '42', action: 'tx-count', note: '42 recorded testnet transactions' },
    { at: 'replay', action: 'honesty-replay', note: 'Replay/simulation story' },
    { at: 'receipt', action: 'receipts', note: 'Every payment and vote has a receipt' },
  ],
  close: [
    { at: 'memory', action: 'brand', note: 'Maintenance with memory' },
    { at: 'mend-demo.vercel.app', action: 'url', note: 'Live demo URL' },
    { at: 'fixed', occurrence: 2, action: 'end-card', note: 'Get it fixed. Keep it fixed.' },
  ],
};

const STACK_CUE_INDEX = {
  hook: { pothole: 0 },
  report: { browser: 0, tutor: 1, Fastify: 2 },
  dao: { Sputnik: 0, escrow: 1, Two: 0 },
  bids: { referee: 0, OutLayer: 0 },
  repair: { inspector: 0, pays: 1 },
  payment: { hundred: 0 },
  passport: { passport: 1, history: 0 },
  tech: {
    front: 0,
    clerk: 1,
    tutor: 2,
    lockbox: 3,
    committee: 4,
    referee: 5,
    stamp: 6,
    inspector: 7,
    42: 8,
  },
  close: { memory: 0 },
};

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const before = await subscription();
const generated = [];
const results = [];

try {
  for (const scene of script.scenes) {
    process.stdout.write(`generating ${scene.id} ... `);
    const { audio, alignment, normalized } = await synthesize(scene);
    const audioPath = path.join(tmpDir, `${scene.id}.mp3`);
    fs.writeFileSync(audioPath, audio);
    const duration = audioDuration(audioPath);
    const written = words(scene.vo);
    const aligned = wordsFromAlignment(alignment);
    if (aligned.length === 0) throw new Error(`${scene.id}: empty alignment`);
    const timedWords =
      aligned.length === written.length &&
      aligned.every((word, index) => normalize(word.word) === normalize(written[index]))
        ? aligned.map((word, index) => ({ ...word, word: written[index] }))
        : alignWords(written, aligned, duration);
    if (timedWords.length !== written.length) {
      throw new Error(`${scene.id}: timestamp words ${timedWords.length} != script words ${written.length}`);
    }
    const sceneDuration = round(duration + scene.handoff);
    generated.push({
      id: scene.id,
      audio,
      duration,
      sceneDuration,
      voOffset: scene.voOffset ?? 0,
      words: timedWords,
      alignment,
      normalized,
    });
    results.push({ id: scene.id, duration, sceneDuration, words: timedWords.length });
    console.log(`ok ${duration.toFixed(3)}s, ${timedWords.length} words`);
  }

  let cursor = 0;
  const scenes = script.scenes.map((scene, index) => {
    const result = generated[index];
    const start = round(cursor);
    const sceneDuration = result.sceneDuration;
    cursor = round(start + sceneDuration);
    const voStart = round(start + result.voOffset);
    const voEnd = round(voStart + result.duration);
    if (voEnd > start + sceneDuration + 0.001) {
      throw new Error(`${scene.id}: VO ends after scene`);
    }
    return {
      ...scene,
      start,
      duration: result.duration,
      voDuration: result.duration,
      sceneDuration,
      voOffset: result.voOffset,
      voStart,
      voEnd,
      end: round(start + sceneDuration),
    };
  });
  const total = round(cursor);

  // Replace the final audio and timestamp files only after every scene passed.
  for (let index = 0; index < script.scenes.length; index += 1) {
    const scene = script.scenes[index];
    const result = generated[index];
    const voStart = scenes[index].voStart;
    fs.writeFileSync(path.join(voDir, `${scene.id}.mp3`), result.audio);
    const relativeWords = result.words.map((word, wordIndex) => ({
      word: word.word,
      start: word.start,
      end: word.end,
      charStart: word.charStart ?? null,
      charEnd: word.charEnd ?? null,
      absStart: round(voStart + word.start),
      absEnd: round(voStart + word.end),
      i: wordIndex + 1,
    }));
    fs.writeFileSync(
      path.join(voDir, `${scene.id}.timestamps.json`),
      `${JSON.stringify(
        {
          sceneId: scene.id,
          text: scene.vo,
          provider: 'elevenlabs',
          voice_id: voice.voiceId,
          voice_name: voice.name,
          model_id: voice.model,
          output_format: voice.outputFormat,
          settings: voice.settings,
          scene_start: scenes[index].start,
          scene_duration: scenes[index].sceneDuration,
          vo_offset: scenes[index].voOffset,
          duration_seconds: result.duration,
          alignment: result.alignment,
          normalized_alignment: result.normalized,
          words: relativeWords,
          quality_check: {
            word_count: relativeWords.length,
            expected_word_count: words(scene.vo).length,
            duration_seconds: result.duration,
            last_word_end: relativeWords.at(-1)?.end ?? null,
            vo_start: voStart,
            vo_end: scenes[index].voEnd,
            scene_end: scenes[index].end,
            fits_scene: scenes[index].voEnd <= scenes[index].end + 0.001,
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  const updatedScript = {
    ...script,
    durationSeconds: total,
    totalWords: scenes.reduce((sum, scene) => sum + words(scene.vo).length, 0),
    speechSeconds: round(scenes.reduce((sum, scene) => sum + scene.duration, 0)),
    generatedAt: new Date().toISOString(),
    scenes: scenes.map(({ voStart, voEnd, end, ...scene }) => scene),
  };
  fs.writeFileSync(scriptPath, `${JSON.stringify(updatedScript, null, 2)}\n`);

  const totalWords = updatedScript.totalWords;
  const speechSeconds = updatedScript.speechSeconds;
  const voiceTimeline = {
    version: 4,
    generatedAt: updatedScript.generatedAt,
    runtimeSeconds: total,
    fps: script.fps,
    voice: {
      provider: 'elevenlabs',
      name: voice.name,
      voiceId: voice.voiceId,
      model: voice.model,
      outputFormat: voice.outputFormat,
      settings: voice.settings,
      source: 'demo/ad/script-v4.json',
      status: 'generated',
      note: voice.note,
    },
    timingModel: {
      sceneStart: 'absolute seconds from script-v4.json',
      voStart: 'scene.start + scene.voOffset (0 = no J-cut)',
      wordAbsolute: 'voStart + word.start',
      handoff: 'sceneDuration = audio duration + 0.45s (close + 1.2s)',
    },
    scenes: scenes.map((scene) => {
      const result = generated.find((g) => g.id === scene.id);
      return {
        id: scene.id,
        chapter: scene.chapter,
        start: scene.start,
        duration: scene.duration,
        sceneDuration: scene.sceneDuration,
        end: scene.end,
        voOffset: scene.voOffset,
        voStart: scene.voStart,
        voEnd: scene.voEnd,
        voDuration: scene.voDuration,
        gapBeforeNext:
          scene.id === scenes.at(-1).id
            ? round(scene.end - scene.voEnd)
            : round(scenes[scenes.indexOf(scene) + 1].start - scene.voEnd),
        text: scene.vo,
        caption: scene.caption,
        stack: scene.stack,
        wordCount: result.words.length,
        words: result.words.map((word, index) => ({
          i: index + 1,
          word: word.word,
          start: word.start,
          end: word.end,
          absStart: round(scene.voStart + word.start),
          absEnd: round(scene.voStart + word.end),
        })),
        source: `demo/ad/public/audio/v4/vo/${scene.id}.timestamps.json`,
        audio: `demo/ad/public/audio/v4/vo/${scene.id}.mp3`,
      };
    }),
    totals: {
      scenes: scenes.length,
      words: totalWords,
      speechSeconds,
      runtimeSeconds: total,
      speechDensity: round(speechSeconds / total),
      audioSeconds: round(scenes.reduce((sum, scene) => sum + scene.duration, 0)),
      allScenesFit: scenes.every((scene) => scene.voEnd <= scene.end + 0.001),
      handoffs: scenes.map((scene) => ({ scene: scene.id, seconds: scene.handoff })),
      targetRuntimeSeconds: script.targetRuntimeSeconds,
      withinTarget:
        total >= script.targetRuntimeSeconds[0] && total <= script.targetRuntimeSeconds[1],
    },
  };
  fs.writeFileSync(
    path.join(outDir, 'voice-timeline.json'),
    `${JSON.stringify(voiceTimeline, null, 2)}\n`,
  );

  const timelineById = Object.fromEntries(voiceTimeline.scenes.map((scene) => [scene.id, scene]));
  const cues = [];
  let n = 0;
  for (const scene of scenes) {
    const timeline = timelineById[scene.id];
    n += 1;
    cues.push({
      n,
      sceneId: scene.id,
      chapter: scene.chapter,
      type: 'scene',
      action: 'scene-in',
      at: scene.start,
      anchor: null,
      note: `Scene starts: ${scene.chapter}`,
    });
    for (const plan of CUE_PLAN[scene.id] ?? []) {
      const target = normalize(plan.at);
      const matches = timeline.words.filter((word) => normalize(word.word) === target);
      const occurrence = plan.occurrence ?? 1;
      if (matches.length < occurrence) {
        throw new Error(`${scene.id}: cue "${plan.at}" occurrence ${occurrence} not found`);
      }
      const word = matches[occurrence - 1];
      const stackIndex = STACK_CUE_INDEX[scene.id]?.[plan.at];
      n += 1;
      cues.push({
        n,
        sceneId: scene.id,
        chapter: scene.chapter,
        type: stackIndex == null ? 'claim' : 'stack',
        action: plan.action,
        at: round(scene.voStart + word.start),
        anchor: plan.at,
        occurrence,
        wordIndex: word.i,
        word: word.word,
        wordStart: word.start,
        wordEnd: word.end,
        sceneTime: round(scene.voStart + word.start - scene.start),
        voTime: word.start,
        stackIndex: stackIndex ?? null,
        stackName: stackIndex == null ? null : scene.stack[stackIndex]?.name ?? null,
        note: plan.note,
      });
    }
  }
  cues.sort((a, b) => a.at - b.at || a.sceneId.localeCompare(b.sceneId));
  cues.forEach((cue, index) => {
    cue.n = index + 1;
  });

  const byScene = Object.fromEntries(
    scenes.map((scene) => {
      const sceneCues = cues.filter((cue) => cue.sceneId === scene.id);
      return [
        scene.id,
        {
          start: scene.start,
          end: scene.end,
          voStart: scene.voStart,
          voEnd: scene.voEnd,
          count: sceneCues.length,
          firstCue: sceneCues[0]?.at ?? null,
          lastCue: sceneCues.at(-1)?.at ?? null,
          actions: sceneCues.map((cue) => cue.action),
        },
      ];
    }),
  );
  const cueSheet = {
    version: 4,
    generatedAt: updatedScript.generatedAt,
    runtimeSeconds: total,
    source: {
      script: 'demo/ad/script-v4.json',
      timeline: 'demo/ad/public/audio/v4/voice-timeline.json',
      audio: 'demo/ad/public/audio/v4/vo/<scene>.mp3',
    },
    cueCount: cues.length,
    cues,
    byScene,
    notes: [
      'Cue times are absolute seconds from the start of the v4 cut.',
      'sceneTime is relative to scene.start; voTime is relative to the VO start.',
      'The caption for each scene is available in script-v4.json and voice-timeline.json.',
      'Stack reveals use the spoken word as the anchor; no added words were synthesized.',
    ],
  };
  fs.writeFileSync(
    path.join(outDir, 'cue-sheet.json'),
    `${JSON.stringify(cueSheet, null, 2)}\n`,
  );

  const after = await subscription();
  const selection = {
    voice_id: voice.voiceId,
    name: voice.name,
    model: voice.model,
    settings: voice.settings,
    output_format: voice.outputFormat,
    selection_status: 'generated',
    selection_rationale:
      'Liam was selected for the v4 warm, conversational read. The 19.3s test passed before the full script; the 9-scene read is a new synthesis, not reused v3 audio.',
    test: {
      file: 'public/audio/v4/vo-test-liam.mp3',
      timestamps: 'public/audio/v4/vo-test-liam.timestamps.json',
      text_characters: 282,
      duration_seconds: 19.3,
      words: 53,
      words_per_minute: 165,
      status: 200,
      ok: true,
    },
    render: {
      status: 'generated',
      provider: 'elevenlabs',
      endpoint: voice.endpoint,
      output_format: voice.outputFormat,
      files: 'public/audio/v4/vo/<scene>.mp3',
      timestamps: 'public/audio/v4/vo/<scene>.timestamps.json',
      generated_at: updatedScript.generatedAt,
    },
    character_usage: {
      account_before: before?.character_count ?? null,
      account_after: after?.character_count ?? null,
      used_this_run:
        before?.character_count != null && after?.character_count != null
          ? after.character_count - before.character_count
          : speechSeconds,
      characters_planned: scenes.reduce((sum, scene) => sum + scene.vo.length, 0),
      account_limit: after?.character_limit ?? before?.character_limit ?? null,
      account_remaining:
        after?.character_limit != null && after?.character_count != null
          ? after.character_limit - after.character_count
          : null,
    },
    scenes: scenes.map((scene) => ({
      id: scene.id,
      characters: scene.vo.length,
      words: words(scene.vo).length,
      duration_seconds: scene.duration,
      scene_duration: scene.sceneDuration,
      start: scene.start,
      end: scene.end,
    })),
    pronunciation_notes: [
      'The close is synthesized as "mend-demo.vercel.app"; listen for the domain cadence in the close.',
      'V2, NEP-366 and 42 are read from the written forms; alignment is preserved in the timestamps.',
      'No TEE verification is claimed. The spoken line says the response is signed and TEE proof is unavailable and labelled.',
    ],
    generated_at: updatedScript.generatedAt,
  };
  fs.writeFileSync(
    path.join(outDir, 'voice-selection.json'),
    `${JSON.stringify(selection, null, 2)}\n`,
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\nTotal ${total.toFixed(3)}s (${Math.floor(total / 60)}:${(total % 60).toFixed(3).padStart(6, '0')})`);
  console.log(`Words ${totalWords}, speech ${speechSeconds.toFixed(3)}s, cues ${cues.length}`);
  console.log(`Within target ${script.targetRuntimeSeconds.join('-')}s: ${voiceTimeline.totals.withinTarget}`);
  console.log('Wrote script-v4.json, voice-timeline.json, cue-sheet.json, voice-selection.json');
} catch (error) {
  console.error(`\nGeneration failed: ${error.message}`);
  console.error(`Existing v4 VO files left untouched. Temp dir: ${tmpDir}`);
  process.exit(1);
}
