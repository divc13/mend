/**
 * Scene-local timestamps for the captured app actions.
 *
 * `public/assets/live/actions.json` records source-clip milliseconds. Remotion
 * starts each scene at `sourceStart` and plays it at `playbackRate`, so the
 * visible action lands at:
 *
 *   sceneSeconds = (sourceMilliseconds / 1000 - sourceStart) / playbackRate
 *
 * Camera keyframes and cast reactions both read from this table so the
 * punch-ins and micro-reactions cannot drift away from the app.
 */
export const ACTIONS = {
  report: {
    photo: 11.1,
    privacy: 14.32,
    duplicate: 16.65,
    merge: 18.54,
    submit: 25.4,
  },
  dao: {
    scope: 3.62,
    saveDraft: 10.69,
    award: 14.96,
  },
  bids: {
    reveal: 2.1,
    score: 5.05,
    hashes: 10.34,
  },
  repair: {
    checklist: 4.16,
    notes: 7.74,
    confirmations: 10.85,
    accept: 14.04,
  },
  payment: {
    accounting: 1.09,
    split: 5,
    payments: 10.43,
  },
  passport: {
    history: 2.74,
    entries: 7.9,
  },
  tech: {
    stack: 4.27,
    cards: 12.18,
    proof: 17.95,
  },
} as const;

export type ActionTimestamp = number;

export const actionFrame = (seconds: ActionTimestamp, fps: number): number =>
  Math.round(seconds * fps);
