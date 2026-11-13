import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Grain } from '../components/Grain';
import { Logo } from '../components/Logo';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { CLAMP } from '../motion';
import { fonts, palette } from '../theme';
import { Sam, StickFigure, type StickRole } from './components/PaperCast';
import { TinyLabel } from './components/SceneChrome';

const cast: Array<{
  name: string;
  role: string;
  kind: 'sam' | 'stick';
  stickRole?: StickRole;
  pose: 'walk' | 'phone' | 'wave' | 'clipboard' | 'vote' | 'ride';
}> = [
  { name: 'Sam', role: 'Resident · reports it', kind: 'sam', pose: 'walk' },
  { name: 'Sam', role: 'Photo, pin, one sentence', kind: 'sam', pose: 'phone' },
  { name: 'Neighbor', role: 'Second report · merge', kind: 'stick', stickRole: 'neighbor', pose: 'wave' },
  { name: 'Steward', role: 'Scope + max budget', kind: 'stick', stickRole: 'steward', pose: 'clipboard' },
  { name: 'Contractor', role: 'Sealed bid · repair', kind: 'stick', stickRole: 'contractor', pose: 'clipboard' },
  { name: 'Inspector', role: 'Independent human', kind: 'stick', stickRole: 'inspector', pose: 'clipboard' },
  { name: 'Bidder', role: 'Deterministic score', kind: 'stick', stickRole: 'bidder', pose: 'vote' },
  { name: 'Cyclist', role: 'Near miss', kind: 'stick', stickRole: 'cyclist', pose: 'ride' },
];

export const CharacterGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 200, stiffness: 90 } });
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <SceneBackdrop tone="paper" glow="both" grid vignette />
      <div style={{ position: 'absolute', left: 96, top: 70 }}>
        <Logo size={34} tone="paper" />
        <div
          style={{
            marginTop: 18,
            fontFamily: fonts.display,
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: palette.ink,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 20}px)`,
          }}
        >
          Paper-cut cast
        </div>
        <div style={{ marginTop: 8, fontFamily: fonts.body, fontSize: 22, color: palette.muted, opacity: titleIn }}>
          Sam leads. The supporting cast stays deliberately stick-simple.
        </div>
      </div>
      <div style={{ position: 'absolute', right: 96, top: 86, opacity: 0.55 }}>
        <TinyLabel>CharacterGallery · 8 poses</TinyLabel>
      </div>

      {cast.map((member, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const enter = spring({
          frame: Math.max(0, frame - index * 5),
          fps,
          config: { damping: 200, stiffness: 100 },
        });
        return (
          <div
            key={`${member.name}-${index}`}
            style={{
              position: 'absolute',
              left: 96 + col * 448,
              top: 260 + row * 380,
              width: 420,
              height: 350,
              borderRadius: 18,
              border: `1px solid ${palette.line}`,
              backgroundColor: 'rgba(255, 253, 248, 0.72)',
              boxShadow: '0 18px 50px rgba(17, 34, 29, 0.08)',
              opacity: enter,
              transform: `translateY(${(1 - enter) * 26}px)`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                zIndex: 4,
              }}
            >
              <span style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, color: palette.ink }}>{member.name}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', color: palette.muted, textTransform: 'uppercase' }}>{member.role}</span>
            </div>
            <div style={{ position: 'absolute', left: 80, top: 34 }}>
              {member.kind === 'sam' ? (
                <Sam
                  pose={member.pose === 'phone' ? 'phone' : member.pose === 'wave' ? 'wave' : 'walk'}
                  scale={0.62}
                  seed={index + 1}
                  phoneGlow={member.pose === 'phone' ? 0.7 : 0}
                />
              ) : (
                <StickFigure
                  role={member.stickRole}
                  pose={member.pose === 'ride' ? 'ride' : member.pose === 'vote' ? 'vote' : member.pose === 'clipboard' ? 'clipboard' : 'wave'}
                  scale={0.64}
                  seed={index + 1}
                />
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 4,
                backgroundColor: index === 0 || index === 1 ? palette.green : palette.amber,
                opacity: 0.5,
              }}
            />
          </div>
        );
      })}

      <div style={{ position: 'absolute', left: 96, right: 96, bottom: 40 }}>
        <div style={{ height: 2, backgroundColor: palette.line }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: palette.green }} />
        </div>
      </div>
      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};
