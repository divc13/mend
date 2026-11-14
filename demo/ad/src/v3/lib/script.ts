import scriptJson from '../script.generated.json';

export type StackItem = {
  name: string;
  purpose: string;
};

/**
 * Scene ids are intentionally open: v4 keeps the same nine beats, but the
 * timeline file is the source of truth and must not need a code edit if a beat
 * is renamed. Components dispatch on the known ids and fall back gracefully.
 */
export type V3Scene = {
  id: string;
  start: number;
  duration: number;
  sceneDuration: number;
  voDuration: number;
  /** Silence between scenes; v4 uses 0.45 s handoffs. */
  gap?: number;
  handoffSeconds?: number;
  vo: string;
  caption: string;
  stack: StackItem[];
};

export type V3Script = {
  version: number;
  title: string;
  fps: number;
  width: number;
  height: number;
  siteUrl: string;
  durationSeconds: number;
  scenes: V3Scene[];
};

export const v3Script = scriptJson as unknown as V3Script;
export const FPS = v3Script.fps;
export const WIDTH = v3Script.width;
export const HEIGHT = v3Script.height;
export const TOTAL_FRAMES = Math.round(v3Script.durationSeconds * FPS);

export const sceneFrames = (scene: V3Scene): number => Math.round(scene.sceneDuration * FPS);

export const sceneStartFrame = (scene: V3Scene): number => Math.round(scene.start * FPS);

export const sceneById = (id: string): V3Scene => {
  const scene = v3Script.scenes.find((item) => item.id === id);
  if (!scene) throw new Error(`missing ad scene ${id}`);
  return scene;
};

export const hasScene = (id: string): boolean => v3Script.scenes.some((scene) => scene.id === id);

/** App beats are everything between the cold open and the prize close. */
export const appScenes = (): V3Scene[] =>
  v3Script.scenes.filter((scene) => scene.id !== 'hook' && scene.id !== 'cold-open' && scene.id !== 'close');

export const handoffSeconds = (scene: V3Scene): number =>
  scene.handoffSeconds ?? scene.gap ?? 0.45;
