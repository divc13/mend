import React from 'react';
import { Composition } from 'remotion';
import { ThumbnailV3 } from './ThumbnailV3';

export const ThumbnailRoot: React.FC = () => (
  <Composition
    id="MendV3Thumbnail"
    component={ThumbnailV3}
    durationInFrames={1}
    fps={30}
    width={1920}
    height={1080}
  />
);
