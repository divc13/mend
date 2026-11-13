import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, EASE_OUT } from '../../motion';
import { fonts, palette } from '../../theme';
import type { Tone } from '../lib/script';
import type { CueState } from '../lib/cues';

type CaptionProps = {
  text: string;
  durationInFrames: number;
  tone?: Tone;
  bottom?: number;
  maxWidth?: number;
  delay?: number;
  style?: CSSProperties;
};

/**
 * Burned-in captions. Kept inside the 96px side / 54px bottom safe area and
 * revealed line by line so the caption moves with the voice.
 */
export const V2Caption: React.FC<CaptionProps> = ({
  text,
  durationInFrames,
  tone = 'paper',
  bottom = 58,
  maxWidth = 1380,
  delay = 12,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const entrance = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 200, stiffness: 110, mass: 0.9 },
  });
  const exit = interpolate(frame, [durationInFrames - 16, durationInFrames - 2], [1, 0], CLAMP);
  const opacity = Math.min(entrance, exit);
  const dark = tone === 'dark';
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom,
        width: 'auto',
        maxWidth,
        transform: `translateX(-50%) translateY(${(1 - entrance) * 22}px)`,
        opacity,
        zIndex: 40,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 18,
          padding: '18px 30px 18px 24px',
          borderRadius: 18,
          border: `1px solid ${dark ? 'rgba(143, 211, 180, 0.26)' : palette.line}`,
          backgroundColor: dark ? 'rgba(7, 27, 21, 0.82)' : 'rgba(255, 253, 248, 0.94)',
          boxShadow: dark
            ? '0 26px 70px rgba(0, 0, 0, 0.35)'
            : '0 24px 64px rgba(17, 34, 29, 0.18)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            width: 5,
            borderRadius: 3,
            backgroundColor: dark ? palette.mint : palette.green,
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lines.map((line, index) => {
            const lineIn = spring({
              frame: Math.max(0, frame - delay - index * 5),
              fps,
              config: { damping: 200, stiffness: 120, mass: 0.8 },
            });
            const many = lines.length > 2;
            return (
              <div
                key={`${line}-${index}`}
                style={{
                  fontFamily: fonts.body,
                  fontSize: many ? 29 : index === 0 ? 36 : 32,
                  fontWeight: index === 0 ? 650 : 450,
                  lineHeight: 1.22,
                  letterSpacing: '-0.012em',
                  color: dark
                    ? index === 0
                      ? palette.paper
                      : 'rgba(245, 241, 230, 0.72)'
                    : index === 0
                      ? palette.ink
                      : palette.inkSoft,
                  opacity: lineIn,
                  transform: `translateY(${(1 - lineIn) * 10}px)`,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
        <div
          style={{
            alignSelf: 'flex-end',
            fontFamily: fonts.mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: dark ? 'rgba(143, 211, 180, 0.55)' : 'rgba(14, 74, 57, 0.45)',
            paddingBottom: 3,
          }}
        >
          CC
        </div>
      </div>
    </div>
  );
};

type HeadingProps = {
  kicker?: string;
  title: string;
  body?: string;
  tone?: Tone;
  delay?: number;
  size?: number;
  width?: number;
  style?: CSSProperties;
  align?: 'left' | 'center';
};

export const V2Heading: React.FC<HeadingProps> = ({
  kicker,
  title,
  body,
  tone = 'dark',
  delay = 0,
  size = 86,
  width = 860,
  style,
  align = 'left',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dark = tone === 'dark';
  const lines = title.split('\n');
  const kickerIn = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 200, stiffness: 100 },
  });
  return (
    <div
      style={{
        width,
        textAlign: align,
        ...style,
      }}
    >
      {kicker ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            opacity: kickerIn,
            transform: `translateX(${(1 - kickerIn) * -18}px)`,
          }}
        >
          <span style={{ width: 30, height: 2, backgroundColor: dark ? palette.mint : palette.amber }} />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: dark ? palette.mint : palette.amber,
            }}
          >
            {kicker}
          </span>
        </div>
      ) : null}
      {lines.map((line, index) => {
        const lineIn = spring({
          frame: Math.max(0, frame - delay - index * 4),
          fps,
          config: { damping: 200, stiffness: 105, mass: 0.9 },
        });
        return (
          <div key={`${line}-${index}`} style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: size,
                fontWeight: 600,
                lineHeight: 0.96,
                letterSpacing: '-0.035em',
                color: dark ? palette.paper : palette.ink,
                textWrap: 'balance',
                opacity: lineIn,
                transform: `translateY(${(1 - lineIn) * 44}px)`,
                textShadow: dark ? '0 16px 44px rgba(0, 0, 0, 0.28)' : 'none',
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
      {body ? (
        <div
          style={{
            marginTop: 20,
            maxWidth: Math.min(720, width),
            fontFamily: fonts.body,
            fontSize: 25,
            lineHeight: 1.45,
            color: dark ? 'rgba(245, 241, 230, 0.7)' : palette.muted,
            opacity: kickerIn,
            transform: `translateY(${(1 - kickerIn) * 12}px)`,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

export const ChapterTag: React.FC<{
  chapter: string;
  tone?: Tone;
  style?: CSSProperties;
  index?: string;
}> = ({ chapter, tone = 'dark', style, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 90 } });
  const dark = tone === 'dark';
  const cleanChapter = chapter.replace(/^\d+\s*[—–-]\s*/, '');
  return (
    <div
      style={{
        position: 'absolute',
        top: 54,
        left: 96,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: enter,
        transform: `translateY(${(1 - enter) * -14}px)`,
        zIndex: 30,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: dark ? palette.mint : palette.green,
          padding: '5px 8px',
          border: `1px solid ${dark ? 'rgba(143, 211, 180, 0.35)' : 'rgba(14, 74, 57, 0.25)'}`,
          borderRadius: 5,
        }}
      >
        {index ?? 'MEND'}
      </span>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: dark ? 'rgba(245, 241, 230, 0.62)' : palette.muted,
        }}
      >
        {cleanChapter}
      </span>
    </div>
  );
};

export const CueStamp: React.FC<{
  cue: CueState;
  label: string;
  sublabel?: string;
  tone?: Tone;
  rotate?: number;
  style?: CSSProperties;
}> = ({ cue, label, sublabel, tone = 'paper', rotate = -4, style }) => {
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, cue.since),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.8 },
  });
  if (cue.since < 0) {
    return null;
  }
  const dark = tone === 'dark';
  return (
    <div
      style={{
        position: 'absolute',
        opacity: Math.min(1, cue.since / 4),
        transform: `rotate(${rotate}deg) scale(${0.62 + enter * 0.38})`,
        transformOrigin: 'center',
        padding: '12px 20px',
        borderRadius: 10,
        border: `2px solid ${dark ? palette.mint : palette.green}`,
        backgroundColor: dark ? 'rgba(7, 27, 21, 0.78)' : 'rgba(255, 253, 248, 0.92)',
        boxShadow: `0 12px 30px rgba(7, 27, 21, 0.22), inset 0 0 0 4px ${
          dark ? 'rgba(143, 211, 180, 0.12)' : 'rgba(14, 74, 57, 0.06)'
        }`,
        color: dark ? palette.mint : palette.green,
        zIndex: 32,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      {sublabel ? (
        <div
          style={{
            marginTop: 3,
            fontFamily: fonts.mono,
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
};

/** Damped bounce applied to a figure or card when a cue fires. */
export const cueBounce = (cue: CueState, amplitude = 18): { y: number; scale: number } => {
  if (cue.since < 0) {
    return { y: 0, scale: 1 };
  }
  const decay = Math.exp(-cue.since / 16);
  const wave = Math.sin(cue.since / 3.4) * decay;
  return {
    y: -Math.abs(wave) * amplitude,
    scale: 1 + Math.abs(wave) * 0.035,
  };
};

export const CueRing: React.FC<{
  cue: CueState;
  tone?: Tone;
  size?: number;
  style?: CSSProperties;
}> = ({ cue, tone = 'dark', size = 220, style }) => {
  if (cue.since < 0 || cue.since > 50) {
    return null;
  }
  const progress = interpolate(cue.since, [0, 50], [0, 1], CLAMP);
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${tone === 'dark' ? palette.mint : palette.green}`,
        opacity: (1 - progress) * 0.55,
        transform: `translate(-50%, -50%) scale(${0.4 + progress * 1.2})`,
        pointerEvents: 'none',
        zIndex: 20,
        ...style,
      }}
    />
  );
};

export const RevealCard: React.FC<{
  cue: CueState;
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
  from?: 'left' | 'right' | 'bottom';
}> = ({ cue, children, tone = 'paper', style, from = 'bottom' }) => {
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, cue.since),
    fps,
    config: { damping: 200, stiffness: 95, mass: 0.9 },
  });
  if (cue.since < 0) {
    return null;
  }
  const dark = tone === 'dark';
  const offset =
    from === 'left'
      ? `translateX(${(1 - enter) * -48}px)`
      : from === 'right'
        ? `translateX(${(1 - enter) * 48}px)`
        : `translateY(${(1 - enter) * 40}px)`;
  return (
    <div
      style={{
        position: 'absolute',
        opacity: enter,
        transform: offset,
        padding: '20px 24px',
        borderRadius: 16,
        border: `1px solid ${dark ? 'rgba(143, 211, 180, 0.25)' : palette.line}`,
        backgroundColor: dark ? 'rgba(7, 27, 21, 0.78)' : 'rgba(255, 253, 248, 0.94)',
        boxShadow: dark
          ? '0 24px 60px rgba(0, 0, 0, 0.35)'
          : '0 24px 60px rgba(17, 34, 29, 0.14)',
        backdropFilter: 'blur(10px)',
        zIndex: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const TinyLabel: React.FC<{
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}> = ({ children, tone = 'paper', style }) => (
  <div
    style={{
      fontFamily: fonts.mono,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: tone === 'dark' ? 'rgba(245, 241, 230, 0.55)' : palette.muted,
      ...style,
    }}
  >
    {children}
  </div>
);

export const SceneWash: React.FC<{
  tone?: Tone;
  from?: string;
  to?: string;
}> = ({ tone = 'paper' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background:
          tone === 'dark'
            ? `radial-gradient(900px 620px at ${20 + drift * 8}% ${12 + drift * 6}%, rgba(143, 211, 180, 0.16), transparent 62%), linear-gradient(180deg, rgba(7, 27, 21, 0.2), rgba(7, 27, 21, 0.5))`
            : `radial-gradient(900px 620px at ${20 + drift * 8}% ${12 + drift * 6}%, rgba(143, 211, 180, 0.16), transparent 62%), linear-gradient(180deg, rgba(245, 241, 230, 0.05), rgba(233, 226, 210, 0.35))`,
      }}
    />
  );
};
