import type { V2Scene } from './lib/script';

export type V2SceneProps = {
  scene: V2Scene;
  durationInFrames: number;
  /** Absolute frame where the picture sequence starts. */
  sequenceFrom: number;
  index: number;
};
