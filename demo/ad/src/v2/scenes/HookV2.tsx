import React from 'react';
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, fadeIn } from '../../motion';
import { palette } from '../../theme';
import { MediaBadge, MediaPanel } from '../components/LivePanel';
import { Pothole, PhoneProp } from '../components/PaperCast';
import { Sam, StickFigure } from '../components/CharacterCast';
import { CueRing, CueStamp, SceneWash, TinyLabel, V2Heading, cueBounce } from '../components/SceneChrome';
import { SceneShell } from '../components/SceneShell';
import { useCue } from '../lib/cues';
import { footageMedia } from '../lib/assets';
import type { V2SceneProps } from '../types';

const Beat: React.FC<{
  show: number;
  hide?: number;
  children: ReactNode;
  y?: number;
}> = ({ show, hide = 1, children, y = 26 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity: Math.min(show, hide),
      transform: `translateY(${(1 - show) * y}px)`,
      pointerEvents: 'none',
    }}
  >
    {children}
  </div>
);

const StreetFallback: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#12241d', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #173229 0%, #1c3b30 34%, #33473f 58%, #202925 58.4%, #151d1a 100%)',
        }}
      />
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 90 + index * 420,
            top: 180 - (index % 2) * 50,
            width: 300,
            height: 360 + (index % 2) * 70,
            backgroundColor: index % 2 === 0 ? '#1b342b' : '#163027',
            border: '1px solid rgba(143, 211, 180, 0.12)',
            boxShadow: 'inset 0 0 0 10px rgba(7, 27, 21, 0.2)',
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', gap: 16, margin: `34px 0 0 30px` }}>
              {[0, 1].map((col) => (
                <div
                  key={col}
                  style={{
                    width: 34,
                    height: 46,
                    backgroundColor: (row + col + index) % 3 === 0 ? '#d9b66f' : 'rgba(143, 211, 180, 0.12)',
                    opacity: (row + col + index) % 3 === 0 ? 0.55 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 600,
          height: 14,
          backgroundColor: '#4c5b54',
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 614,
          bottom: 0,
          background:
            'repeating-linear-gradient(90deg, transparent 0 120px, rgba(245, 241, 230, 0.14) 120px 128px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 820,
          height: 4,
          backgroundColor: palette.amber,
          opacity: 0.55,
          transform: `translateX(${Math.sin(frame / 60) * 12}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1540,
          top: 150,
          width: 10,
          height: 480,
          backgroundColor: '#0c1a15',
          boxShadow: '0 0 0 2px rgba(143, 211, 180, 0.1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1490,
          top: 130,
          width: 110,
          height: 26,
          borderRadius: 8,
          backgroundColor: '#0c1a15',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1522,
          top: 108,
          width: 46,
          height: 24,
          borderRadius: 12,
          backgroundColor: palette.amber,
          opacity: 0.7,
          boxShadow: `0 0 40px ${palette.amber}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 620px at 70% 30%, rgba(143, 211, 180, 0.12), transparent 65%), linear-gradient(90deg, rgba(5, 18, 14, 0.82), transparent 55%, rgba(5, 18, 14, 0.4))',
        }}
      />
    </AbsoluteFill>
  );
};

export const HookV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const bg = footageMedia('pothole');
  const c0 = useCue({ sceneId: 'hook', sequenceFrom, index: 0, fallbackAt: 0.4 });
  const c1 = useCue({ sceneId: 'hook', sequenceFrom, index: 1, fallbackAt: 6.95 });
  const c2 = useCue({ sceneId: 'hook', sequenceFrom, index: 2, fallbackAt: 9.2, ramp: 6 });
  const c3 = useCue({ sceneId: 'hook', sequenceFrom, index: 3, fallbackAt: 9.9 });
  const c4 = useCue({ sceneId: 'hook', sequenceFrom, index: 4, fallbackAt: 10.8 });

  const flash = c2.since >= 0 ? Math.max(0, 1 - c2.since / 15) : 0;
  const walkEnd = c2.frame > 0 ? c2.frame : 90;
  const samLeft = interpolate(frame, [0, Math.max(1, walkEnd)], [70, 300], CLAMP);
  const samPose = c3.since >= 0 ? 'point' : c2.since >= 0 ? 'phone' : 'walk';
  const samBounce = cueBounce(c3, 10);
  const push = 1.03 + interpolate(frame, [0, durationInFrames], [0, 0.075], CLAMP) + Math.max(0, c4.progress) * 0.035;
  const cyclistLeft = interpolate(frame, [Math.max(0, c1.frame - 40), c1.frame + 80], [2100, 620], CLAMP);
  const cyclistVisible = c1.since > -50 && c1.since < 130;

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="01" showLogo>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '62% 62%' }}>
        <MediaPanel
          asset={bg}
          label="Pothole · Riverside path"
          placeholder="STOCK FOOTAGE PENDING"
          tone="dark"
          chrome={false}
          rounded={0}
          style={{ inset: 0 }}
          loopFrames={durationInFrames}
          fallback={<StreetFallback />}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(90deg, rgba(5, 18, 14, 0.9) 0%, rgba(5, 18, 14, 0.62) 40%, rgba(5, 18, 14, 0.06) 76%, rgba(5, 18, 14, 0.42) 100%), linear-gradient(0deg, rgba(5, 18, 14, 0.78) 0%, transparent 38%)',
          }}
        />

        <Pothole
          variant="open"
          scale={0.84}
          style={{ left: 910, top: 618, opacity: 0.96 }}
          label="Open pothole"
        />

        <div
          style={{
            position: 'absolute',
            left: samLeft,
            top: 452,
            transform: `translateY(${samBounce.y}px) scale(${samBounce.scale})`,
            transformOrigin: 'bottom center',
          }}
        >
          <Sam pose={samPose} scale={0.92} phoneGlow={Math.max(0, c2.progress) * (1 - flash * 0.4)} seed={2} label="Sam" />
        </div>

        {cyclistVisible ? (
          <div style={{ position: 'absolute', left: cyclistLeft, top: 540, opacity: 0.95 }}>
            <StickFigure role="cyclist" pose="ride" scale={0.7} seed={4} />
            <div
              style={{
                position: 'absolute',
                left: 30,
                top: -16,
                padding: '5px 9px',
                borderRadius: 999,
                backgroundColor: 'rgba(159, 54, 44, 0.85)',
                color: palette.paper,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
              }}
            >
              NEAR MISS
            </div>
          </div>
        ) : null}

        <div
          style={{
            position: 'absolute',
            left: 1230,
            top: 208,
            opacity: Math.min(1, Math.max(0, c2.progress)),
            transform: `translateY(${(1 - Math.max(0, c2.progress)) * 34}px) rotate(${2 + Math.sin(frame / 50) * 1.5}deg)`,
          }}
        >
          <PhoneProp scale={0.62} flash={flash} screen="report" />
          <div style={{ position: 'absolute', left: 172, top: 34, width: 220 }}>
            <TinyLabel tone="dark">No wallet · no forms</TinyLabel>
            <div
              style={{
                marginTop: 8,
                fontFamily: 'Georgia, serif',
                fontSize: 26,
                fontWeight: 600,
                lineHeight: 1.05,
                color: palette.paper,
              }}
            >
              Photo, pin,
              <br />
              one sentence.
            </div>
          </div>
        </div>

        <CueRing cue={c2} tone="dark" size={360} style={{ left: 1400, top: 430 }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundColor: '#f8f4e8',
            opacity: flash * 0.78,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 70% 38%, rgba(255,255,255,0.9) 0%, rgba(143,211,180,0.35) 12%, transparent 34%)',
            opacity: flash,
          }}
        />
      </AbsoluteFill>

      <div style={{ position: 'absolute', left: 112, top: 190, width: 1020, height: 430 }}>
        <Beat show={c0.progress} hide={c1.progress > 0 ? Math.max(0, 1 - c1.progress) : 1}>
          <V2Heading
            kicker="A MEND STORY"
            title={'Every neighborhood\nhas one.'}
            tone="dark"
            size={100}
            width={1000}
            delay={4}
          />
        </Beat>
        <Beat show={c1.progress} hide={c3.progress > 0 ? Math.max(0, 1 - c3.progress) : 1}>
          <V2Heading
            kicker="One street · one repair"
            title={'A pothole\neveryone avoids.'}
            tone="dark"
            size={96}
            width={1000}
          />
        </Beat>
        <Beat show={c3.progress}>
          <V2Heading
            kicker="Nobody owns it"
            title={'Nobody owns it.'}
            body="Until this morning."
            tone="dark"
            size={96}
            width={980}
          />
        </Beat>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 898,
          display: 'flex',
          gap: 10,
          opacity: fadeIn(frame, 24, 20),
        }}
      >
        <MediaBadge tone="dark">SAM · RESIDENT</MediaBadge>
        <MediaBadge tone="dark">RIVERSIDE PATH</MediaBadge>
      </div>

      <CueStamp
        cue={c1}
        label="Near miss"
        sublabel="Every cyclist · every day"
        tone="dark"
        rotate={-5}
        style={{ right: 150, top: 520 }}
      />
      <CueStamp
        cue={c4}
        label="Report it"
        sublabel="One tap"
        tone="dark"
        rotate={3}
        style={{ right: 128, top: 660 }}
      />

      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: 0.5,
          maxWidth: 500,
        }}
      >
        <span style={{ width: 36, height: 1, backgroundColor: palette.mint, flexShrink: 0 }} />
        <TinyLabel tone="dark">Pothole footage: illustrative stock · scenario: replay demo</TinyLabel>
      </div>
      <SceneWash tone="dark" />
    </SceneShell>
  );
};
