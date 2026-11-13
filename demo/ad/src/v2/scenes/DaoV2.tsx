import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import { LiveCapture, MediaBadge } from '../components/LivePanel';
import { CouncilTable } from '../components/PaperCast';
import { StickFigure } from '../components/CharacterCast';
import {
  CueRing,
  CueStamp,
  RevealCard,
  SceneWash,
  TinyLabel,
  V2Heading,
} from '../components/SceneChrome';
import { SceneShell } from '../components/SceneShell';
import { useCue } from '../lib/cues';
import type { V2SceneProps } from '../types';

const BudgetEnvelope: React.FC<{ open: number }> = ({ open }) => (
  <div style={{ position: 'relative', width: 340, height: 230 }}>
    <svg viewBox="0 0 340 230" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="envelope-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbf6e8" />
          <stop offset="100%" stopColor="#e9e0cd" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="320" height="200" rx="10" fill="url(#envelope-paper)" stroke={palette.ink} strokeWidth="3" />
      <path d="M10 30 L170 130 L330 30" fill="none" stroke={palette.ink} strokeWidth="3" opacity={Math.max(0, 1 - open * 1.5)} />
      <path
        d={`M10 30 L170 ${30 + open * 92} L330 30`}
        fill={palette.paperDeep}
        stroke={palette.ink}
        strokeWidth="3"
        strokeLinejoin="round"
        opacity={Math.max(0, 1 - open * 1.5)}
      />
      <g transform={`translate(0 ${(1 - open) * 78})`} opacity={0.2 + open * 0.8}>
        <rect x="54" y="52" width="232" height="112" rx="7" fill={palette.surface} stroke={palette.ink} strokeWidth="2" />
        <text x="76" y="88" fill={palette.amber} fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" letterSpacing="2">MAX BUDGET</text>
        <text x="76" y="126" fill={palette.ink} fontFamily="Georgia, serif" fontSize="38" fontWeight="700">100 USDC</text>
        <path d="M76 144 h184" stroke={palette.line} strokeWidth="2" />
        <text x="76" y="158" fill={palette.muted} fontFamily="ui-monospace, monospace" fontSize="8" letterSpacing="1.5">SCOPE · POTHOLE REPAIR · 12 MO WARRANTY</text>
      </g>
    </svg>
    <div
      style={{
        position: 'absolute',
        right: -22,
        top: 12,
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: `2px dashed ${palette.amber}`,
        backgroundColor: palette.amberSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${-8 + open * 6}deg) scale(${0.8 + open * 0.2})`,
        opacity: 0.55 + open * 0.45,
      }}
    >
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 800, color: palette.amberStrong }}>SEALED</span>
    </div>
  </div>
);

export const DaoV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'dao', sequenceFrom, index: 0, fallbackAt: 2.4 });
  const c1 = useCue({ sceneId: 'dao', sequenceFrom, index: 1, fallbackAt: 8.8 });
  const c2 = useCue({ sceneId: 'dao', sequenceFrom, index: 2, fallbackAt: 14.8 });
  const c3 = useCue({ sceneId: 'dao', sequenceFrom, index: 3, fallbackAt: 21.6 });
  const c4 = useCue({ sceneId: 'dao', sequenceFrom, index: 4, fallbackAt: 27.2 });
  const c5 = useCue({ sceneId: 'dao', sequenceFrom, index: 5, fallbackAt: 33.6 });
  const votes = c4.active ? 2 : c3.active ? 1 : 0;
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.04], CLAMP);

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="03">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '58% 44%' }}>
        <div style={{ position: 'absolute', left: 96, top: 164, width: 950 }}>
          <V2Heading
            kicker="Authorize"
            title={'Steward proposes.\nDAO decides.'}
            body="The budget, roster and scoring policy are on-chain."
            tone="paper"
            size={88}
            width={940}
          />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 438, width: 830, height: 440 }}>
          <LiveCapture
            sceneId="dao"
            label="mend.app / steward"
            tone="paper"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 22, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="paper">STEWARD · HUMAN</MediaBadge>
            <MediaBadge tone="paper">SCOPE + MAX BUDGET</MediaBadge>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 22,
              right: 22,
              bottom: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 5,
            }}
          >
            <TinyLabel>Proposal 0241</TinyLabel>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: palette.green,
              }}
            >
              STATUS · PROPOSED
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1240,
            top: 400,
            opacity: 0.98,
            transform: `translateY(${Math.sin(frame / 46) * 4}px)`,
          }}
        >
          <CouncilTable votes={votes} scale={0.78} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1620,
            top: 710,
            opacity: 0.92,
            transform: `translateX(${Math.sin(frame / 58) * 3}px)`,
          }}
        >
          <StickFigure role="steward" pose="clipboard" scale={0.62} seed={7} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 940,
            top: 236,
            opacity: Math.max(0, c2.progress),
            transform: `translateY(${(1 - Math.max(0, c2.progress)) * 34}px) rotate(${Math.sin(frame / 60) * 1.2}deg)`,
          }}
        >
          <BudgetEnvelope open={Math.max(0, Math.min(1, c2.progress * 1.2))} />
        </div>

        <RevealCard cue={c3} from="bottom" style={{ left: 966, top: 520, width: 330 }}>
          <TinyLabel>Council vote</TinyLabel>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: index < votes ? palette.mintSoft : palette.surface,
                  border: `2px solid ${index < votes ? palette.green : palette.line}`,
                  color: index < votes ? palette.green : palette.mutedLight,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 15,
                  fontWeight: 800,
                  transform: `scale(${index < votes ? 1 : 0.9})`,
                }}
              >
                {index < votes ? '✓' : index + 1}
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 4 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 25, fontWeight: 700, color: palette.ink }}>{votes}/3</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 8, letterSpacing: '0.1em', color: palette.muted }}>APPROVED</span>
            </div>
          </div>
          <div style={{ marginTop: 10, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.muted }}>
            NOT AI · NOT PLATFORM
          </div>
        </RevealCard>

        <RevealCard cue={c5} from="right" style={{ right: 96, top: 858, width: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TinyLabel>On-chain receipt</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.green }}>NEAR TESTNET</span>
          </div>
          <div style={{ marginTop: 7, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: palette.inkSoft }}>
            0x7f3a…c91e · proposal.0241 · 2/3
          </div>
          <div style={{ marginTop: 6, height: 3, backgroundColor: palette.line, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, c5.progress) * 100}%`, backgroundColor: palette.green }} />
          </div>
        </RevealCard>

        <CueRing cue={c3} tone="paper" size={280} style={{ left: 1160, top: 540 }} />
        <CueStamp
          cue={c2}
          label="Max budget"
          sublabel="100 USDC · sealed"
          tone="paper"
          rotate={-5}
          style={{ left: 1050, top: 300 }}
        />
        <CueStamp
          cue={c4}
          label="2 of 3"
          sublabel="DAO authorized"
          tone="paper"
          rotate={4}
          style={{ right: 400, top: 780 }}
        />
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 928,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <TinyLabel>AI has no payment authority.</TinyLabel>
        </div>
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
