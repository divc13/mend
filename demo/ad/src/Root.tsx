import React from 'react';
import { Composition } from 'remotion';
import scriptJson from '../script.json';
import { Ad } from './Ad';
import { CharacterGallery } from './characters/CharacterGallery';
import { AdV2 } from './v2/AdV2';
import { FPS as V2_FPS, HEIGHT as V2_HEIGHT, TOTAL_FRAMES as V2_TOTAL_FRAMES, WIDTH as V2_WIDTH } from './v2/lib/script';
import { cutDurationInFrames, masterDurationInFrames } from './cuts';
import type { Script } from './types';

const script = scriptJson as unknown as Script;
const fps = script.fps;
const width = script.width;
const height = script.height;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MendAd"
        component={Ad}
        durationInFrames={masterDurationInFrames(script, fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{ cut: 'master' as const }}
      />
      <Composition
        id="MendAdV2"
        component={AdV2}
        durationInFrames={V2_TOTAL_FRAMES}
        fps={V2_FPS}
        width={V2_WIDTH}
        height={V2_HEIGHT}
      />
      <Composition
        id="MendSubmission"
        component={Ad}
        durationInFrames={cutDurationInFrames(script, 'submission', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{ cut: 'submission' as const }}
      />
      <Composition
        id="MendTeaser"
        component={Ad}
        durationInFrames={cutDurationInFrames(script, 'teaser', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{ cut: 'teaser' as const }}
      />
      <Composition
        id="CharacterGallery"
        component={CharacterGallery}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
