import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { ChapterMark } from '../components/LowerThird';
import { BeatHeadings } from '../components/SceneHeading';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { beatOpacity, fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const RecordPage: React.FC = () => {
  const events = [
    ['Reported', '2 reports merged privately'],
    ['Authorized', '2 of 3 council votes'],
    ['Repaired', 'Evidence hashed'],
    ['Inspected', 'Independent human'],
    ['Paid', '72 paid · 8 held'],
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 322,
        top: 20,
        width: 500,
        height: 690,
        borderRadius: 24,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 30px 70px rgba(17, 34, 29, 0.18)',
        padding: '26px 28px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: '0.18em',
          color: palette.amber,
        }}
      >
        MAINTENANCE PASSPORT
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: fonts.display,
          fontSize: 34,
          fontWeight: 600,
          lineHeight: 1.04,
          color: palette.ink,
        }}
      >
        Work order 001
      </div>
      <div style={{ marginTop: 4, fontFamily: fonts.body, fontSize: 14, color: palette.muted }}>
        Public asset · pothole repair
      </div>
      <div style={{ height: 1, backgroundColor: palette.line, margin: '16px 0 8px' }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.map(([title, note], index) => (
          <div key={title} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: palette.green,
                  color: palette.paper,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="check" size={12} strokeWidth={3} />
              </div>
              {index < events.length - 1 ? (
                <div style={{ width: 1, flex: 1, minHeight: 18, backgroundColor: palette.mint }} />
              ) : null}
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div style={{ fontFamily: fonts.body, fontSize: 15, fontWeight: 650, color: palette.ink }}>
                {title}
              </div>
              <div style={{ fontFamily: fonts.body, fontSize: 11, color: palette.muted }}>{note}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: `1px solid ${palette.line}`,
            fontFamily: fonts.body,
            fontSize: 12,
          }}
        >
          <span style={{ color: palette.muted }}>Warranty</span>
          <span style={{ color: palette.ink, fontWeight: 650 }}>8 USDC held</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: `1px solid ${palette.line}`,
            fontFamily: fonts.body,
            fontSize: 12,
          }}
        >
          <span style={{ color: palette.muted }}>History</span>
          <span style={{ color: palette.ink, fontWeight: 650 }}>2 reports · 3 bids</span>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '9px 10px',
            borderRadius: 8,
            backgroundColor: palette.greenDark,
            color: palette.mint,
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textAlign: 'center',
          }}
        >
          SAME ASSET · SAME HISTORY
        </div>
      </div>
    </div>
  );
};

const PassportSpread: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const open = fadeIn(frame, 18, 42);
  const stamp = fadeIn(frame, (starts[3] ?? 0) + 10, 24);
  return (
    <div style={{ position: 'relative', width: 840, height: 740 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 20,
          width: 350,
          height: 690,
          borderRadius: 26,
          background: `linear-gradient(145deg, ${palette.green} 0%, ${palette.greenDeep} 100%)`,
          border: '1px solid rgba(143, 211, 180, 0.45)',
          boxShadow: '0 34px 80px rgba(17, 34, 29, 0.28)',
          transform: 'rotate(-4deg)',
          padding: 24,
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: 18,
            border: '1px dashed rgba(143, 211, 180, 0.38)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Logo size={52} tone="dark" />
          <div
            style={{
              marginTop: 30,
              fontFamily: fonts.mono,
              fontSize: 13,
              letterSpacing: '0.18em',
              color: palette.mint,
            }}
          >
            MAINTENANCE
            <br />
            PASSPORT
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: fonts.display,
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.1,
              color: palette.paper,
            }}
          >
            One asset.
            <br />
            One record.
          </div>
          <div
            style={{
              marginTop: 24,
              width: 92,
              height: 92,
              borderRadius: 46,
              border: '1px solid rgba(143, 211, 180, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.mint,
              fontFamily: fonts.display,
              fontSize: 44,
              fontWeight: 600,
            }}
          >
            M
          </div>
          <div
            style={{
              marginTop: 'auto',
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'rgba(245, 241, 230, 0.58)',
              lineHeight: 1.7,
            }}
          >
            PUBLIC ASSET
            <br />
            NEAR TESTNET
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: open,
          transform: `translateX(${(1 - open) * -150}px)`,
          zIndex: 1,
        }}
      >
        <RecordPage />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 492,
          padding: '12px 18px',
          border: `3px solid ${palette.green}`,
          borderRadius: 10,
          color: palette.green,
          fontFamily: fonts.mono,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.12em',
          transform: `rotate(-11deg) scale(${0.9 + stamp * 0.1})`,
          opacity: stamp,
          zIndex: 3,
          backgroundColor: 'rgba(230, 244, 236, 0.7)',
        }}
      >
        PERMANENT RECORD
      </div>

      <div
        style={{
          position: 'absolute',
          left: 138,
          top: 178,
          width: 566,
          height: 348,
          borderRadius: 24,
          padding: '26px 30px',
          backgroundColor: palette.amberSoft,
          border: `2px solid ${palette.amber}`,
          boxShadow: '0 30px 80px rgba(17, 34, 29, 0.24)',
          zIndex: 4,
          opacity: beatOpacity(frame, 2, starts, 10),
          transform: `translateY(${(1 - beatOpacity(frame, 2, starts, 10)) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 13,
            letterSpacing: '0.18em',
            color: palette.red,
          }}
        >
          IF IT FAILS
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: fonts.display,
            fontSize: 38,
            fontWeight: 600,
            lineHeight: 1.04,
            color: palette.ink,
          }}
        >
          Reopen the same
          <br />
          work order.
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: fonts.body,
            fontSize: 17,
            lineHeight: 1.45,
            color: palette.inkSoft,
          }}
        >
          The failure, the remedy and every payment stay in the same history.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Chip tone="red" size="sm" icon="x">
            New bounty
          </Chip>
          <Chip tone="red" size="sm" icon="x">
            New money
          </Chip>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 26,
            bottom: 22,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: palette.surface,
            color: palette.amber,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${palette.amber}`,
          }}
        >
          <Icon name="refresh" size={24} />
        </div>
      </div>
    </div>
  );
};

export const Passport: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(7), at(14), at(20)];
  const beats = [
    {
      kicker: 'Step 01 · Remember',
      title: 'One asset.\nOne record.',
      body: 'Every report, bid, inspection and payment stays attached to the asset.',
    },
    {
      kicker: 'Step 02 · Reopen',
      title: 'The history\nstays open.',
      body: 'Reopen the same work order. Not a new bounty. Not a new story.',
    },
    {
      kicker: 'Step 03 · Fail safe',
      title: 'Failure cannot\ndisappear.',
      body: 'No new money. The remedy is part of the permanent record.',
    },
    {
      kicker: 'Step 04 · Keep',
      title: 'Maintenance\nwith memory.',
      body: 'The passport keeps the failure, the fix, and the payment in one place.',
    },
  ];
  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" />
      <ChapterMark chapter={scene.chapter} tone="paper" />
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="paper"
        size={80}
        style={{ left: 120, top: 200, width: 740, height: 380 }}
      />
      <div style={{ position: 'absolute', left: 960, top: 130 }}>
        <PassportSpread starts={starts} />
      </div>
      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
