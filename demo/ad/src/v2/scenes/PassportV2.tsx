import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import { AppStill, MediaBadge } from '../components/LivePanel';
import { PassportBook } from '../components/PaperCast';
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

const history = [
  { label: 'Reported', detail: 'Sam · 07:42', color: palette.green },
  { label: 'Awarded', detail: 'B · 9,270', color: palette.amber },
  { label: 'Accepted', detail: '72 paid · 8 held', color: palette.green },
  { label: 'Warranty', detail: '12 months', color: palette.blue },
];

export const PassportV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'passport', sequenceFrom, index: 0, fallbackAt: 1.2 });
  const c1 = useCue({ sceneId: 'passport', sequenceFrom, index: 1, fallbackAt: 6.8 });
  const c2 = useCue({ sceneId: 'passport', sequenceFrom, index: 2, fallbackAt: 12.2 });
  const c3 = useCue({ sceneId: 'passport', sequenceFrom, index: 3, fallbackAt: 17 });
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.04], CLAMP);
  const open = Math.max(0, Math.min(1, c0.progress * 1.2));
  const stamps = 1 + Math.floor(Math.max(0, c3.progress) * 3);
  const timelineProgress = Math.max(0, c1.progress);

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="07">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '44% 48%' }}>
        <div style={{ position: 'absolute', left: 96, top: 150, width: 900 }}>
          <V2Heading
            kicker="Remember"
            title={'One asset.\nOne permanent record.'}
            body="If the repair fails, the same work order reopens. No new bounty. No new money."
            tone="paper"
            size={76}
            width={880}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 430,
            transform: `translateY(${Math.sin(frame / 52) * 4}px)`,
          }}
        >
          <PassportBook open={open} scale={0.8} stamps={stamps} />
        </div>

        <div style={{ position: 'absolute', right: 96, top: 282, width: 700, height: 470 }}>
          <AppStill
            name="passport"
            label="mend.app / passport"
            tone="paper"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 20, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="paper">ONE ASSET</MediaBadge>
            <MediaBadge tone="paper">EVERY EVENT</MediaBadge>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <TinyLabel>PATH-006 · WO-0002</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.green }}>IMMUTABLE HISTORY</span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 790,
            width: 900,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0,
          }}
        >
          <div style={{ position: 'absolute', left: 22, right: 22, top: 13, height: 2, backgroundColor: palette.line }} />
          <div
            style={{
              position: 'absolute',
              left: 22,
              top: 13,
              height: 2,
              width: `${timelineProgress * 856}px`,
              backgroundColor: palette.green,
            }}
          />
          {history.map((item, index) => {
            const p = Math.max(0, Math.min(1, c1.progress * 1.5 - index * 0.18));
            return (
              <div key={item.label} style={{ flex: 1, opacity: 0.3 + p * 0.7, transform: `translateY(${(1 - p) * 14}px)` }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: p > 0.5 ? item.color : palette.surface,
                    border: `2px solid ${p > 0.5 ? item.color : palette.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palette.paper,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {p > 0.5 ? '✓' : index + 1}
                </div>
                <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: palette.ink, textTransform: 'uppercase' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 2, fontFamily: 'ui-monospace, monospace', fontSize: 8, color: palette.muted }}>{item.detail}</div>
              </div>
            );
          })}
        </div>

        <div style={{ position: 'absolute', left: 960, top: 650 }}>
          <StickFigure role="resident" pose="clipboard" scale={0.5} seed={17} />
        </div>

        <RevealCard cue={c2} from="right" style={{ right: 96, top: 790, width: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <TinyLabel>Failure kept</TinyLabel>
              <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 600, color: palette.ink }}>
                Same work order. Same history.
              </div>
            </div>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.red }}>NO NEW BOUNTY</span>
          </div>
          <div style={{ marginTop: 8, height: 3, backgroundColor: palette.line, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, c2.progress) * 100}%`, backgroundColor: palette.red }} />
          </div>
        </RevealCard>

        <CueRing cue={c0} tone="paper" size={320} style={{ left: 420, top: 600 }} />
        <CueStamp
          cue={c2}
          label="Failure kept"
          sublabel="Remedy + payment in one place"
          tone="paper"
          rotate={3}
          style={{ right: 118, top: 760 }}
        />
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
