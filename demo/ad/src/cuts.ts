import type { CutName, Scene, Script } from './types';

export const sceneById = (script: Script, id: string): Scene | undefined =>
  script.scenes.find((scene) => scene.id === id);

export const resolveCut = (script: Script, cut: CutName): Scene[] => {
  const ids = script.cuts[cut] ?? script.cuts.master;
  const scenes = ids
    .map((id) => sceneById(script, id))
    .filter((scene): scene is Scene => Boolean(scene));
  return scenes.length > 0 ? scenes : script.scenes;
};

export const sceneFrames = (scene: Scene, fps: number): number =>
  Math.round(scene.duration * fps);

export const cutDurationInFrames = (
  script: Script,
  cut: CutName,
  fps: number,
): number =>
  resolveCut(script, cut).reduce(
    (total, scene) => total + sceneFrames(scene, fps),
    0,
  );

export const masterDurationInFrames = (script: Script, fps: number): number =>
  Math.round(
    Math.max(...script.scenes.map((scene) => scene.start + scene.duration)) *
      fps,
  );
