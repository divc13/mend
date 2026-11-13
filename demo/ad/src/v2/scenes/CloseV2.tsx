import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP } from '../../motion';
import { Logo } from '../../components/Logo';
import { fonts, palette } from '../../theme';
import { Pothole } from '../components/PaperCast';
import { Sam, StickFigure } from '../components/CharacterCast';
import { CueRing, CueStamp, SceneWash, TinyLabel, V2Heading, cueBounce } from '../components/SceneChrome';
import { SceneShell } from '../components/SceneShell';
import { useCue } from '../lib/cues';
import { v2Script } from '../lib/script';
import type { V2SceneProps } from '../types';

const hash = (index: number): number => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const QrPlaceholder: React.FC<{ size?: number }> = ({ size = 118 }) => {
  const cells: React.ReactNode[] = [];
  const grid = 21;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const finder =
        (x < 7 && y < 7) ||
        (x >= grid - 7 && y < 7) ||
        (x < 7 && y >= grid - 7);
      const border =
        finder &&
        (x % 7 === 0 || x % 7 === 6 || y % 7 === 0 || y % 7 === 6);
      const center =
        finder &&
        x % 7 >= 2 &&
        x % 7 <= 4 &&
        y % 7 >= 2 &&
        y % 7 <= 4;
      if (border || center || (!finder && hash(x * 31 + y * 17 + 3) > 0.52)) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette.ink} />);
      }
    }
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        padding: 8,
        borderRadius: 10,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${grid} ${grid}`} aria-label="Demo QR placeholder">
        <rect width={grid} height={grid} fill={palette.surface} />
        {cells}
      </svg>
    </div>
  );
};

const Sunrise: React.FC<{ rise: number }> = ({ rise }) => {
  const frame = useCurrentFrame();
  const sunY = 520 - rise * 250;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#f4d7ad' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #f8e3bf 0%, #f5c99a 30%, #e7b183 48%, #a7cbb2 66%, #5e8f76 78%, #1d3a2f 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 920,
          top: sunY,
          width: 260,
          height: 260,
          borderRadius: '50%',
          backgroundColor: '#f7d98a',
          boxShadow: '0 0 120px rgba(247, 217, 138, 0.8), 0 0 260px rgba(247, 217, 138, 0.4)',
          opacity: 0.5 + rise * 0.5,
        }}
      />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 140 + index * 430 + Math.sin(frame / 100 + index) * 20,
            top: 170 + index * 54,
            width: 190 + index * 60,
            height: 46,
            borderRadius: 999,
            backgroundColor: 'rgba(255, 253, 248, 0.45)',
            filter: 'blur(1px)',
          }}
        />
      ))}
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={`b-${index}`}
          style={{
            position: 'absolute',
            left: 100 + index * 360,
            top: 330 - (index % 2) * 26,
            width: 240,
            height: 220 + (index % 2) * 50,
            backgroundColor: index % 2 === 0 ? '#5d7f6b' : '#4f705e',
            opacity: 0.55,
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', gap: 18, margin: '28px 0 0 24px' }}>
              {[0, 1, 2].map((col) => (
                <div
                  key={col}
                  style={{
                    width: 24,
                    height: 30,
                    backgroundColor: (row + col + index) % 3 === 0 ? '#f4d79b' : 'rgba(245, 241, 230, 0.12)',
                    opacity: (row + col + index) % 3 === 0 ? 0.55 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 610, height: 80, backgroundColor: '#4c5b54' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 690,
          bottom: 0,
          background:
            'repeating-linear-gradient(90deg, transparent 0 140px, rgba(245, 241, 230, 0.18) 140px 150px), linear-gradient(180deg, #3b4a43, #202925)',
        }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 600, height: 6, backgroundColor: palette.amber, opacity: 0.5 }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(7, 27, 21, 0.18) 0%, transparent 30%, transparent 68%, rgba(7, 27, 21, 0.42) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const CloseV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c0 = useCue({ sceneId: 'close', sequenceFrom, index: 0, fallbackAt: 0.8 });
  const c1 = useCue({ sceneId: 'close', sequenceFrom, index: 1, fallbackAt: 4.2 });
  const c2 = useCue({ sceneId: 'close', sequenceFrom, index: 2, fallbackAt: 7.4 });
  const c3 = useCue({ sceneId: 'close', sequenceFrom, index: 3, fallbackAt: 11 });
  const c4 = useCue({ sceneId: 'close', sequenceFrom, index: 4, fallbackAt: 14.6 });
  const c5 = useCue({ sceneId: 'close', sequenceFrom, index: 5, fallbackAt: 17.4 });
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.05], CLAMP);
  const cardIn = spring({ frame: Math.max(0, c3.since), fps, config: { damping: 200, stiffness: 90 } });
  const ctaIn = spring({ frame: Math.max(0, c5.since), fps, config: { damping: 180, stiffness: 110 } });
  const logoIn = spring({ frame: Math.max(0, c4.since), fps, config: { damping: 14, stiffness: 160 } });
  const samBounce = cueBounce(c5, 12);
  const neighborBounce = cueBounce(c5, 12);
  const samOpacity = interpolate(c1.since, [0, 18], [0, 1], CLAMP);
  const neighborOpacity = interpolate(c2.since, [0, 18], [0, 1], CLAMP);

  return (
    <SceneShell
      scene={scene}
      durationInFrames={durationInFrames}
      chapterIndex="09"
      showLogo={false}
      showChapter={false}
      captionBottom={44}
    >
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '42% 60%' }}>
        <Sunrise rise={Math.max(0, c0.progress)} />

        <Pothole variant="fixed" scale={0.55} style={{ left: 150, top: 700 }} label="Fixed pothole" />

        <div
          style={{
            position: 'absolute',
            left: 700,
            top: 410,
            opacity: samOpacity,
            transform: `translateY(${samBounce.y}px) scale(${samBounce.scale})`,
            transformOrigin: 'bottom center',
          }}
        >
          <Sam pose={c4.active ? 'cheer' : c1.active ? 'wave' : 'stand'} scale={1.02} seed={21} phoneGlow={0.2} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 490,
            opacity: neighborOpacity,
            transform: `translateY(${neighborBounce.y}px) scale(${neighborBounce.scale})`,
            transformOrigin: 'bottom center',
          }}
        >
          <StickFigure role="neighbor" pose={c4.active ? 'cheer' : 'wave'} scale={0.82} seed={23} />
        </div>

        <div
          style={{
            position: 'absolute',
            right: 88,
            top: 96,
            width: 650,
            height: 770,
            borderRadius: 24,
            border: `1px solid ${palette.line}`,
            backgroundColor: 'rgba(255, 253, 248, 0.94)',
            boxShadow: '0 40px 100px rgba(17, 34, 29, 0.24)',
            backdropFilter: 'blur(14px)',
            opacity: cardIn,
            transform: `translateX(${(1 - cardIn) * 80}px)`,
            padding: '34px 36px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ opacity: logoIn, transform: `scale(${0.85 + logoIn * 0.15})`, transformOrigin: 'left center' }}>
              <Logo size={54} tone="paper" />
            </div>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: palette.amber,
                padding: '5px 8px',
                borderRadius: 4,
                border: `1px solid rgba(169, 103, 18, 0.3)`,
              }}
            >
              MAINTENANCE WITH MEMORY
            </span>
          </div>

          <div
            style={{
              marginTop: 30,
              fontFamily: fonts.display,
              fontSize: 58,
              fontWeight: 600,
              lineHeight: 0.98,
              letterSpacing: '-0.035em',
              color: palette.ink,
            }}
          >
            Get it fixed.
            <br />
            Keep it fixed.
          </div>

          <div
            style={{
              marginTop: 18,
              fontFamily: fonts.body,
              fontSize: 22,
              lineHeight: 1.45,
              color: palette.muted,
              maxWidth: 520,
            }}
          >
            For the price of a small repair, a neighborhood gets a memory.
          </div>

          <div style={{ marginTop: 26, display: 'flex', gap: 8 }}>
            {['Report it', 'Fix it', 'Remember it'].map((step, index) => (
              <div
                key={step}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: `1px solid ${index === 0 ? palette.green : palette.line}`,
                  backgroundColor: index === 0 ? palette.green : palette.surface,
                  color: index === 0 ? palette.paper : palette.inkSoft,
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {step}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 18, opacity: ctaIn, transform: `translateY(${(1 - ctaIn) * 18}px)` }}>
            <QrPlaceholder size={118} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.14em', color: palette.muted }}>
                {v2Script.siteUrl ? 'SCAN TO TRY' : 'FINAL LINK PENDING'}
              </span>
              <span style={{ fontFamily: fonts.display, fontSize: v2Script.siteUrl ? 24 : 20, fontWeight: 600, color: palette.ink }}>
                {v2Script.siteUrl || 'DEMO LINK IN DESCRIPTION'}
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: 8, color: palette.muted }}>
                {v2Script.siteUrl ? 'HOSTED DEMO' : 'QR PLACEHOLDER · HOST PENDING'}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 18,
              borderTop: `1px solid ${palette.line}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontFamily: fonts.mono, fontSize: 8, letterSpacing: '0.06em', color: palette.muted }}>
              Pothole scenario: REPLAY / SIMULATION.
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 8, letterSpacing: '0.06em', color: palette.muted }}>
              Contracts, DAO vote, AI signature, market: NEAR testnet / production as labelled.
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 8, letterSpacing: '0.06em', color: palette.muted }}>
              Pothole and repair footage: illustrative stock.
            </span>
          </div>
        </div>

        <CueRing cue={c3} tone="paper" size={360} style={{ left: 760, top: 520 }} />
        <CueStamp
          cue={c3}
          label="Maintenance with memory"
          sublabel="One asset · one permanent record"
          tone="paper"
          rotate={-3}
          style={{ left: 560, top: 300 }}
        />
        <CueStamp
          cue={c4}
          label="MEND"
          sublabel="Report · fix · remember"
          tone="paper"
          rotate={4}
          style={{ left: 360, top: 600 }}
        />
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 96,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ width: 44, height: 1, backgroundColor: palette.green, opacity: 0.5 }} />
          <TinyLabel>Riverside path · fixed</TinyLabel>
        </div>
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
