import scriptJson from '../script.generated.json';

export type SceneId =
  | 'hook'
  | 'report'
  | 'dao'
  | 'bids'
  | 'repair'
  | 'payment'
  | 'passport'
  | 'tech'
  | 'close';

export type Tone = 'paper' | 'dark';

export type V2Scene = {
  id: SceneId;
  originalId: string;
  start: number;
  duration: number;
  chapter: string;
  vo: string;
  caption: string;
  visual: string;
  tone: Tone;
  visualOffset: number;
};

export type V2Script = {
  version: number;
  source: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  siteUrl: string;
  durationInFrames: number;
  durationSeconds: number;
  scenes: V2Scene[];
  disclosures: string[];
};

export const v2Script = scriptJson as unknown as V2Script;
export const FPS = v2Script.fps;
export const WIDTH = v2Script.width;
export const HEIGHT = v2Script.height;
export const TOTAL_FRAMES = v2Script.durationInFrames;

export const sceneById = (id: SceneId): V2Scene | undefined =>
  v2Script.scenes.find((scene) => scene.id === id);

export const sceneFrames = (scene: V2Scene): number =>
  Math.round(scene.duration * FPS);

/** Absolute frame where the picture for a scene starts (J-cut applied). */
export const sceneFrom = (scene: V2Scene): number =>
  Math.max(0, Math.round((scene.start + scene.visualOffset) * FPS));

/**
 * Absolute frame where the voice for a scene starts. Picture may lead or lag
 * this by `visualOffset` (the J-cut).
 */
export const voiceFrom = (scene: V2Scene): number =>
  Math.round(scene.start * FPS);

/** How many frames the picture track needs, including a J-cut tail. */
export const sceneSequenceFrames = (scene: V2Scene, index: number): number => {
  const nominal = sceneFrames(scene);
  const next = v2Script.scenes[index + 1];
  if (!next) {
    return nominal;
  }
  const tail = sceneFrom(next) - sceneFrom(scene) - nominal;
  return Math.max(nominal, nominal + Math.max(0, tail));
};

export const SCENE_ORDER: SceneId[] = [
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

export const sceneStartMap: Record<SceneId, number> = v2Script.scenes.reduce(
  (acc, scene) => {
    acc[scene.id] = sceneFrom(scene);
    return acc;
  },
  {} as Record<SceneId, number>,
);
