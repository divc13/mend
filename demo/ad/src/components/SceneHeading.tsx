import React from 'react';
import type { CSSProperties } from 'react';
import { useCurrentFrame } from 'remotion';
import { beatOpacity, riseIn } from '../motion';
import { fonts, palette } from '../theme';
import type { Tone } from '../types';

export type HeadingBeat = {
  kicker?: string;
  title: string;
  body?: string;
};

type SceneHeadingProps = HeadingBeat & {
  tone?: Tone;
  size?: number;
  delay?: number;
  width?: number;
  style?: CSSProperties;
};

export const SceneHeading: React.FC<SceneHeadingProps> = ({
  kicker,
  title,
  body,
  tone = 'dark',
  size = 82,
  delay = 0,
  width,
  style,
}) => {
  const frame = useCurrentFrame();
  const motion = riseIn(frame, delay, 26, 28);
  const light = tone === 'dark';
  const lines = title.split('\n');
  return (
    <div
      style={{
        width,
        opacity: motion.opacity,
        transform: motion.transform,
        ...style,
      }}
    >
      {kicker ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              width: 34,
              height: 2,
              backgroundColor: light ? palette.mint : palette.amber,
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: light ? palette.mint : palette.amber,
            }}
          >
            {kicker}
          </span>
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 0.97,
          letterSpacing: '-0.03em',
          color: light ? palette.paper : palette.ink,
          textWrap: 'balance',
        }}
      >
        {lines.map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      {body ? (
        <div
          style={{
            marginTop: 22,
            maxWidth: 700,
            fontFamily: fonts.body,
            fontSize: 27,
            lineHeight: 1.45,
            color: light ? 'rgba(245, 241, 230, 0.7)' : palette.muted,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

type BeatHeadingsProps = {
  beats: HeadingBeat[];
  starts: number[];
  tone?: Tone;
  size?: number;
  style?: CSSProperties;
  delay?: number;
};

export const BeatHeadings: React.FC<BeatHeadingsProps> = ({
  beats,
  starts,
  tone = 'dark',
  size = 82,
  style,
  delay = 8,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', ...style }}>
      {beats.map((beat, index) => (
        <div
          key={`${beat.title}-${index}`}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: beatOpacity(frame, index, starts, 12),
          }}
        >
          <SceneHeading
            kicker={beat.kicker}
            title={beat.title}
            body={beat.body}
            tone={tone}
            size={size}
            delay={index === 0 ? delay : 0}
          />
        </div>
      ))}
    </div>
  );
};
