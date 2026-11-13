import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import { BidderRow as CharacterBidderRow } from '../../characters/BidderRow';
import { LiveCapture, MediaBadge } from '../components/LivePanel';
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

export const BidsV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'bids', sequenceFrom, index: 0, fallbackAt: 2 });
  const c1 = useCue({ sceneId: 'bids', sequenceFrom, index: 1, fallbackAt: 8.5 });
  const c2 = useCue({ sceneId: 'bids', sequenceFrom, index: 2, fallbackAt: 14.2 });
  const c3 = useCue({ sceneId: 'bids', sequenceFrom, index: 3, fallbackAt: 21 });
  const c4 = useCue({ sceneId: 'bids', sequenceFrom, index: 4, fallbackAt: 28 });
  const c5 = useCue({ sceneId: 'bids', sequenceFrom, index: 5, fallbackAt: 34.4 });
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.035], CLAMP);

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="04">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '62% 46%' }}>
        <div style={{ position: 'absolute', left: 96, top: 158, width: 980 }}>
          <V2Heading
            kicker="Compete"
            title={'Sealed bids.\nDeterministic score.'}
            body="Price, warranty, duration, materials. No model picks."
            tone="paper"
            size={84}
            width={940}
          />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 430, width: 700, height: 330 }}>
          <LiveCapture
            sceneId="bids"
            label="mend.app / bids"
            tone="paper"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 20, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="paper">SEALED BID WINDOW</MediaBadge>
            <MediaBadge tone="paper">POLICY HASH PINNED</MediaBadge>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <TinyLabel>3 contractors · 1 policy</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.green }}>WINDOW · CLOSED</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 820, top: 300, width: 1000, height: 430 }}>
          <CharacterBidderRow
            revealed={Math.max(0, c0.progress)}
            winner={c4.active ? 'B' : null}
            bids={{ A: 2873, B: 9270, C: 5200 }}
            width={1000}
            height={430}
          />
        </div>

        <RevealCard cue={c2} from="left" style={{ left: 96, top: 790, width: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <TinyLabel>Scoring policy</TinyLabel>
              <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: palette.ink }}>
                Hash-pinned · deterministic
              </div>
            </div>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: palette.green,
                padding: '5px 8px',
                borderRadius: 5,
                backgroundColor: palette.mintSoft,
                border: `1px solid ${palette.mint}`,
              }}
            >
              0x9c2e…41ab
            </span>
          </div>
          <div style={{ marginTop: 9, display: 'flex', gap: 6 }}>
            {['PRICE 40', 'WARRANTY 25', 'DURATION 20', 'MATERIALS 15'].map((item) => (
              <span
                key={item}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px 4px',
                  borderRadius: 5,
                  backgroundColor: palette.paper,
                  border: `1px solid ${palette.line}`,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 8,
                  letterSpacing: '0.05em',
                  color: palette.inkSoft,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </RevealCard>

        <CueRing cue={c4} tone="paper" size={300} style={{ left: 1130, top: 510 }} />
        <CueStamp
          cue={c1}
          label="Window closed"
          sublabel="Bids unsealed"
          tone="paper"
          rotate={-4}
          style={{ left: 820, top: 760 }}
        />
        <CueStamp
          cue={c4}
          label="B wins value"
          sublabel="9,270 · not lowest sticker"
          tone="paper"
          rotate={3}
          style={{ right: 78, top: 836 }}
        />
        <div style={{ position: 'absolute', left: 96, top: 932, display: 'flex', alignItems: 'center', gap: 10 }}>
          <TinyLabel>A 2,873 · B 9,270 · C 5,200 · winner: B</TinyLabel>
        </div>
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
