import React from 'react';
import { Composition } from 'remotion';
import scriptJson from '../script.json';
import { Ad } from './Ad';
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
    </>
  );
};
