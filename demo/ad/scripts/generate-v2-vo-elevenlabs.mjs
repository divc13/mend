#!/usr/bin/env node
// Regenerate the nine v2 VO files with ElevenLabs George.
//
// Usage:
//   set -a; . ./.env; set +a
//   node demo/ad/scripts/generate-v2-vo-elevenlabs.mjs
//
// The script writes to a temp directory first. If every scene succeeds it
// replaces demo/ad/public/audio/v2/vo/<scene>.mp3 and .timestamps.json, then
// writes voice-selection.json. If any request fails it leaves the existing
// fallback files untouched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const adDir = path.join(root, 'demo/ad');
const scriptPath = path.join(adDir, 'script-v2.json');
const outDir = path.join(adDir, 'public/audio/v2/vo');
const tmpDir = path.join(outDir, '.elevenlabs-tmp');
const selectionPath = path.join(adDir, 'public/audio/v2/voice-selection.json');

const key = process.env.ELEVEN_LABS_API_KEY;
if (!key) {
  console.error('ELEVEN_LABS_API_KEY is not set. Load .env with: set -a; . ./.env; set +a');
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const voice = script.voice;
const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

function round(value, places = 3) {
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

function normalize(value) {
  return value.toLowerCase().replaceAll('’', "'");
}

function scriptWords(text) {
  WORD_RE.lastIndex = 0;
  return [...text.matchAll(WORD_RE)].map((m) => m[0]);
}

function wordsFromAlignment(alignment) {
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const text = chars.join('');
  const words = [];
  const re = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
  let match;
  while ((match = re.exec(text)) !== null) {
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

// Match the written script words to the engine's alignment words. Numbers and
// abbreviations can be normalised differently ("9270" vs "nine thousand..."),
// so use LCS on normalised tokens and interpolate unmatched runs.
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

  const known = times
    .map((t, index) => (t ? index : null))
    .filter((v) => v !== null);
  const firstKnown = known[0] ?? null;
  const lastKnown = known.at(-1) ?? null;

  if (firstKnown !== null && firstKnown > 0) {
    const start = 0;
    const end = times[firstKnown].start;
    for (let k = 0; k < firstKnown; k += 1) {
      times[k] = {
        start: round(start + ((end - start) * k) / firstKnown),
        end: round(start + ((end - start) * (k + 1)) / firstKnown),
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
    return {
      word,
      start: round(start),
      end: round(end),
      charStart: null,
      charEnd: null,
    };
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
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}/with-timestamps?output_format=mp3_44100_128`;
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

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const before = await subscription();
const results = [];
let totalChars = 0;

try {
  for (const scene of script.scenes) {
    process.stdout.write(`generating ${scene.id} ... `);
    const { audio, alignment, normalized } = await synthesize(scene);
    const aligned = wordsFromAlignment(alignment);
    if (aligned.length === 0) throw new Error(`${scene.id}: empty alignment`);
    const duration = round(Math.max(...aligned.map((w) => w.end)));
    const written = scriptWords(scene.vo);
    const words = alignWords(written, aligned, duration);
    const voStart = round(scene.start + scene.voOffset);
    const voEnd = round(voStart + duration);

    fs.writeFileSync(path.join(tmpDir, `${scene.id}.mp3`), audio);
    fs.writeFileSync(
      path.join(tmpDir, `${scene.id}.timestamps.json`),
      `${JSON.stringify(
        {
          sceneId: scene.id,
          text: scene.vo,
          provider: 'elevenlabs',
          voice_id: voice.voiceId,
          voice_name: voice.name,
          model_id: voice.model,
          output_format: 'mp3_44100_128',
          scene_start: scene.start,
          scene_duration: scene.duration,
          vo_offset: scene.voOffset,
          duration_seconds: duration,
          alignment,
          normalized_alignment: normalized,
          words,
          quality_check: {
            word_count: words.length,
            expected_word_count: written.length,
            duration_seconds: duration,
            first_word_start: words[0]?.start ?? null,
            last_word_end: words.at(-1)?.end ?? null,
            scene_start: scene.start,
            scene_end: scene.start + scene.duration,
            vo_start: voStart,
            vo_end: voEnd,
            fits_scene: voEnd <= scene.start + scene.duration + 0.001,
          },
        },
        null,
        2,
      )}\n`,
    );

    totalChars += scene.vo.length;
    results.push({
      id: scene.id,
      characters: scene.vo.length,
      duration,
      words: words.length,
      voStart,
      voEnd,
      sceneEnd: scene.start + scene.duration,
      fits: voEnd <= scene.start + scene.duration + 0.001,
    });
    console.log(`ok ${duration.toFixed(2)}s, ${words.length} words, vo ${voStart.toFixed(2)}-${voEnd.toFixed(2)}`);
  }

  const overruns = results.filter((r) => !r.fits);
  if (overruns.length > 0) {
    throw new Error(
      `scene overrun: ${overruns.map((r) => `${r.id} ends ${r.voEnd.toFixed(2)} > ${r.sceneEnd.toFixed(2)}`).join(', ')}`,
    );
  }

  for (const scene of script.scenes) {
    for (const ext of ['mp3', 'timestamps.json']) {
      fs.copyFileSync(
        path.join(tmpDir, `${scene.id}.${ext}`),
        path.join(outDir, `${scene.id}.${ext}`),
      );
    }
  }

  const after = await subscription();
  const selection = {
    voice_id: voice.voiceId,
    name: voice.name,
    display_name: 'George — Warm, Captivating Storyteller',
    category: 'premade',
    labels: { accent: 'british', description: 'warm, captivating storyteller' },
    model: voice.model,
    settings: voice.settings,
    output_format: 'mp3_44100_128',
    selection_status: 'generated',
    selection_rationale:
      'George is the warm, clear British storyteller selected for the MEND cut. The first-line v2 test against Adam could not run while the free tier was blocked, so the v1 George/Brian comparison remains the listening evidence for this choice.',
    render: {
      status: 'generated',
      provider: 'elevenlabs',
      endpoint: '/v1/text-to-speech/{voice_id}/with-timestamps',
      output_format: 'mp3_44100_128',
      generated_at: new Date().toISOString(),
      files: 'demo/ad/public/audio/v2/vo/<scene>.mp3',
      timestamps: 'demo/ad/public/audio/v2/vo/<scene>.timestamps.json',
    },
    tests: [
      {
        name: 'george-v1-reference',
        voice_id: 'JBFqnCBsd6RMkjVDRZzb',
        file: '../vo/voice-test-george.mp3',
        status: 200,
        ok: true,
        duration_seconds: 5.877551,
        selected: true,
      },
      {
        name: 'brian-v1-reference',
        voice_id: 'nPczCjzI2devNBz1zQrb',
        file: '../vo/voice-test-brian.mp3',
        status: 200,
        ok: true,
        duration_seconds: 6.50449,
        selected: false,
      },
      {
        name: 'adam-v2-first-line',
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        status: 401,
        ok: false,
        error_code: 'detected_unusual_activity',
        characters_consumed: 0,
        selected: false,
        notes: 'Blocked before synthesis; no listening test was possible.',
      },
    ],
    history: {
      fallback_used:
        'A local placeholder was used before this generation because the free tier returned 401 detected_unusual_activity. The files were replaced by this run.',
    },
    character_usage: {
      account_before: before?.character_count ?? null,
      account_after: after?.character_count ?? null,
      used_this_run:
        before?.character_count != null && after?.character_count != null
          ? after.character_count - before.character_count
          : totalChars,
      characters_planned: totalChars,
      account_limit: after?.character_limit ?? before?.character_limit ?? null,
      account_remaining:
        after?.character_limit != null && after?.character_count != null
          ? after.character_limit - after.character_count
          : null,
    },
    scenes: results,
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\nWrote ${results.length} scenes, ${totalChars} characters.`);
  console.log('Next: node demo/ad/scripts/build-v2-timeline.mjs');
} catch (error) {
  console.error(`\nGeneration failed: ${error.message}`);
  console.error(`Existing files left untouched. Temp dir: ${tmpDir}`);
  process.exit(1);
}
