import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { KineticNumber } from '../components/KineticNumber';
import { ChapterMark } from '../components/LowerThird';
import { BeatHeadings } from '../components/SceneHeading';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { SplitBar } from '../components/SplitBar';
import { fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const StatBlock: React.FC<{
  value: number;
  label: string;
  note: string;
  color: string;
  delay: number;
  prefix?: string;
}> = ({ value, label, note, color, delay, prefix }) => {
  const frame = useCurrentFrame();
  const appear = fadeIn(frame, delay, 22);
  return (
    <div
      style={{
        flex: 1,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 18}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: '0.16em',
          color,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 92,
          fontWeight: 600,
          lineHeight: 0.9,
          color,
          letterSpacing: '-0.03em',
        }}
      >
        <KineticNumber value={value} delay={delay} prefix={prefix} />
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: fonts.body,
          fontSize: 16,
          lineHeight: 1.4,
          color: palette.muted,
          maxWidth: 400,
        }}
      >
        {note}
      </div>
    </div>
  );
};

export const Payment: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(6), at(12), at(18), at(26)];
  const beats = [
    {
      kicker: 'Step 01 · Fund',
      title: 'Settle the\nwork order.',
      body: 'One hundred USDC was funded. On acceptance, the money moves once.',
    },
    {
      kicker: 'Step 02 · Pay',
      title: '72 paid\non acceptance.',
      body: 'Exactly seventy-two USDC goes to the contractor.',
    },
    {
      kicker: 'Step 03 · Hold',
      title: '8 held for\ndurability.',
      body: 'A durability holdback keeps the community’s leverage.',
    },
    {
      kicker: 'Step 04 · Refund',
      title: '20 refunded\nat award.',
      body: 'Unspent budget returns to the treasury. No idle escrow.',
    },
    {
      kicker: 'Step 05 · Close',
      title: 'Paid. Held.\nLeverage kept.',
      body: 'The contractor gets paid. The community keeps a reason to come back.',
    },
  ];
  const equationIn = fadeIn(frame, starts[3] + 10, 20);

  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" />
      <ChapterMark chapter={scene.chapter} tone="paper" />
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="paper"
        size={74}
        style={{ left: 120, top: 150, width: 760, height: 250 }}
      />

      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 116,
          textAlign: 'right',
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 13,
            letterSpacing: '0.18em',
            color: palette.amber,
            marginBottom: 2,
          }}
        >
          USDC FUNDED
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 150,
            fontWeight: 600,
            lineHeight: 0.85,
            letterSpacing: '-0.04em',
            color: palette.green,
          }}
        >
          <KineticNumber value={100} delay={6} />
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Chip tone="mint" size="sm" icon="wallet">
            Funded once
          </Chip>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 410,
          width: 1680,
          display: 'flex',
          gap: 90,
        }}
      >
        <StatBlock
          value={72}
          label="PAID ON ACCEPTANCE"
          note="Exactly 72 USDC to the contractor."
          color={palette.green}
          delay={starts[1]}
        />
        <StatBlock
          value={8}
          label="DURABILITY HOLDBACK"
          note="Held against the warranty. Released when the record closes."
          color={palette.amber}
          delay={starts[2]}
        />
        <StatBlock
          value={20}
          label="REFUNDED AT AWARD"
          note="Unspent budget returns to the community treasury."
          color={palette.muted}
          delay={starts[3]}
        />
      </div>

      <div style={{ position: 'absolute', left: 120, top: 600, width: 1680 }}>
        <SplitBar
          total={100}
          height={104}
          segments={[
            { id: 'paid', label: 'Paid', value: 72, color: palette.green, startFrame: 4 },
            { id: 'held', label: 'Held', value: 8, color: palette.amber, startFrame: starts[2] },
            { id: 'refunded', label: 'Refunded', value: 20, color: '#b9b09c', startFrame: starts[3] },
          ]}
        />
        <div
          style={{
            position: 'relative',
            height: 34,
            marginTop: 10,
            fontFamily: fonts.mono,
            fontSize: 12,
            color: palette.muted,
          }}
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <div
              key={tick}
              style={{
                position: 'absolute',
                left: `${tick}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div style={{ width: 1, height: 7, backgroundColor: palette.lineStrong }} />
              <span>{tick}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 730,
          width: 1680,
          padding: '16px 22px',
          borderRadius: 14,
          backgroundColor: palette.greenDark,
          color: palette.paper,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          opacity: equationIn,
          transform: `translateY(${(1 - equationIn) * 12}px)`,
        }}
      >
        <Icon name="receipt" size={22} color={palette.mint} />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 20,
            letterSpacing: '0.03em',
            color: palette.paper,
          }}
        >
          100 funded − 20 refunded = 80 authorized
        </span>
        <span style={{ color: 'rgba(245, 241, 230, 0.35)' }}>·</span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 20,
            letterSpacing: '0.03em',
            color: palette.mint,
          }}
        >
          72 paid + 8 held
        </span>
        <div style={{ flex: 1 }} />
        <Chip tone="dark" size="sm" icon="check">
          Receipt attached
        </Chip>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
