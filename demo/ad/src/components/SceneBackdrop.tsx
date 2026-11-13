import React from 'react';
import type { CSSProperties } from 'react';
import { AbsoluteFill } from 'remotion';
import { palette } from '../theme';

export type BackdropTone = 'paper' | 'dark' | 'green';

type SceneBackdropProps = {
  tone?: BackdropTone;
  glow?: 'mint' | 'amber' | 'both' | 'none';
  grid?: boolean;
  vignette?: boolean;
  style?: CSSProperties;
  children?: React.ReactNode;
};

const baseByTone: Record<BackdropTone, CSSProperties> = {
  paper: {
    backgroundColor: palette.paper,
    backgroundImage: [
      'radial-gradient(1100px 720px at 8% -4%, rgba(143, 211, 180, 0.30), transparent 62%)',
      'radial-gradient(900px 640px at 96% 4%, rgba(169, 103, 18, 0.13), transparent 58%)',
      'linear-gradient(180deg, #f8f4ea 0%, #f1ebdd 100%)',
    ].join(', '),
  },
  dark: {
    backgroundColor: palette.greenDark,
    backgroundImage: [
      'radial-gradient(1000px 720px at 18% 10%, rgba(14, 74, 57, 0.55), transparent 65%)',
      'radial-gradient(900px 600px at 92% 86%, rgba(143, 211, 180, 0.16), transparent 60%)',
      'linear-gradient(145deg, #071b15 0%, #0b2a21 58%, #11221d 100%)',
    ].join(', '),
  },
  green: {
    backgroundColor: palette.green,
    backgroundImage: [
      'radial-gradient(900px 700px at 14% 0%, rgba(143, 211, 180, 0.26), transparent 60%)',
      'radial-gradient(800px 600px at 100% 100%, rgba(169, 103, 18, 0.18), transparent 62%)',
      'linear-gradient(160deg, #0e4a39 0%, #09372a 100%)',
    ].join(', '),
  },
};

export const SceneBackdrop: React.FC<SceneBackdropProps> = ({
  tone = 'paper',
  glow = 'both',
  grid = true,
  vignette = true,
  style,
  children,
}) => {
  const dark = tone !== 'paper';
  return (
    <AbsoluteFill style={{ ...baseByTone[tone], overflow: 'hidden', ...style }}>
      {glow !== 'none' ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              glow === 'mint'
                ? 'radial-gradient(700px 520px at 80% 20%, rgba(143, 211, 180, 0.18), transparent 65%)'
                : glow === 'amber'
                  ? 'radial-gradient(700px 520px at 80% 20%, rgba(169, 103, 18, 0.16), transparent 65%)'
                  : 'radial-gradient(700px 520px at 82% 18%, rgba(143, 211, 180, 0.16), transparent 65%), radial-gradient(620px 460px at 12% 92%, rgba(169, 103, 18, 0.10), transparent 65%)',
          }}
        />
      ) : null}
      {grid ? (
        <AbsoluteFill
          style={{
            opacity: dark ? 0.055 : 0.04,
            backgroundImage:
              'linear-gradient(rgba(17, 34, 29, 0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(17, 34, 29, 0.9) 1px, transparent 1px)',
            backgroundSize: '96px 96px',
          }}
        />
      ) : null}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, opacity: dark ? 0.10 : 0.08 }}
        aria-hidden="true"
      >
        <g fill="none" stroke={dark ? palette.mint : palette.green} strokeWidth="1.4">
          <ellipse cx="1530" cy="220" rx="430" ry="270" />
          <ellipse cx="1530" cy="220" rx="340" ry="210" />
          <ellipse cx="1530" cy="220" rx="250" ry="150" />
          <ellipse cx="1530" cy="220" rx="160" ry="92" />
          <ellipse cx="320" cy="960" rx="420" ry="230" />
          <ellipse cx="320" cy="960" rx="320" ry="172" />
          <ellipse cx="320" cy="960" rx="220" ry="116" />
        </g>
      </svg>
      {children}
      {vignette ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 46%, rgba(7, 20, 16, 0.28) 100%)',
            opacity: dark ? 0.9 : 0.35,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
