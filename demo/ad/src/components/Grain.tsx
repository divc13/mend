import React from 'react';
import { AbsoluteFill } from 'remotion';

type GrainProps = {
  opacity?: number;
};

export const Grain: React.FC<GrainProps> = ({ opacity = 0.05 }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity, mixBlendMode: 'multiply' }}>
      <svg width="100%" height="100%" aria-hidden="true">
        <filter id="mend-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="3"
            seed="7"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mend-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
