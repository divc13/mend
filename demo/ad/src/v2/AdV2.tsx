import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CLAMP, fadeIn, fadeOut } from '../motion';
import { palette } from '../theme';
import { BidsV2 } from './scenes/BidsV2';
import { CloseV2 } from './scenes/CloseV2';
import { DaoV2 } from './scenes/DaoV2';
import { HookV2 } from './scenes/HookV2';
import { PassportV2 } from './scenes/PassportV2';
import { PaymentV2 } from './scenes/PaymentV2';
import { RepairV2 } from './scenes/RepairV2';
import { ReportV2 } from './scenes/ReportV2';
import { TechV2 } from './scenes/TechV2';
import {
  TOTAL_FRAMES,
  sceneFrom,
  sceneSequenceFrames,
  v2Script,
  type SceneId,
} from './lib/script';
import type { V2SceneProps } from './types';

const SCENES: Record<SceneId, React.FC<V2SceneProps>> = {
  hook: HookV2,
  report: ReportV2,
  dao: DaoV2,
  bids: BidsV2,
  repair: RepairV2,
  payment: PaymentV2,
  passport: PassportV2,
  tech: TechV2,
  close: CloseV2,
};

const SceneTransition: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const incoming = fadeIn(frame, 0, 12);
  const outgoing = fadeOut(frame, Math.max(1, durationInFrames - 16), 16);
  const opacity = Math.min(incoming, outgoing);
  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${1.008 - opacity * 0.008})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A paper strip that sweeps away as each J-cut lands. */
const CutWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 22], [0, 1], CLAMP);
  if (frame > 26) {
    return null;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', zIndex: 60 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background:
            'linear-gradient(105deg, transparent 0%, transparent 38%, rgba(245, 241, 230, 0.92) 38%, rgba(245, 241, 230, 0.92) 50%, rgba(143, 211, 180, 0.55) 50%, rgba(143, 211, 180, 0.55) 53%, transparent 53%, transparent 100%)',
          transform: `translateX(${(1 - progress) * 118 - 12}%)`,
          opacity: 1 - progress * 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 92,
          opacity: 0.4 * (1 - progress),
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10,
          letterSpacing: '0.18em',
          color: palette.green,
          textTransform: 'uppercase',
        }}
      >
        MEND · CUT
      </div>
    </AbsoluteFill>
  );
};

const GlobalChrome: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 55 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 3,
          width: `${progress * 100}%`,
          backgroundColor: palette.mint,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 34,
          top: 54,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 5,
          opacity: 0.42,
        }}
      >
        {v2Script.scenes.map((scene, index) => {
          const from = sceneFrom(scene);
          const active = frame >= from && frame < from + sceneSequenceFrames(scene, index);
          return (
            <div
              key={scene.id}
              style={{
                width: active ? 26 : 12,
                height: 2,
                backgroundColor: active ? palette.green : palette.lineStrong,
                transition: 'none',
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const AdV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      {v2Script.scenes.map((scene, index) => {
        const from = sceneFrom(scene);
        const duration = Math.max(
          1,
          Math.min(sceneSequenceFrames(scene, index), TOTAL_FRAMES - from),
        );
        const View = SCENES[scene.id] ?? HookV2;
        return (
          <Sequence
            key={`${scene.id}-${index}`}
            from={from}
            durationInFrames={duration}
            name={`${scene.chapter} · J${scene.visualOffset >= 0 ? '+' : ''}${scene.visualOffset.toFixed(2)}s`}
          >
            <SceneTransition durationInFrames={duration}>
              <View
                scene={scene}
                durationInFrames={duration}
                sequenceFrom={from}
                index={index}
              />
            </SceneTransition>
            <CutWipe />
          </Sequence>
        );
      })}
      <GlobalChrome />
    </AbsoluteFill>
  );
};
