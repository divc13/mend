import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Neighbor, Sam } from '../../characters';
import { Logo } from '../../components/Logo';
import { SceneBackdrop } from '../../components/SceneBackdrop';
import { fonts, palette } from '../../theme';
import type { V3Scene } from '../lib/script';
import { v3Script } from '../lib/script';

const hash = (index: number): number => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const QrBlock: React.FC<{ size: number }> = ({ size }) => {
  const grid = 21;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const finder =
        (x < 7 && y < 7) ||
        (x >= grid - 7 && y < 7) ||
        (x < 7 && y >= grid - 7);
      const border =
        finder && (x % 7 === 0 || x % 7 === 6 || y % 7 === 0 || y % 7 === 6);
      const center = finder && x % 7 >= 2 && x % 7 <= 4 && y % 7 >= 2 && y % 7 <= 4;
      const on = finder ? border || center : hash(y * grid + x) > 0.56;
      if (on) {
        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x * (size / grid)}
            y={y * (size / grid)}
            width={size / grid}
            height={size / grid}
            fill={palette.ink}
          />,
        );
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', borderRadius: 8 }}>
      <rect width={size} height={size} fill={palette.surface} />
      {cells}
    </svg>
  );
};

const Metric: React.FC<{ value: string; label: string; accent?: boolean }> = ({
  value,
  label,
  accent = false,
}) => (
  <div
    style={{
      padding: '11px 14px',
      border: `1px solid ${accent ? palette.green : palette.line}`,
      backgroundColor: accent ? palette.green : 'rgba(255,253,248,0.72)',
      color: accent ? palette.paper : palette.ink,
      minWidth: 136,
    }}
  >
    <div style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 1 }}>{value}</div>
    <div
      style={{
        marginTop: 5,
        fontFamily: fonts.mono,
        fontSize: 9,
        letterSpacing: '0.08em',
        opacity: 0.74,
      }}
    >
      {label}
    </div>
  </div>
);

export const CloseV3: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 90 } });
  const card = spring({ frame: frame - 12, fps, config: { damping: 200, stiffness: 85 } });
  const hasUrl = v3Script.siteUrl.trim().length > 0;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper, overflow: 'hidden' }}>
      <SceneBackdrop tone="paper" glow="both" />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(120deg, rgba(143,211,180,0.16), transparent 42%, rgba(169,103,18,0.10))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: enter,
          padding: '56px 64px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Logo size={42} tone="paper" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.14em',
                color: palette.paper,
                backgroundColor: palette.green,
                padding: '9px 12px',
              }}
            >
              CLOSED · DURABILITY PASSED
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.12em',
                color: palette.muted,
              }}
            >
              REPLAY DATA · NO LIVE FUNDS
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 44 }}>
          <div style={{ flex: 1, maxWidth: 1090 }}>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                letterSpacing: '0.2em',
                color: palette.amberStrong,
                marginBottom: 16,
              }}
            >
              MEND / MAINTENANCE WITH MEMORY
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 100,
                lineHeight: 0.9,
                letterSpacing: '-0.05em',
                color: palette.ink,
              }}
            >
              Get it fixed.
              <br />
              Keep it fixed.
            </div>
            <div
              style={{
                marginTop: 24,
                fontFamily: fonts.body,
                fontSize: 27,
                lineHeight: 1.3,
                color: palette.inkSoft,
                maxWidth: 820,
              }}
            >
              For the price of a small repair, a neighborhood gets a memory. One work order, one passport, one receipt.
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 28, flexWrap: 'wrap' }}>
              <Metric value="100" label="USDC FUNDED" />
              <Metric value="20" label="REFUNDED AT AWARD" />
              <Metric value="72" label="PAID ON ACCEPT" accent />
              <Metric value="8" label="DURABILITY HELD" />
            </div>
            <div
              style={{
                marginTop: 26,
                display: 'flex',
                gap: 18,
                alignItems: 'center',
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.08em',
                color: palette.muted,
              }}
            >
              <span>2 OF 3 DAO</span>
              <span>3 SEALED BIDS</span>
              <span>NEAR TESTNET</span>
              <span>HUMAN INSPECTION</span>
            </div>
          </div>

          <div
            style={{
              width: 520,
              flexShrink: 0,
              transform: `translateY(${(1 - card) * 26}px)`,
              opacity: card,
              backgroundColor: palette.surface,
              border: `1px solid ${palette.line}`,
              boxShadow: '0 32px 80px rgba(17,34,29,0.14)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  color: palette.amberStrong,
                }}
              >
                {hasUrl ? 'SCAN TO TRY' : 'FINAL LINK PENDING'}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: fonts.display,
                  fontSize: 39,
                  lineHeight: 0.97,
                  letterSpacing: '-0.03em',
                  color: palette.ink,
                }}
              >
                {hasUrl ? v3Script.siteUrl : 'DEMO LINK'}
                <br />
                {hasUrl ? '' : 'IN DESCRIPTION'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 19, marginTop: 18 }}>
              <QrBlock size={206} />
              <div style={{ paddingBottom: 6 }}>
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: palette.muted,
                  }}
                >
                  QR PLACEHOLDER
                  <br />
                  HOST PENDING
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontFamily: fonts.display,
                    fontSize: 24,
                    color: palette.ink,
                  }}
                >
                  2:32 live tour
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 20,
                paddingTop: 15,
                borderTop: `1px solid ${palette.line}`,
                fontFamily: fonts.mono,
                fontSize: 9,
                lineHeight: 1.7,
                letterSpacing: '0.04em',
                color: palette.muted,
              }}
            >
              NEXT.JS · FASTIFY · POSTGRES
              <br />
              RUST ON NEAR · SPUTNIK DAO · NEAR AI
              <br />
              OUTLAYER · 1CLICK · AGENT MARKET
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <Sam pose="raise-phone" width={152} height={290} frame={frame} fps={fps} animated enterAt={8} />
            <Neighbor pose="hold-phone" width={92} height={180} frame={frame} fps={fps} animated enterAt={16} />
            <div
              style={{
                marginBottom: 12,
                fontFamily: fonts.mono,
                fontSize: 9,
                letterSpacing: '0.09em',
                color: palette.muted,
              }}
            >
              SAM + NEIGHBOR
              <br />
              REPORTED THE SAME POTHOLE
            </div>
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: '0.1em',
              color: palette.muted,
              textAlign: 'right',
            }}
          >
            MEND · 2:32 PRODUCT TOUR
            <br />
            SCRIPTED REPLAY · REAL APP
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
