import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import scriptJson from '../script.json';
import { assetManifest } from './assets';
import { Grain } from './components/Grain';
import { Logo } from './components/Logo';
import { resolveCut, sceneFrames } from './cuts';
import { CLAMP, fadeIn, fadeOut } from './motion';
import { Bids } from './scenes/Bids';
import { Close } from './scenes/Close';
import { Dao } from './scenes/Dao';
import { Hook } from './scenes/Hook';
import { Passport } from './scenes/Passport';
import { Payment } from './scenes/Payment';
import { Repair } from './scenes/Repair';
import { Report } from './scenes/Report';
import { Tech } from './scenes/Tech';
import { fonts, palette } from './theme';
import type { CutName, Scene, SceneId, Tone } from './types';

const script = scriptJson as unknown as import('./types').Script;

export type AdProps = {
  cut?: CutName;
};

const SCENE_TONES: Record<SceneId, Tone> = {
  hook: 'dark',
  report: 'paper',
  dao: 'paper',
  bids: 'paper',
  repair: 'dark',
  payment: 'paper',
  passport: 'paper',
  tech: 'dark',
  close: 'paper',
};

const SceneView: React.FC<{ scene: Scene; durationInFrames: number }> = ({
  scene,
  durationInFrames,
}) => {
  switch (scene.id) {
    case 'hook':
      return <Hook scene={scene} durationInFrames={durationInFrames} />;
    case 'report':
      return <Report scene={scene} durationInFrames={durationInFrames} />;
    case 'dao':
      return <Dao scene={scene} durationInFrames={durationInFrames} />;
    case 'bids':
      return <Bids scene={scene} durationInFrames={durationInFrames} />;
    case 'repair':
      return <Repair scene={scene} durationInFrames={durationInFrames} />;
    case 'payment':
      return <Payment scene={scene} durationInFrames={durationInFrames} />;
    case 'passport':
      return <Passport scene={scene} durationInFrames={durationInFrames} />;
    case 'tech':
      return <Tech scene={scene} durationInFrames={durationInFrames} />;
    case 'close':
      return <Close scene={scene} durationInFrames={durationInFrames} />;
    default:
      return <Hook scene={scene} durationInFrames={durationInFrames} />;
  }
};

const SceneTransition: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const incoming = fadeIn(frame, 0, 14);
  const outgoing = fadeOut(frame, durationInFrames - 22, 22);
  const opacity = Math.min(incoming, outgoing);
  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${1 + (1 - opacity) * 0.006})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Chrome: React.FC<{
  frame: number;
  totalFrames: number;
  tone: Tone;
  hideLogo: boolean;
}> = ({ frame, totalFrames, tone, hideLogo }) => {
  const progress = interpolate(frame, [0, Math.max(1, totalFrames - 1)], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 4,
          width: `${progress * 100}%`,
          background: tone === 'dark' ? palette.mint : palette.green,
          opacity: 0.72,
        }}
      />
      {!hideLogo ? (
        <div
          style={{
            position: 'absolute',
            top: 46,
            right: 92,
            opacity: tone === 'dark' ? 0.72 : 0.5,
          }}
        >
          <Logo size={26} tone={tone === 'dark' ? 'dark' : 'paper'} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Ad: React.FC<AdProps> = ({ cut = 'master' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scenes = resolveCut(script, cut);
  const overlap = Math.round(fps * 0.5);

  let cursor = 0;
  const items = scenes.map((scene, index) => {
    const nominal = sceneFrames(scene, fps);
    const from =
      cut === 'master' ? Math.round(scene.start * fps) : cursor;
    const isLast = index === scenes.length - 1;
    const sequenceDuration = nominal + (isLast ? 0 : overlap);
    cursor += nominal;
    return { scene, from, nominal, sequenceDuration };
  });

  const active =
    items.find(
      (item) => frame >= item.from && frame < item.from + item.sequenceDuration,
    ) ?? items[items.length - 1];
  const activeTone = active ? SCENE_TONES[active.scene.id] : 'paper';
  const hideLogo = active?.scene.id === 'close';

  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      {items.map(({ scene, from, nominal, sequenceDuration }) => (
        <Sequence
          key={scene.id}
          from={from}
          durationInFrames={sequenceDuration}
          name={scene.chapter}
        >
          <SceneTransition durationInFrames={sequenceDuration}>
            <SceneView scene={scene} durationInFrames={nominal} />
          </SceneTransition>
        </Sequence>
      ))}
      <Grain />
      <Chrome
        frame={frame}
        totalFrames={durationInFrames}
        tone={activeTone}
        hideLogo={hideLogo}
      />
    </AbsoluteFill>
  );
};

// Keep the manifest referenced so the generated file is part of the bundle
// even when no assets have been downloaded yet.
void assetManifest;
void fonts;
