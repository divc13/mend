/**
 * Scene-local timestamps for the captured app actions.
 *
 * `public/assets/live/actions.json` records source-clip milliseconds. Remotion
 * starts each scene at `sourceStart` and plays it at `playbackRate`, so the
 * visible action lands at:
 *
 *   sceneSeconds = (sourceMilliseconds / 1000 - sourceStart) / playbackRate
 *
 * `SCENE_TRIM` is the single source of truth for both the Remotion player and
 * this table. The v4 timing pass adds a 0.60 s breath to every scene, so the
 * clips are trimmed/slowed just enough to keep playing through the hold
 * instead of freezing on their last frame. Keeping the action times derived
 * means a future rate change cannot desync the camera punch-ins or cast.
 */
export const SCENE_TRIM = {
  report: { sourceStart: 0.85, playbackRate: 0.96 },
  dao: { sourceStart: 0.85, playbackRate: 1 },
  bids: { sourceStart: 1.05, playbackRate: 0.91 },
  repair: { sourceStart: 1.05, playbackRate: 1 },
  payment: { sourceStart: 1.3, playbackRate: 0.44 },
  passport: { sourceStart: 1.05, playbackRate: 0.57 },
  tech: { sourceStart: 0.45, playbackRate: 0.31 },
} as const;

type TrimmedScene = keyof typeof SCENE_TRIM;

const at = (scene: TrimmedScene, sourceMs: number): number => {
  const { sourceStart, playbackRate } = SCENE_TRIM[scene];
  return Number(((sourceMs / 1000 - sourceStart) / playbackRate).toFixed(3));
};

export const ACTIONS = {
  report: {
    /** source 11.869 s: upload pothole.jpg */
    photo: at('report', 11869),
    /** source 15.022 s: continue from the privacy step */
    privacy: at('report', 15022),
    /** source 17.331 s: choose the matching duplicate */
    duplicate: at('report', 17331),
    /** source 19.201 s: acknowledge the possible merge */
    merge: at('report', 19201),
    /** source 25.992 s: submit the report */
    submit: at('report', 25992),
  },
  dao: {
    /** source 4.470 s: steward confirms the acting role */
    scope: at('dao', 4470),
    /** source 11.540 s: save the replay draft */
    saveDraft: at('dao', 11540),
    /** source 15.807 s: confirm the award */
    award: at('dao', 15807),
  },
  bids: {
    /** source 3.024 s: reveal the comparison */
    reveal: at('bids', 3024),
    /** source 5.794 s: scroll the deterministic score */
    score: at('bids', 5794),
    /** source 10.767 s: scroll to policy + execution hashes */
    hashes: at('bids', 10767),
  },
  repair: {
    /** source 5.212 s: tick the checklist */
    checklist: at('repair', 5212),
    /** source 8.788 s: type inspector notes */
    notes: at('repair', 8788),
    /** source 11.900 s: check the three human confirmations */
    confirmations: at('repair', 11900),
    /** source 15.087 s: accept completion */
    accept: at('repair', 15087),
  },
  payment: {
    /** source 1.800 s: scroll to accounting */
    accounting: at('payment', 1800),
    /** source 3.600 s: review the 100/20/72/8 split */
    split: at('payment', 3600),
    /** source 6.100 s: scroll to payments */
    payments: at('payment', 6100),
  },
  passport: {
    /** source 2.669 s: scroll to maintenance history */
    history: at('passport', 2669),
    /** source 5.709 s: scroll through history entries */
    entries: at('passport', 5709),
  },
  tech: {
    /** source 1.815 s: scroll to the stack */
    stack: at('tech', 1815),
    /** source 4.347 s: scroll through stack cards */
    cards: at('tech', 4347),
    /** source 6.195 s: scroll to proof cards */
    proof: at('tech', 6195),
  },
} as const;

export type ActionTimestamp = number;

export const actionFrame = (seconds: ActionTimestamp, fps: number): number =>
  Math.round(seconds * fps);
