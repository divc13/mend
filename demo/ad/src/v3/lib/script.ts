import scriptJson from '../script.generated.json';

export type StackItem = {
  name: string;
  purpose: string;
};

export type V3Scene = {
  id: 'hook' | 'report' | 'dao' | 'bids' | 'repair' | 'payment' | 'passport' | 'tech' | 'close';
  start: number;
  duration: number;
  sceneDuration: number;
  voDuration: number;
  gap: number;
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

export const sceneById = (id: V3Scene['id']): V3Scene => {
  const scene = v3Script.scenes.find((item) => item.id === id);
  if (!scene) throw new Error(`missing v3 scene ${id}`);
  return scene;
};
