import sourceClipsJson from './source-clips.generated.json';
import { v3Script, type V3Scene } from './script';

export type CameraKeyframe = {
  /** Scene-local seconds. */
  at: number;
  scale: number;
  x?: number;
  y?: number;
};

type ClipAction = { atMs: number; action: string; ok: boolean };
type ClipMeta = { id: string; durationMs: number; actions: ClipAction[] };

const CLIPS = (sourceClipsJson as { clips: Record<string, ClipMeta> }).clips;

/**
 * Source action anchors. The player maps the first/last meaningful action of a
 * capture onto the scene's lead-in and hold-out, then derives the source start
 * and playback rate. Nothing here encodes a v3 scene length.
 */
type Anchor = {
  clip: string;
  firstMs: number;
  lastMs: number;
  /** Resting zoom and strongest punch. Kept at or below 1.13x. */
  base: number;
  peak: number;
  origin: string;
  offsetY?: number;
};

const ANCHORS: Record<string, Anchor> = {
  report: {
    clip: 'report-live',
    firstMs: 2970,
    lastMs: 25992,
    base: 1.04,
    peak: 1.13,
    origin: '50% 42%',
  },
  dao: {
    clip: 'steward-live',
    firstMs: 4470,
    lastMs: 15807,
    base: 1.035,
    peak: 1.13,
    origin: '50% 10%',
  },
  bids: {
    clip: 'bids-live',
    firstMs: 3024,
    lastMs: 10767,
    base: 1.045,
    peak: 1.12,
    origin: '50% 44%',
  },
  repair: {
    clip: 'inspector-live',
    firstMs: 2839,
    lastMs: 15087,
    base: 1.04,
    peak: 1.13,
    origin: '50% 10%',
    offsetY: -84,
  },
  /** The payment capture has no verified action log; it is one continuous scroll. */
  payment: {
    clip: 'payment-live',
    firstMs: 0,
    lastMs: 0,
    base: 1.075,
    peak: 1.13,
    origin: '63% 32%',
  },
  passport: {
    clip: 'passport-live',
    firstMs: 2669,
    lastMs: 5709,
    base: 1.055,
    peak: 1.11,
    origin: '48% 40%',
  },
  tech: {
    clip: 'tech-live',
    firstMs: 1815,
    lastMs: 6195,
    base: 1.015,
    peak: 1.1,
    origin: '50% 40%',
    offsetY: -46,
  },
};

export type SceneTiming = {
  clip: string;
  clipDuration: number;
  sourceStart: number;
  playbackRate: number;
  /** Source seconds consumed by the scene; must stay under `clipDuration`. */
  coverage: number;
  firstActionAt: number;
  lastActionAt: number;
  base: number;
  peak: number;
  origin: string;
  offsetY: number;
  camera: CameraKeyframe[];
  warnings: string[];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number): number => Number(value.toFixed(3));

/** Deduplicate and clamp camera keys to the scene so easing never jumps. */
const settleCamera = (keys: CameraKeyframe[], total: number): CameraKeyframe[] => {
  const sorted = keys
    .map((key) => ({
      ...key,
      at: round(clamp(key.at, 0, total)),
      x: key.x ?? 0,
      y: key.y ?? 0,
    }))
    .sort((a, b) => a.at - b.at);
  const out: CameraKeyframe[] = [];
  for (const key of sorted) {
    const previous = out[out.length - 1];
    if (previous && key.at - previous.at < 0.18) {
      out[out.length - 1] = { ...key, at: previous.at };
      continue;
    }
    out.push(key);
  }
  return out;
};

const buildCamera = (
  total: number,
  firstAt: number,
  lastAt: number,
  anchor: Anchor,
): CameraKeyframe[] => {
  const { base, peak } = anchor;
  const mid = (firstAt + lastAt) / 2;
  const punch = base + (peak - base) * 0.55;
  return settleCamera(
    [
      { at: 0, scale: base, x: 0, y: 0 },
      { at: Math.max(0.55, firstAt - 0.9), scale: base, x: 0, y: 0 },
      { at: firstAt, scale: punch, x: -18, y: 8 },
      { at: mid, scale: punch, x: 8, y: 0 },
      { at: Math.max(firstAt + 0.7, lastAt - 0.9), scale: punch, x: 8, y: 0 },
      { at: lastAt, scale: peak, x: 18, y: 14 },
      { at: total, scale: peak, x: 18, y: 14 },
    ],
    total,
  );
};

const derive = (scene: V3Scene): SceneTiming => {
  const total = scene.sceneDuration;
  const gap = typeof scene.gap === 'number' && Number.isFinite(scene.gap) ? scene.gap : 0.45;
  const warnings: string[] = [];
  const anchor = ANCHORS[scene.id];

  if (!anchor) {
    const clip = 'report-live';
    const meta = CLIPS[clip];
    const clipDuration = (meta?.durationMs ?? 30000) / 1000;
    const sourceStart = 0.2;
    const playbackRate = round(clamp((clipDuration - sourceStart - 0.2) / total, 0.4, 1.15));
    return {
      clip,
      clipDuration,
      sourceStart,
      playbackRate,
      coverage: round(sourceStart + total * playbackRate),
      firstActionAt: 0,
      lastActionAt: Math.max(1, total - gap - 0.6),
      base: 1.04,
      peak: 1.13,
      origin: '50% 42%',
      offsetY: 0,
      camera: buildCamera(total, Math.max(1, total * 0.16), Math.max(2, total - gap - 0.6), {
        ...ANCHORS.report,
      }),
      warnings,
    };
  }

  const clipDuration = (CLIPS[anchor.clip]?.durationMs ?? 0) / 1000;
  if (!clipDuration) {
    warnings.push(`missing capture metadata for ${anchor.clip}`);
  }

  const lead = clamp(total * 0.07, 0.85, 2.2);
  const tail = clamp(gap + 0.7, 1.0, Math.max(1.0, total * 0.2));
  const span = Math.max(0.8, total - tail - lead);

  const ambient = anchor.firstMs === 0 && anchor.lastMs === 0;
  let playbackRate = ambient
    ? clamp((clipDuration - 0.4) / total, 0.4, 1.15)
    : clamp((anchor.lastMs - anchor.firstMs) / 1000 / span, 0.26, 1.3);

  let sourceStart = ambient
    ? 0.2
    : round(clamp(anchor.firstMs / 1000 - lead * playbackRate, 0.12, 6));

  // Never outrun the capture: if the scene needs more source than exists, slow
  // the clip down until the last frame lands just inside the scene end.
  const maxEnd = clipDuration - 0.12;
  if (clipDuration > 0 && sourceStart + total * playbackRate > maxEnd) {
    const fitted = (maxEnd - sourceStart) / total;
    if (fitted >= 0.24) {
      playbackRate = fitted;
    } else {
      playbackRate = 0.24;
      warnings.push(
        `${scene.id}: capture (${clipDuration.toFixed(2)}s) cannot fill ${total.toFixed(2)}s without a tail hold`,
      );
    }
  }

  playbackRate = round(clamp(playbackRate, 0.24, 1.3));
  sourceStart = round(clamp(sourceStart, 0.05, Math.max(0.05, clipDuration - 0.5)));

  const firstActionAt = ambient ? total * 0.12 : round((anchor.firstMs / 1000 - sourceStart) / playbackRate);
  const lastActionAt = ambient
    ? Math.max(1, total - gap - 0.5)
    : round((anchor.lastMs / 1000 - sourceStart) / playbackRate);
  const coverage = round(sourceStart + total * playbackRate);

  if (lastActionAt > total - gap + 0.05) {
    warnings.push(`${scene.id}: last action at ${lastActionAt}s is inside the ${gap}s handoff`);
  }
  if (clipDuration > 0 && coverage > clipDuration - 0.1) {
    warnings.push(`${scene.id}: source coverage ${coverage}s > clip ${clipDuration}s`);
  }

  return {
    clip: anchor.clip,
    clipDuration,
    sourceStart,
    playbackRate,
    coverage,
    firstActionAt,
    lastActionAt,
    base: anchor.base,
    peak: anchor.peak,
    origin: anchor.origin,
    offsetY: anchor.offsetY ?? 0,
    camera: buildCamera(total, firstActionAt, lastActionAt, anchor),
    warnings,
  };
};

const TIMINGS: Record<string, SceneTiming> = Object.fromEntries(
  v3Script.scenes.map((scene) => [scene.id, derive(scene)]),
);

export const sceneTiming = (id: string): SceneTiming => {
  const timing = TIMINGS[id];
  if (!timing) {
    throw new Error(`missing timing for scene ${id}`);
  }
  return timing;
};

export const TIMING_WARNINGS: string[] = Object.values(TIMINGS).flatMap((timing) => timing.warnings);

const sourceAt = (id: string, sourceMs: number): number => {
  const timing = sceneTiming(id);
  return round((sourceMs / 1000 - timing.sourceStart) / timing.playbackRate);
};

/**
 * Scene-local times for every captured action. Clamped below the scene end so
 * cast reactions and camera punches cannot drift into the next scene.
 */
export const ACTIONS = {
  report: {
    category: sourceAt('report', 2970),
    area: sourceAt('report', 4561),
    description: sourceAt('report', 5856),
    photo: sourceAt('report', 11869),
    privacy: sourceAt('report', 15022),
    duplicate: sourceAt('report', 17331),
    merge: sourceAt('report', 19201),
    review: sourceAt('report', 23145),
    submit: sourceAt('report', 25992),
  },
  dao: {
    scope: sourceAt('dao', 4470),
    budget: sourceAt('dao', 9476),
    saveDraft: sourceAt('dao', 11540),
    award: sourceAt('dao', 15807),
  },
  bids: {
    reveal: sourceAt('bids', 3024),
    score: sourceAt('bids', 5794),
    hashes: sourceAt('bids', 10767),
  },
  repair: {
    evidence: sourceAt('repair', 2839),
    checklist: sourceAt('repair', 5212),
    notes: sourceAt('repair', 8788),
    confirmations: sourceAt('repair', 11900),
    accept: sourceAt('repair', 15087),
  },
  payment: {
    accounting: sourceAt('payment', 1800),
    split: sourceAt('payment', 3600),
    payments: sourceAt('payment', 6100),
  },
  passport: {
    history: sourceAt('passport', 2669),
    entries: sourceAt('passport', 5709),
  },
  tech: {
    stack: sourceAt('tech', 1815),
    cards: sourceAt('tech', 4347),
    proof: sourceAt('tech', 6195),
  },
} as const;

/** Scene-local time of the first frame that should already show populated app content. */
export const firstActionAt = (id: string): number => sceneTiming(id).firstActionAt;
