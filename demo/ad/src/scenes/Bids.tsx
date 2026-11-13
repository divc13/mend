import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { ChapterMark } from '../components/LowerThird';
import { BeatHeadings } from '../components/SceneHeading';
import { ScoreTable } from '../components/ScoreTable';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { beatOpacity, CLAMP, fadeIn, fadeOut, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const Envelope: React.FC<{
  letter: string;
  index: number;
  rotation: number;
  delay: number;
}> = ({ letter, index, rotation, delay }) => {
  const frame = useCurrentFrame();
  const appear = fadeIn(frame, delay, 22);
  return (
    <div
      style={{
        position: 'absolute',
        left: 20 + index * 320,
        top: 82,
        width: 280,
        height: 360,
        borderRadius: 22,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 26px 64px rgba(17, 34, 29, 0.14)',
        transform: `rotate(${rotation}deg) translateY(${(1 - appear) * 26}px)`,
        opacity: appear,
        padding: '24px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.16em',
            color: palette.muted,
          }}
        >
          SEALED BID
        </span>
        <Icon name="lock" size={17} color={palette.amber} />
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: fonts.display,
          fontSize: 92,
          fontWeight: 600,
          lineHeight: 0.9,
          color: palette.ink,
        }}
      >
        {letter}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: fonts.body,
          fontSize: 16,
          color: palette.muted,
        }}
      >
        Contractor {letter}
      </div>
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {[86, 68, 78].map((width) => (
          <div
            key={width}
            style={{
              height: 8,
              width: `${width}%`,
              borderRadius: 4,
              backgroundColor: palette.paperDeep,
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 39,
            backgroundColor: index === 1 ? palette.green : palette.amber,
            border: `4px solid ${palette.surface}`,
            boxShadow: '0 8px 20px rgba(17, 34, 29, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.paper,
            fontFamily: fonts.display,
            fontSize: 30,
            fontWeight: 600,
          }}
        >
          {letter}
        </div>
      </div>
    </div>
  );
};

export const Bids: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(8), at(18), at(30)];
  const winnerAt = at(27);
  const beats = [
    {
      kicker: 'Step 01 · Compete',
      title: 'Three sealed\nbids.',
      body: 'Price. Warranty. Duration. Materials. Every contractor bids on the same scope.',
    },
    {
      kicker: 'Step 02 · Close',
      title: 'The window\ncloses.',
      body: 'Bids open together. No early peek, no side channel.',
    },
    {
      kicker: 'Step 03 · Score',
      title: 'Deterministic\nscoring.',
      body: 'A hash-pinned policy scores total value. The same inputs always produce the same result.',
    },
    {
      kicker: 'Step 04 · Award',
      title: 'B wins on\nvalue.',
      body: 'Not the lowest sticker price. The best total outcome for the asset.',
    },
  ];
  const windowProgress = interpolate(frame, [0, starts[1]], [0, 1], CLAMP);
  const closed = frame >= starts[1];
  const envelopeOpacity = Math.min(
    beatOpacity(frame, 0, starts),
    fadeOut(frame, starts[1] - 6, 14),
  );

  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" />
      <ChapterMark chapter={scene.chapter} tone="paper" />
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="paper"
        size={80}
        style={{ left: 120, top: 200, width: 620, height: 360 }}
      />

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 724,
          width: 560,
          padding: '18px 20px',
          borderRadius: 18,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.line}`,
          boxShadow: '0 14px 34px rgba(17, 34, 29, 0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: '0.16em',
              color: palette.muted,
            }}
          >
            BID WINDOW
          </span>
          <Chip tone={closed ? 'green' : 'amber'} size="sm" icon={closed ? 'check' : 'clock'}>
            {closed ? 'Closed' : 'Open'}
          </Chip>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            backgroundColor: palette.paper,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${windowProgress * 100}%`,
              backgroundColor: closed ? palette.green : palette.amber,
              borderRadius: 5,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 9,
            fontFamily: fonts.body,
            fontSize: 14,
            color: palette.muted,
          }}
        >
          Three bids received. Scores reveal after close.
        </div>
      </div>

      <div style={{ position: 'absolute', left: 800, top: 150, width: 1000, height: 620 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: envelopeOpacity }}>
          <Envelope letter="A" index={0} rotation={-4} delay={at(0.4)} />
          <Envelope letter="B" index={1} rotation={0} delay={at(0.55)} />
          <Envelope letter="C" index={2} rotation={4} delay={at(0.7)} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 780,
          top: 146,
          width: 1020,
          opacity: fadeIn(frame, starts[1] + 2, 20),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {[
            { icon: 'wallet' as const, label: 'Price' },
            { icon: 'shield' as const, label: 'Warranty' },
            { icon: 'clock' as const, label: 'Duration' },
            { icon: 'hammer' as const, label: 'Materials' },
          ].map((item) => (
            <Chip key={item.label} tone="ghost" size="sm" icon={item.icon}>
              {item.label}
            </Chip>
          ))}
          <div style={{ flex: 1 }} />
          <Chip tone="mint" size="sm" icon="key">
            Policy hash pinned
          </Chip>
        </div>
        <ScoreTable
          rows={[
            { id: 'B', letter: 'B', name: 'Contractor B', score: 9270, note: 'Best total value' },
            { id: 'C', letter: 'C', name: 'Contractor C', score: 5200, note: 'Sealed bid' },
            { id: 'A', letter: 'A', name: 'Contractor A', score: 2873, note: 'Sealed bid' },
          ]}
          revealAt={starts[1] + 6}
          winnerId="B"
          winnerAt={winnerAt}
        />
        <div
          style={{
            marginTop: 18,
            width: 780,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 14,
            backgroundColor: palette.greenDark,
            color: palette.paper,
          }}
        >
          <Icon name="code" size={18} color={palette.mint} />
          <span style={{ fontFamily: fonts.body, fontSize: 16, color: 'rgba(245, 241, 230, 0.78)' }}>
            Deterministic policy. No language model picks the winner.
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 4,
            top: 438,
            width: 196,
            height: 196,
            borderRadius: 98,
            border: `3px solid ${palette.green}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(-10deg) scale(${0.86 + fadeIn(frame, winnerAt + 6, 22) * 0.14})`,
            opacity: fadeIn(frame, winnerAt + 6, 22),
            backgroundColor: 'rgba(230, 244, 236, 0.86)',
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: '0.16em',
              color: palette.green,
            }}
          >
            WINNER
          </span>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 62,
              fontWeight: 600,
              lineHeight: 0.95,
              color: palette.green,
            }}
          >
            B
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 17,
              fontWeight: 700,
              color: palette.green,
            }}
          >
            9,270
          </span>
        </div>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
