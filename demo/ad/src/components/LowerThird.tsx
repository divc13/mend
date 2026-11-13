import React from 'react';
import type { CSSProperties } from 'react';
import { useCurrentFrame } from 'remotion';
import { fadeIn, riseIn } from '../motion';
import { fonts, palette } from '../theme';
import type { Tone } from '../types';

type ChapterMarkProps = {
  chapter: string;
  tone?: Tone;
  delay?: number;
};

export const ChapterMark: React.FC<ChapterMarkProps> = ({
  chapter,
  tone = 'dark',
  delay = 6,
}) => {
  const frame = useCurrentFrame();
  const progress = fadeIn(frame, delay, 20);
  const [number, ...rest] = chapter.split('—');
  const title = rest.join('—').trim();
  const light = tone === 'dark';
  return (
    <div
      style={{
        position: 'absolute',
        top: 62,
        left: 96,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 10}px)`,
      }}
    >
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: light ? palette.mint : palette.amber,
        }}
      >
        {number.trim()}
      </span>
      <span
        style={{
          width: 44,
          height: 1,
          backgroundColor: light ? 'rgba(245, 241, 230, 0.45)' : palette.lineStrong,
        }}
      />
      <span
        style={{
          fontFamily: fonts.body,
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: light ? 'rgba(245, 241, 230, 0.82)' : palette.inkSoft,
        }}
      >
        {title || chapter}
      </span>
    </div>
  );
};

type LowerThirdProps = {
  kicker: string;
  title: string;
  subtitle?: string;
  tone?: Tone;
  delay?: number;
  style?: CSSProperties;
};

export const LowerThird: React.FC<LowerThirdProps> = ({
  kicker,
  title,
  subtitle,
  tone = 'dark',
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = fadeIn(frame, delay, 24);
  const motion = riseIn(frame, delay, 24, 26);
  const light = tone === 'dark';
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom: 190,
        display: 'flex',
        alignItems: 'stretch',
        gap: 18,
        padding: '18px 26px 18px 20px',
        borderRadius: 16,
        backgroundColor: light ? 'rgba(7, 27, 21, 0.86)' : 'rgba(255, 253, 248, 0.96)',
        border: light ? '1px solid rgba(143, 211, 180, 0.28)' : `1px solid ${palette.line}`,
        boxShadow: light ? '0 20px 50px rgba(0, 0, 0, 0.3)' : '0 20px 50px rgba(17, 34, 29, 0.14)',
        opacity: motion.opacity,
        transform: motion.transform,
        ...style,
      }}
    >
      <div
        style={{
          width: 4,
          borderRadius: 2,
          backgroundColor: light ? palette.mint : palette.green,
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: light ? palette.mint : palette.amber,
            opacity: 0.9,
          }}
        >
          {kicker}
        </span>
        <span
          style={{
            fontFamily: fonts.display,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.05,
            color: light ? palette.paper : palette.ink,
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: 19,
              color: light ? 'rgba(245, 241, 230, 0.66)' : palette.muted,
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      <div style={{ opacity: progress }} />
    </div>
  );
};
