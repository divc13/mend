import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { fonts, palette } from '../../theme';

export type BidderRowProps = {
  name: string;
  price: number;
  score: number;
  winner?: boolean;
  reveal: number;
  scoreReveal: number;
  sealed?: boolean;
  style?: CSSProperties;
};

export const BidderRow: React.FC<BidderRowProps> = ({
  name,
  price,
  score,
  winner = false,
  reveal,
  scoreReveal,
  sealed = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(reveal, [0, 1], [0, 1], CLAMP);
  const scoreProgress = interpolate(scoreReveal, [0, 1], [0, 1], CLAMP);
  return (
    <div
      style={{
        position: 'absolute',
        width: 540,
        opacity: progress,
        transform: `translateX(${(1 - progress) * 54}px) translateY(${Math.sin(frame / 50 + price) * 2}px)`,
        padding: '16px 18px',
        borderRadius: 14,
        border: `1.5px solid ${winner ? palette.green : palette.line}`,
        backgroundColor: winner ? 'rgba(230, 244, 236, 0.96)' : 'rgba(255, 253, 248, 0.94)',
        boxShadow: winner
          ? '0 18px 44px rgba(14, 74, 57, 0.18)'
          : '0 12px 30px rgba(17, 34, 29, 0.10)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            backgroundColor: winner ? palette.green : palette.paperDeep,
            border: `1px solid ${winner ? palette.green : palette.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: winner ? palette.mint : palette.ink,
            fontFamily: fonts.display,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {name}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: fonts.body, fontSize: 18, fontWeight: 700, color: palette.ink }}>
              Contractor {name}
            </span>
            {winner ? (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: palette.green,
                  padding: '3px 6px',
                  borderRadius: 4,
                  backgroundColor: palette.mint,
                }}
              >
                WINNER
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 3, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', color: palette.muted }}>
            {sealed ? 'SEALED BID · HASH COMMITTED' : 'BID REVEALED · POLICY SCORED'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', color: palette.muted }}>BID</div>
          <div style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 700, color: palette.ink, lineHeight: 1 }}>
            {sealed ? '••••' : price.toLocaleString()}
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 8, color: palette.muted }}>USDC</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', color: palette.muted, width: 44 }}>SCORE</span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.paperDeep, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${scoreProgress * (score / 10000) * 100}%`,
              borderRadius: 4,
              backgroundColor: winner ? palette.green : palette.amber,
              transition: 'none',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 13,
            fontWeight: 800,
            color: winner ? palette.green : palette.inkSoft,
            width: 52,
            textAlign: 'right',
          }}
        >
          {Math.round(scoreProgress * score).toLocaleString()}
        </span>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        {['PRICE 40%', 'WARRANTY 25%', 'DURATION 20%', 'MATERIALS 15%'].map((item) => (
          <span
            key={item}
            style={{
              fontFamily: fonts.mono,
              fontSize: 7,
              letterSpacing: '0.06em',
              color: palette.muted,
              padding: '3px 5px',
              borderRadius: 3,
              backgroundColor: palette.paper,
              border: `1px solid ${palette.line}`,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};
