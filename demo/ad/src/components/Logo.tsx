import React from 'react';
import type { CSSProperties } from 'react';
import { fonts, palette } from '../theme';
import type { Tone } from '../types';

type LogoProps = {
  size?: number;
  tone?: Tone;
  wordmark?: boolean;
  style?: CSSProperties;
};

export const Logo: React.FC<LogoProps> = ({
  size = 40,
  tone = 'paper',
  wordmark = true,
  style,
}) => {
  const onDark = tone === 'dark';
  const markBg = onDark ? palette.mint : palette.green;
  const markFg = onDark ? palette.greenDeep : palette.mint;
  const text = onDark ? palette.paper : palette.ink;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.32,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        <rect x="2" y="2" width="60" height="60" rx="18" fill={markBg} />
        <path
          d="M16 35h8l4-11 5 22 4-11h8"
          fill="none"
          stroke={markFg}
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 47h30"
          fill="none"
          stroke={markFg}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="3 5"
          opacity="0.75"
        />
      </svg>
      {wordmark ? (
        <span
          style={{
            fontFamily: fonts.display,
            fontWeight: 600,
            fontSize: size * 0.84,
            lineHeight: 1,
            letterSpacing: '0.16em',
            color: text,
            paddingRight: size * 0.12,
          }}
        >
          MEND
        </span>
      ) : null}
    </div>
  );
};
