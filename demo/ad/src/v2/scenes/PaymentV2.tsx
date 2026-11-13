import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import { LiveCapture, MediaBadge } from '../components/LivePanel';
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

type SplitRowProps = {
  label: string;
  amount: number;
  color: string;
  progress: number;
  note: string;
};

const SplitRow: React.FC<SplitRowProps> = ({ label, amount, color, progress, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.3 + progress * 0.7 }}>
    <div style={{ width: 104, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: palette.inkSoft, textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ flex: 1, height: 22, borderRadius: 5, backgroundColor: palette.paperDeep, overflow: 'hidden', border: `1px solid ${palette.line}` }}>
      <div
        style={{
          height: '100%',
          width: `${progress * (amount / 100) * 100}%`,
          backgroundColor: color,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 7,
        }}
      >
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 800, color: palette.white, opacity: progress > 0.35 ? 1 : 0 }}>
          {Math.round(progress * amount)}
        </span>
      </div>
    </div>
    <div style={{ width: 56, textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 8, color: palette.muted }}>{note}</div>
  </div>
);

export const PaymentV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'payment', sequenceFrom, index: 0, fallbackAt: 1.4 });
  const c1 = useCue({ sceneId: 'payment', sequenceFrom, index: 1, fallbackAt: 8 });
  const c2 = useCue({ sceneId: 'payment', sequenceFrom, index: 2, fallbackAt: 14.8 });
  const c3 = useCue({ sceneId: 'payment', sequenceFrom, index: 3, fallbackAt: 20.8 });
  const c4 = useCue({ sceneId: 'payment', sequenceFrom, index: 4, fallbackAt: 26.4 });
  const c5 = useCue({ sceneId: 'payment', sequenceFrom, index: 5, fallbackAt: 31.2 });
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.04], CLAMP);
  const pulse = 1 + Math.sin(frame / 34) * 0.01;

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="06">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '42% 50%' }}>
        <div style={{ position: 'absolute', left: 96, top: 154, width: 900 }}>
          <V2Heading
            kicker="Settle"
            title={'Paid on acceptance.\nLeverage held back.'}
            body="100 funded. 20 refunded at award. 72 paid. 8 held for durability."
            tone="paper"
            size={82}
            width={880}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 420,
            width: 840,
            padding: '24px 26px',
            borderRadius: 18,
            border: `1px solid ${palette.line}`,
            backgroundColor: 'rgba(255, 253, 248, 0.9)',
            boxShadow: '0 24px 60px rgba(17, 34, 29, 0.12)',
            transform: `scale(${pulse})`,
            transformOrigin: 'left center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <TinyLabel>Escrow</TinyLabel>
              <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 700, color: palette.ink }}>
                100 USDC funded
              </div>
            </div>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                backgroundColor: palette.mintSoft,
                border: `1px solid ${palette.mint}`,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: palette.green,
              }}
            >
              EXACT · ON ACCEPTANCE
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SplitRow label="Refunded" amount={20} color={palette.amber} progress={Math.max(0, c3.progress)} note="at award" />
            <SplitRow label="Paid" amount={72} color={palette.green} progress={Math.max(0, c4.progress)} note="contractor" />
            <SplitRow label="Held" amount={8} color={palette.blue} progress={Math.max(0, c2.progress)} note="durability" />
          </div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.muted }}>20 + 72 + 8 = 100</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 700, color: palette.green }}>
              {Math.round((c2.progress + c3.progress + c4.progress) * 33)}% SETTLED
            </span>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 96, top: 330, width: 700, height: 440 }}>
          <LiveCapture
            sceneId="payment"
            label="mend.app / case"
            tone="paper"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 20, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="paper">CASE · WO-0241</MediaBadge>
            <MediaBadge tone="paper">PAYMENT RECEIPT</MediaBadge>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <TinyLabel>Escrow → contractor</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.green }}>USDC · NEAR</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 930, top: 536 }}>
          <StickFigure role="contractor" pose="cheer" scale={0.62} seed={15} />
          <div
            style={{
              position: 'absolute',
              left: 4,
              top: 24,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: palette.green,
              color: palette.mint,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.1em',
            }}
          >
            PAID
          </div>
        </div>

        <RevealCard cue={c5} from="bottom" style={{ right: 96, top: 800, width: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <TinyLabel>Receipt</TinyLabel>
              <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 600, color: palette.ink }}>
                72 paid · 8 held
              </div>
            </div>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.green }}>0x4b8d…e2f1</span>
          </div>
          <div style={{ marginTop: 8, height: 3, backgroundColor: palette.line, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, c5.progress) * 100}%`, backgroundColor: palette.green }} />
          </div>
        </RevealCard>

        <CueRing cue={c1} tone="paper" size={300} style={{ left: 520, top: 620 }} />
        <CueStamp
          cue={c0}
          label="Accepted"
          sublabel="Human inspection signed"
          tone="paper"
          rotate={-3}
          style={{ left: 96, top: 768 }}
        />
        <CueStamp
          cue={c1}
          label="Split"
          sublabel="20 · 72 · 8"
          tone="paper"
          rotate={-4}
          style={{ left: 640, top: 760 }}
        />
        <CueStamp
          cue={c2}
          label="8 held"
          sublabel="Durability holdback"
          tone="paper"
          rotate={3}
          style={{ left: 820, top: 730 }}
        />
        <CueStamp
          cue={c5}
          label="Receipt"
          sublabel="Every payment verifiable"
          tone="paper"
          rotate={-2}
          style={{ right: 120, top: 760 }}
        />
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
