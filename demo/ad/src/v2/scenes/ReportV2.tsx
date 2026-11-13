import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, fadeIn } from '../../motion';
import { palette } from '../../theme';
import { LiveCapture, MediaBadge } from '../components/LivePanel';
import { Sam, StickFigure } from '../components/CharacterCast';
import {
  CueRing,
  CueStamp,
  RevealCard,
  SceneWash,
  TinyLabel,
  V2Heading,
  cueBounce,
} from '../components/SceneChrome';
import { SceneShell } from '../components/SceneShell';
import { useCue } from '../lib/cues';
import { liveMedia } from '../lib/assets';
import type { V2SceneProps } from '../types';

const metadata = [
  { label: 'GPS', value: '38.7223, -9.1393' },
  { label: 'TIME', value: '07:42:18' },
  { label: 'DEVICE', value: 'iPhone 15' },
  { label: 'EXIF', value: '14 fields' },
];

const ChipRow: React.FC<{ index: number; progress: number; label: string; value: string }> = ({
  index,
  progress,
  label,
  value,
}) => {
  const x = (1 - progress) * 40 + index * 8;
  const y = (1 - progress) * -24 + index * 58;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40 + x,
        top: 96 + y,
        opacity: progress,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 253, 248, 0.94)',
        border: `1px solid ${palette.line}`,
        boxShadow: '0 8px 22px rgba(17, 34, 29, 0.1)',
        transform: `rotate(${(index - 1.5) * 1.2}deg)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: palette.red,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: palette.muted }}>{value}</span>
    </div>
  );
};

export const ReportV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'report', sequenceFrom, index: 0, fallbackAt: 1.8 });
  const c1 = useCue({ sceneId: 'report', sequenceFrom, index: 1, fallbackAt: 7.5 });
  const c2 = useCue({ sceneId: 'report', sequenceFrom, index: 2, fallbackAt: 14 });
  const c3 = useCue({ sceneId: 'report', sequenceFrom, index: 3, fallbackAt: 21 });
  const c4 = useCue({ sceneId: 'report', sequenceFrom, index: 4, fallbackAt: 29 });
  const c5 = useCue({ sceneId: 'report', sequenceFrom, index: 5, fallbackAt: 37 });
  const media = liveMedia('report');
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.045], CLAMP);
  const samBounce = cueBounce(c1, 8);
  const neighborIn = c4.progress;

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="02">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '46% 48%' }}>
        <div style={{ position: 'absolute', left: 96, top: 170, width: 1110 }}>
          <V2Heading
            kicker="Report"
            title={'No wallet.\nNo forms.'}
            body="A photo, a location, one sentence."
            tone="paper"
            size={92}
            width={1000}
          />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 452, width: 1060, height: 420 }}>
          <LiveCapture
            sceneId="report"
            label="mend.app / report"
            tone="paper"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 54,
              display: 'flex',
              gap: 8,
              zIndex: 5,
            }}
          >
            <MediaBadge tone="paper">
              {media?.kind === 'video' ? 'LIVE APP CAPTURE' : media ? 'APP CAPTURE' : 'CAPTURE PENDING'}
            </MediaBadge>
            <MediaBadge tone="paper">REPLAY · SIMULATION</MediaBadge>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              bottom: 20,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              zIndex: 5,
            }}
          >
            <div>
              <TinyLabel>Report</TinyLabel>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: 'Georgia, serif',
                  fontSize: 26,
                  fontWeight: 600,
                  color: palette.ink,
                }}
              >
                Pothole · Riverside path
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                opacity: 0.75,
              }}
            >
              {['PHOTO', 'PIN', 'NOTE'].map((step, index) => (
                <span
                  key={step}
                  style={{
                    padding: '5px 9px',
                    borderRadius: 999,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: index === 0 ? palette.paper : palette.green,
                    backgroundColor: index === 0 ? palette.green : palette.mintSoft,
                    border: `1px solid ${index === 0 ? palette.green : palette.line}`,
                  }}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1438,
            top: 438,
            transform: `translateY(${samBounce.y}px) scale(${samBounce.scale})`,
            transformOrigin: 'bottom center',
          }}
        >
          <Sam pose="phone" scale={0.96} phoneGlow={Math.max(0, c1.progress) * 0.8} seed={3} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1660,
            top: 528,
            opacity: neighborIn,
            transform: `translateX(${(1 - neighborIn) * 44}px)`,
          }}
        >
          <StickFigure role="neighbor" pose="clipboard" scale={0.7} seed={5} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 700,
            top: 520,
            width: 380,
            opacity: Math.max(0, c2.progress),
            transform: `translateX(${(1 - Math.max(0, c2.progress)) * 30}px)`,
          }}
        >
          {metadata.map((item, index) => (
            <ChipRow
              key={item.label}
              index={index}
              label={item.label}
              value={item.value}
              progress={Math.max(0, Math.min(1, c2.progress - index * 0.08))}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 336,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              borderRadius: 8,
              backgroundColor: palette.mintSoft,
              border: `1px solid ${palette.mint}`,
              opacity: c2.progress,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: palette.green }} />
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: palette.green,
              }}
            >
              STRIPPED IN BROWSER
            </span>
          </div>
        </div>

        <RevealCard
          cue={c3}
          from="right"
          style={{ right: 112, top: 236, width: 360 }}
        >
          <TinyLabel>Private AI</TinyLabel>
          <div
            style={{
              marginTop: 8,
              fontFamily: 'Georgia, serif',
              fontSize: 28,
              fontWeight: 600,
              lineHeight: 1.05,
              color: palette.ink,
            }}
          >
            Drafts a scope.
            <br />
            Suggests only.
          </div>
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              backgroundColor: palette.amberSoft,
              border: `1px solid rgba(169, 103, 18, 0.25)`,
            }}
          >
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: palette.amberStrong }}>
              NEVER APPROVES
            </span>
          </div>
        </RevealCard>

        <RevealCard
          cue={c4}
          from="left"
          style={{ left: 96, top: 690, width: 390 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TinyLabel>Duplicate detected</TinyLabel>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 9,
                fontWeight: 700,
                color: palette.red,
              }}
            >
              2 REPORTS
            </span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            {['Sam', 'Neighbor'].map((name, index) => (
              <div
                key={name}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  borderRadius: 8,
                  backgroundColor: index === 0 ? palette.surface : palette.paperDeep,
                  border: `1px solid ${palette.line}`,
                }}
              >
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.muted }}>{name}</div>
                <div style={{ marginTop: 3, fontFamily: 'Georgia, serif', fontSize: 16, color: palette.ink }}>Pothole</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, height: 3, backgroundColor: palette.line, borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, c5.progress) * 100}%`,
                backgroundColor: palette.green,
              }}
            />
          </div>
          <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.muted }}>
            MERGED PRIVATELY · ONE WORK ORDER
          </div>
        </RevealCard>

        <CueRing cue={c2} tone="paper" size={300} style={{ left: 700, top: 460 }} />
        <CueStamp
          cue={c2}
          label="EXIF stripped"
          sublabel="Before upload"
          tone="paper"
          rotate={-4}
          style={{ left: 520, top: 620 }}
        />

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 952,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: fadeIn(frame, 30, 18),
          }}
        >
          <TinyLabel>Same pothole. Two reports. One private merge.</TinyLabel>
        </div>
      </AbsoluteFill>
      <SceneWash tone="paper" />
    </SceneShell>
  );
};
