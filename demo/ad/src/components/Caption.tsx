import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, fadeIn } from '../motion';
import { fonts, palette } from '../theme';

type CaptionProps = {
  text: string;
  delay?: number;
  bottom?: number;
  maxWidth?: number;
  style?: CSSProperties;
};

export const Caption: React.FC<CaptionProps> = ({
  text,
  delay = 18,
  bottom = 52,
  maxWidth = 1480,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = fadeIn(frame, delay, 22);
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom,
        width: 'auto',
        maxWidth,
        transform: `translateX(-50%) translateY(${(1 - progress) * 24}px)`,
        opacity: progress,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 22,
          padding: '22px 34px 22px 28px',
          borderRadius: 20,
          border: `1px solid ${palette.line}`,
          backgroundColor: 'rgba(255, 253, 248, 0.95)',
          boxShadow: '0 24px 64px rgba(17, 34, 29, 0.18)',
        }}
      >
        <div
          style={{
            width: 5,
            borderRadius: 3,
            backgroundColor: palette.green,
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {lines.map((line, index) => {
            const isFirst = index === 0;
            const many = lines.length > 2;
            return (
              <div
                key={`${line}-${index}`}
                style={{
                  fontFamily: fonts.body,
                  fontSize: many ? 32 : isFirst ? 38 : 34,
                  fontWeight: isFirst ? 650 : 450,
                  lineHeight: 1.24,
                  letterSpacing: '-0.012em',
                  color: isFirst ? palette.ink : palette.inkSoft,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const CaptionProgress: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [delay, delay + 30], [0, 100], CLAMP);
  return (
    <div
      style={{
        height: 2,
        width: `${width}%`,
        backgroundColor: palette.mint,
        opacity: 0.7,
      }}
    />
  );
};
