import React from 'react';
import type { CSSProperties } from 'react';
import { useId } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { fonts, palette } from '../theme';

type RoadPlateProps = {
  variant?: 'pothole' | 'repair';
  label?: boolean;
  showCyclist?: boolean;
  style?: CSSProperties;
};

export const RoadPlate: React.FC<RoadPlateProps> = ({
  variant = 'pothole',
  label = true,
  showCyclist = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const uid = useId().replaceAll(':', '');
  const repair = variant === 'repair';
  const pulse = 0.5 + 0.5 * Math.sin(frame / 18);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        backgroundColor: repair ? '#10231c' : '#071711',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={repair ? '#1b3a2d' : '#071b15'} />
            <stop offset="58%" stopColor={repair ? '#294c3c' : '#123027'} />
            <stop offset="100%" stopColor="#0a1712" />
          </linearGradient>
          <radialGradient id={`${uid}-sun`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={repair ? '#f0c477' : '#d9a35a'} stopOpacity="0.72" />
            <stop offset="55%" stopColor={repair ? '#b87b2c' : '#8f5d25'} stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0a1712" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-road`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={repair ? '#22362c' : '#182a23'} />
            <stop offset="100%" stopColor="#08110d" />
          </linearGradient>
          <linearGradient id={`${uid}-puddle`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.mint} stopOpacity="0.42" />
            <stop offset="55%" stopColor="#7c9c88" stopOpacity="0.16" />
            <stop offset="100%" stopColor={palette.amber} stopOpacity="0.3" />
          </linearGradient>
          <filter id={`${uid}-rough`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.05"
              numOctaves="3"
              seed="11"
              result="noise"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill={`url(#${uid}-sky)`} />
        <circle cx="1260" cy="210" r="340" fill={`url(#${uid}-sun)`} />

        <g opacity="0.42">
          {[
            [60, 240, 150, 120],
            [210, 265, 120, 95],
            [350, 230, 180, 130],
            [560, 260, 140, 100],
            [720, 235, 170, 125],
            [920, 270, 120, 90],
            [1060, 245, 180, 115],
            [1270, 265, 150, 95],
            [1430, 240, 120, 120],
          ].map(([x, y, w, h], index) => (
            <g key={index}>
              <rect x={x} y={y} width={w} height={h} fill="#06130f" />
              {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((col) => {
                  const lit = (index * 7 + row * 3 + col) % 5 === 0;
                  return lit ? (
                    <rect
                      key={`${row}-${col}`}
                      x={x + 14 + col * (w / 4.6)}
                      y={y + 14 + row * (h / 3.4)}
                      width={8}
                      height={6}
                      fill={palette.amber}
                      opacity={0.6}
                    />
                  ) : null;
                }),
              )}
            </g>
          ))}
        </g>

        <path d="M -200 900 L 610 330 L 990 330 L 1820 900 Z" fill={`url(#${uid}-road)`} />
        <path d="M -200 900 L 610 330 L 540 330 L -360 900 Z" fill="#13271f" opacity="0.86" />
        <path d="M 1820 900 L 990 330 L 1060 330 L 1920 900 Z" fill="#0d1f18" opacity="0.9" />
        <path d="M 610 330 L 990 330" stroke="#3a5547" strokeWidth="3" opacity="0.5" />

        <g stroke="#d8c9a6" strokeWidth="9" strokeLinecap="round" opacity="0.28">
          <path d="M 800 390 L 800 455" />
          <path d="M 800 520 L 800 610" />
          <path d="M 800 690 L 800 820" />
        </g>

        {repair ? (
          <g>
            <rect
              x="905"
              y="545"
              width="290"
              height="132"
              rx="26"
              fill="#1c3027"
              stroke={palette.mint}
              strokeWidth="3"
              opacity="0.95"
            />
            <path
              d="M 930 570 L 1170 570 M 930 600 L 1170 600 M 930 630 L 1170 630"
              stroke={palette.mint}
              strokeWidth="2"
              strokeDasharray="8 10"
              opacity="0.45"
            />
            {[
              [870, 700, 1],
              [1210, 710, 0.9],
              [1040, 760, 0.8],
            ].map(([x, y, scale], index) => (
              <g key={index} transform={`translate(${x} ${y}) scale(${scale})`}>
                <path d="M -28 0 L 28 0 L 0 -64 Z" fill={palette.amber} />
                <path d="M -18 -24 L 18 -24 L 9 -42 L -9 -42 Z" fill={palette.paper} opacity="0.85" />
                <rect x="-34" y="0" width="68" height="9" rx="4" fill={palette.amberStrong} />
              </g>
            ))}
            <g transform="translate(1050 505)">
              <circle cx="0" cy="0" r="30" fill={palette.mint} opacity="0.18" />
              <circle cx="0" cy="0" r="20" fill={palette.mint} opacity="0.35" />
              <circle cx="0" cy="0" r="8" fill={palette.mint} />
            </g>
          </g>
        ) : (
          <g>
            <ellipse
              cx="1040"
              cy="610"
              rx="168"
              ry="64"
              fill="#020806"
              filter={`url(#${uid}-rough)`}
            />
            <ellipse
              cx="1040"
              cy="610"
              rx="168"
              ry="64"
              fill="none"
              stroke="#3c5749"
              strokeWidth="10"
              opacity="0.8"
              filter={`url(#${uid}-rough)`}
            />
            <ellipse cx="1015" cy="600" rx="96" ry="27" fill={`url(#${uid}-puddle)`} />
            <path
              d="M 900 590 L 935 575 M 1135 635 L 1180 650 M 975 655 L 950 670"
              stroke="#0a1510"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.9"
            />
            <g transform="translate(1040 495)">
              <circle
                cx="0"
                cy="46"
                r={34 + pulse * 16}
                fill="none"
                stroke={palette.amber}
                strokeWidth="2"
                opacity={0.25 + pulse * 0.35}
              />
              <path
                d="M 0 42 C 0 42 26 16 26 -2 A 26 26 0 1 0 -26 -2 C -26 16 0 42 0 42 Z"
                fill={palette.amber}
              />
              <circle cx="0" cy="-2" r="9" fill={palette.paper} />
            </g>
          </g>
        )}

        {showCyclist ? (
          <g opacity="0.7">
            <path
              d="M 430 760 C 650 700 830 690 1010 645 C 1160 610 1240 580 1320 540"
              fill="none"
              stroke={palette.amber}
              strokeWidth="3"
              strokeDasharray="8 10"
              opacity="0.55"
            />
            <g transform="translate(870 690)" stroke={palette.paper} strokeWidth="3" fill="none">
              <circle cx="-34" cy="22" r="22" />
              <circle cx="38" cy="22" r="22" />
              <path d="M -34 22 L -4 -18 L 24 22 L -34 22 M -4 -18 L 38 22 M 24 22 L 10 -10 L 38 22" />
              <circle cx="10" cy="-38" r="10" />
              <path d="M 10 -28 L 2 0 M 10 -28 L 26 -22" />
            </g>
            <g transform="translate(955 630)">
              <path d="M 0 -22 L 22 16 L -22 16 Z" fill={palette.amber} opacity="0.9" />
              <path d="M 0 -9 L 0 5 M 0 10 L 0 12" stroke={palette.greenDark} strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>
        ) : null}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(5, 18, 14, 0.72) 0%, rgba(5, 18, 14, 0.3) 44%, rgba(5, 18, 14, 0.1) 70%, rgba(5, 18, 14, 0.45) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(5, 18, 14, 0.82) 0%, transparent 32%, transparent 78%, rgba(5, 18, 14, 0.35) 100%)',
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            top: 96,
            right: 96,
            padding: '8px 13px',
            borderRadius: 8,
            border: '1px solid rgba(245, 241, 230, 0.24)',
            backgroundColor: 'rgba(5, 18, 14, 0.45)',
            fontFamily: fonts.mono,
            fontSize: 13,
            letterSpacing: '0.14em',
            color: 'rgba(245, 241, 230, 0.62)',
          }}
        >
          {repair ? 'REPAIR FOOTAGE PLACEHOLDER' : 'STOCK FOOTAGE PLACEHOLDER'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
