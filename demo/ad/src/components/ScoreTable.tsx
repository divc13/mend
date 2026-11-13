import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, EASE_OUT, fadeIn } from '../motion';
import { Chip } from './Chip';
import { KineticNumber } from './KineticNumber';
import { fonts, palette } from '../theme';

export type BidRow = {
  id: string;
  letter: string;
  name: string;
  score: number;
  note?: string;
};

type ScoreTableProps = {
  rows: BidRow[];
  maxScore?: number;
  revealAt?: number;
  winnerId?: string;
  winnerAt?: number;
  style?: CSSProperties;
};

export const ScoreTable: React.FC<ScoreTableProps> = ({
  rows,
  maxScore = 10000,
  revealAt = 0,
  winnerId,
  winnerAt,
  style,
}) => {
  const frame = useCurrentFrame();
  const winnerReveal = winnerAt ?? revealAt + 48;
  return (
    <div
      style={{
        width: '100%',
        borderRadius: 28,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 30px 80px rgba(17, 34, 29, 0.14)',
        padding: '26px 30px 20px',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 14,
          borderBottom: `1px solid ${palette.line}`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: '0.16em',
            color: palette.muted,
          }}
        >
          CONTRACTOR / WEIGHTED SCORE
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: '0.12em',
            color: palette.muted,
          }}
        >
          MAX {maxScore.toLocaleString('en-US')}
        </span>
      </div>
      {rows.map((row, index) => {
        const rowIn = fadeIn(frame, revealAt + index * 7, 18);
        const barProgress = interpolate(
          frame,
          [revealAt + 8 + index * 7, revealAt + 52 + index * 7],
          [0, 1],
          { ...CLAMP, easing: EASE_OUT },
        );
        const isWinner = row.id === winnerId;
        const winnerProgress = isWinner ? fadeIn(frame, winnerReveal, 22) : 0;
        const showWinner = isWinner && frame >= winnerReveal;
        return (
          <div
            key={row.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '18px 14px',
              margin: '0 -14px',
              borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${palette.line}`,
              opacity: rowIn,
              transform: `translateY(${(1 - rowIn) * 16}px)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '4px 0',
                borderRadius: 14,
                backgroundColor: palette.mintSoft,
                opacity: winnerProgress * 0.85,
              }}
            />
            <div
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: showWinner ? palette.green : palette.paper,
                color: showWinner ? palette.paper : palette.inkSoft,
                border: showWinner ? 'none' : `1px solid ${palette.lineStrong}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: fonts.display,
                fontSize: 24,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {row.letter}
            </div>
            <div style={{ position: 'relative', width: 230, flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: 27,
                  fontWeight: 600,
                  color: palette.ink,
                  lineHeight: 1.1,
                }}
              >
                {row.name}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  color: palette.muted,
                  marginTop: 2,
                }}
              >
                {row.note ?? 'Sealed bid'}
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: palette.paper,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(row.score / maxScore) * barProgress * 100}%`,
                    borderRadius: 7,
                    backgroundColor: showWinner ? palette.green : 'rgba(14, 74, 57, 0.28)',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                width: 112,
                textAlign: 'right',
                fontFamily: fonts.display,
                fontSize: 34,
                fontWeight: 600,
                color: showWinner ? palette.green : palette.inkSoft,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <KineticNumber
                value={row.score}
                from={0}
                delay={revealAt + 8 + index * 7}
                duration={44}
                style={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}
              />
            </div>
            <div
              style={{
                position: 'relative',
                width: 98,
                display: 'flex',
                justifyContent: 'flex-end',
                opacity: winnerProgress,
              }}
            >
              <Chip tone="green" size="sm" icon="check">
                Winner
              </Chip>
            </div>
          </div>
        );
      })}
    </div>
  );
};
