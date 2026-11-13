import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Logo } from '../../components/Logo';
import { SceneBackdrop } from '../../components/SceneBackdrop';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import type { Tone, V2Scene } from '../lib/script';
import { ChapterTag, V2Caption } from './SceneChrome';

const particles = [
  { x: 8, y: 18, r: 3, speed: 0.13, drift: 18, o: 0.3 },
  { x: 22, y: 72, r: 5, speed: 0.09, drift: -14, o: 0.22 },
  { x: 36, y: 34, r: 2, speed: 0.17, drift: 22, o: 0.35 },
  { x: 51, y: 84, r: 4, speed: 0.11, drift: -20, o: 0.2 },
  { x: 64, y: 22, r: 3, speed: 0.15, drift: 16, o: 0.28 },
  { x: 77, y: 64, r: 6, speed: 0.07, drift: -10, o: 0.16 },
  { x: 89, y: 38, r: 2, speed: 0.2, drift: 24, o: 0.32 },
  { x: 94, y: 82, r: 4, speed: 0.12, drift: -18, o: 0.18 },
  { x: 14, y: 46, r: 2, speed: 0.19, drift: 12, o: 0.24 },
  { x: 44, y: 14, r: 4, speed: 0.1, drift: -22, o: 0.18 },
  { x: 58, y: 52, r: 2, speed: 0.16, drift: 20, o: 0.3 },
  { x: 84, y: 12, r: 3, speed: 0.14, drift: -16, o: 0.22 },
];

const Atmosphere: React.FC<{ tone: Tone }> = ({ tone }) => {
  const frame = useCurrentFrame();
  const dark = tone === 'dark';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((particle, index) => {
        const y = (particle.y + frame * particle.speed * 0.12) % 110;
        const x = particle.x + Math.sin(frame / 90 + index) * particle.drift * 0.12;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: particle.r * 2,
              height: particle.r * 2,
              borderRadius: '50%',
              backgroundColor: dark ? palette.mint : palette.amber,
              opacity: particle.o * (dark ? 0.7 : 0.5),
              filter: 'blur(0.4px)',
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dark
            ? 'radial-gradient(1200px 760px at 50% 40%, transparent 35%, rgba(4, 14, 10, 0.55) 100%)'
            : 'radial-gradient(1200px 760px at 50% 42%, transparent 40%, rgba(90, 73, 42, 0.16) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

type SceneShellProps = {
  scene: V2Scene;
  durationInFrames: number;
  chapterIndex: string;
  children: ReactNode;
  caption?: boolean;
  captionBottom?: number;
  captionMaxWidth?: number;
  showLogo?: boolean;
  showChapter?: boolean;
  style?: CSSProperties;
};

export const SceneShell: React.FC<SceneShellProps> = ({
  scene,
  durationInFrames,
  chapterIndex,
  children,
  caption = true,
  captionBottom = 58,
  captionMaxWidth = 1380,
  showLogo = true,
  showChapter = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], CLAMP);
  const dark = scene.tone === 'dark';
  return (
    <AbsoluteFill style={{ backgroundColor: dark ? palette.greenDark : palette.paper, ...style }}>
      <SceneBackdrop tone={dark ? 'dark' : 'paper'} glow="both" grid vignette />
      <Atmosphere tone={scene.tone} />
      {children}
      {caption ? (
        <V2Caption
          text={scene.caption}
          durationInFrames={durationInFrames}
          tone={scene.tone}
          bottom={captionBottom}
          maxWidth={captionMaxWidth}
        />
      ) : null}
      {showChapter ? (
        <ChapterTag
          chapter={scene.chapter}
          tone={scene.tone}
          index={chapterIndex}
        />
      ) : null}
      {showLogo ? (
        <div style={{ position: 'absolute', top: 50, right: 92, opacity: dark ? 0.78 : 0.55, zIndex: 30 }}>
          <Logo size={26} tone={dark ? 'dark' : 'paper'} />
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 3,
          width: `${progress * 100}%`,
          backgroundColor: dark ? palette.mint : palette.green,
          opacity: 0.72,
          zIndex: 50,
        }}
      />
    </AbsoluteFill>
  );
};
