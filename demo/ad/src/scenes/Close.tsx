import React from 'react';
import { AbsoluteFill } from 'remotion';
import { scriptData } from '../assets';
import { ChapterMark } from '../components/LowerThird';
import { EndCard } from '../components/EndCard';
import { SceneBackdrop } from '../components/SceneBackdrop';
import type { SceneProps } from '../types';

export const Close: React.FC<SceneProps> = ({ scene }) => {
  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" glow="mint" />
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(560px 420px at 50% 46%, rgba(143, 211, 180, 0.22), transparent 68%)',
        }}
      />
      <ChapterMark chapter={scene.chapter} tone="paper" delay={2} />
      <EndCard
        caption={scene.caption}
        siteUrl={scriptData.siteUrl}
        disclosures={scriptData.disclosures}
        steps={['Report it', 'Fix it', 'Remember it']}
        style={{ paddingTop: 88 }}
      />
    </AbsoluteFill>
  );
};
