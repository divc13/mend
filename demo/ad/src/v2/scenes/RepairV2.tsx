import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
import { LiveCapture, MediaBadge, MediaPanel } from '../components/LivePanel';
import { Pothole } from '../components/PaperCast';
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
import { footageMedia } from '../lib/assets';
import type { V2SceneProps } from '../types';

const steps = [
  { label: 'Clean', note: 'Debris removed' },
  { label: 'Fill', note: 'Hot-mix asphalt' },
  { label: 'Compact', note: 'Plate compacted' },
  { label: 'Seal', note: 'Edge sealed' },
];

const RepairFallback: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#14251f', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #27453a 0%, #1d342c 36%, #2c3632 62%, #1a2420 100%)',
        }}
      />
      <Pothole variant="patched" scale={1.05} style={{ left: 540, top: 500 }} />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 300 + index * 520,
            top: 360 - index * 30,
            width: 80,
            height: 120,
            borderRadius: 8,
            backgroundColor: index === 1 ? palette.amber : '#4d5c55',
            opacity: 0.7,
            transform: `rotate(${-4 + index * 5}deg)`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 760,
          height: 3,
          backgroundColor: palette.amber,
          opacity: 0.5,
          transform: `translateX(${Math.sin(frame / 40) * 16}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(5,18,14,0.88), transparent 58%, rgba(5,18,14,0.35))',
        }}
      />
    </AbsoluteFill>
  );
};

const Checklist: React.FC<{ progress: number[]; active: number }> = ({ progress, active }) => (
  <div
    style={{
      position: 'absolute',
      width: 430,
      padding: '18px 20px',
      borderRadius: 14,
      border: `1px solid rgba(143, 211, 180, 0.25)`,
      backgroundColor: 'rgba(7, 27, 21, 0.78)',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
      backdropFilter: 'blur(10px)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <TinyLabel tone="dark">Work order · steps</TinyLabel>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>{active}/4</span>
    </div>
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {steps.map((step, index) => {
        const p = progress[index] ?? 0;
        const done = p > 0.5;
        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.4 + p * 0.6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: `1.5px solid ${done ? palette.mint : 'rgba(245, 241, 230, 0.28)'}`,
                backgroundColor: done ? 'rgba(143, 211, 180, 0.16)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: palette.mint,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {done ? '✓' : index + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: palette.paper, textTransform: 'uppercase' }}>
                {step.label}
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 8, color: 'rgba(245, 241, 230, 0.5)' }}>{step.note}</div>
            </div>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 8, color: done ? palette.mint : 'rgba(245, 241, 230, 0.35)' }}>
              {done ? 'DONE' : 'PENDING'}
            </span>
          </div>
        );
      })}
    </div>
    <div style={{ marginTop: 14, height: 4, borderRadius: 2, backgroundColor: 'rgba(245, 241, 230, 0.12)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${((progress.filter((value) => value > 0.5).length) / steps.length) * 100}%`,
          backgroundColor: palette.mint,
        }}
      />
    </div>
  </div>
);

export const RepairV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const bg = footageMedia('repair');
  const c0 = useCue({ sceneId: 'repair', sequenceFrom, index: 0, fallbackAt: 1.5 });
  const c1 = useCue({ sceneId: 'repair', sequenceFrom, index: 1, fallbackAt: 7.2 });
  const c2 = useCue({ sceneId: 'repair', sequenceFrom, index: 2, fallbackAt: 13.6 });
  const c3 = useCue({ sceneId: 'repair', sequenceFrom, index: 3, fallbackAt: 20 });
  const c4 = useCue({ sceneId: 'repair', sequenceFrom, index: 4, fallbackAt: 3.87 });
  const c5 = useCue({ sceneId: 'repair', sequenceFrom, index: 5, fallbackAt: 10.05 });
  const c6 = useCue({ sceneId: 'repair', sequenceFrom, index: 6, fallbackAt: 15.06 });
  const stepProgress = [c1.progress, c2.progress, c3.progress, c4.progress];
  const active = stepProgress.filter((value) => value > 0.5).length;
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.05], CLAMP);
  const dust = Math.sin(frame / 32) * 6;

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="05">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '52% 58%' }}>
        <MediaPanel
          asset={bg}
          label="Repair footage"
          placeholder="REPAIR FOOTAGE PENDING"
          tone="dark"
          chrome={false}
          rounded={0}
          style={{ inset: 0 }}
          loopFrames={durationInFrames}
          fallback={<RepairFallback />}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(90deg, rgba(5, 18, 14, 0.92) 0%, rgba(5, 18, 14, 0.58) 38%, rgba(5, 18, 14, 0.05) 72%, rgba(5, 18, 14, 0.35) 100%), linear-gradient(0deg, rgba(5, 18, 14, 0.8) 0%, transparent 34%)',
          }}
        />

        <div style={{ position: 'absolute', left: 96, top: 150, width: 820 }}>
          <V2Heading
            kicker="Repair"
            title={'Fix it.\nThen inspect it.'}
            body="Different human. Checklist. Evidence. Signature."
            tone="dark"
            size={88}
            width={800}
          />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 430 }}>
          <Checklist progress={stepProgress} active={active} />
        </div>

        <div style={{ position: 'absolute', left: 640, top: 504 }}>
          <StickFigure role="contractor" pose="clipboard" scale={0.78} seed={11} />
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 20,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(217, 154, 61, 0.9)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: palette.ink,
            }}
          >
            CONTRACTOR
          </div>
        </div>

        <div style={{ position: 'absolute', left: 900, top: 590 }}>
          <StickFigure role="inspector" pose="clipboard" scale={0.7} seed={13} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 12,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(47, 92, 133, 0.9)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: palette.paper,
            }}
          >
            INSPECTOR
          </div>
        </div>

        <div style={{ position: 'absolute', right: 96, top: 226, width: 640, height: 420 }}>
          <LiveCapture
            sceneId="repair"
            label="mend.app / inspection"
            tone="dark"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 20, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="dark">INDEPENDENT HUMAN</MediaBadge>
            <MediaBadge tone="dark">EVIDENCE ATTACHED</MediaBadge>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <TinyLabel tone="dark">Inspection · 8 checks</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>SIGNED</span>
          </div>
        </div>

        <RevealCard cue={c5} from="right" tone="dark" style={{ right: 96, top: 680, width: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <TinyLabel tone="dark">Inspector checklist</TinyLabel>
              <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 600, color: palette.paper }}>
                Evidence, not vibes.
              </div>
            </div>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>8/8</span>
          </div>
          <div style={{ marginTop: 9, display: 'flex', gap: 5 }}>
            {['CLEAN', 'DEPTH', 'COMPACT', 'SEAL', 'PHOTO', 'RECEIPT', 'NOTE', 'SIGN'].map((item, index) => (
              <span
                key={item}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '5px 3px',
                  borderRadius: 4,
                  backgroundColor: index < Math.round(c5.progress * 8) ? 'rgba(143, 211, 180, 0.2)' : 'rgba(245, 241, 230, 0.06)',
                  border: `1px solid ${index < Math.round(c5.progress * 8) ? 'rgba(143, 211, 180, 0.55)' : 'rgba(245, 241, 230, 0.12)'}`,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 7,
                  letterSpacing: '0.05em',
                  color: index < Math.round(c5.progress * 8) ? palette.mint : 'rgba(245, 241, 230, 0.4)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </RevealCard>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 716,
            width: 430,
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid rgba(143, 211, 180, 0.22)',
            backgroundColor: 'rgba(7, 27, 21, 0.72)',
            opacity: Math.max(0, c6.progress),
            transform: `translateY(${(1 - Math.max(0, c6.progress)) * 26}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TinyLabel tone="dark">Signature</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>HUMAN</span>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'Georgia, serif', fontSize: 26, fontStyle: 'italic', color: palette.paper }}>
            A. Rivera
          </div>
          <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: 'rgba(245, 241, 230, 0.5)' }}>
            INSPECTOR · NOT CONTRACTOR · NOT AI
          </div>
          <div style={{ marginTop: 8, height: 2, backgroundColor: 'rgba(143, 211, 180, 0.4)', width: `${c6.progress * 100}%` }} />
        </div>

        <CueRing cue={c5} tone="dark" size={260} style={{ right: 400, top: 500 }} />
        <CueStamp
          cue={c5}
          label="Inspect"
          sublabel="Independent human"
          tone="dark"
          rotate={-4}
          style={{ right: 500, top: 326 }}
        />
        <CueStamp
          cue={c6}
          label="Signed"
          sublabel="Evidence hashed"
          tone="dark"
          rotate={3}
          style={{ right: 128, top: 606 }}
        />

        <div
          style={{
            position: 'absolute',
            left: 610,
            top: 760,
            opacity: 0.6,
            transform: `translateX(${dust}px)`,
          }}
        >
          <TinyLabel tone="dark">CLEAN · FILL · COMPACT · SEAL</TinyLabel>
        </div>
      </AbsoluteFill>
      <SceneWash tone="dark" />
    </SceneShell>
  );
};
