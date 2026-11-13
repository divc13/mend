import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetSrc } from '../assets';
import { Architecture, type ArchEdge, type ArchNode } from '../components/Architecture';
import { BrowserFrame } from '../components/PhoneFrame';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { ChapterMark } from '../components/LowerThird';
import { BeatHeadings } from '../components/SceneHeading';
import { beatOpacity, fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const NODES: ArchNode[] = [
  { id: 'client', eyebrow: 'CLIENT', label: 'Next.js · React', sublabel: 'Browser · walletless report', x: 0, y: 0, w: 300, h: 100, tone: 'paper' },
  { id: 'api', eyebrow: 'API', label: 'Fastify', sublabel: 'Validation · privacy · orchestration', x: 350, y: 0, w: 280, h: 100, tone: 'green' },
  { id: 'data', eyebrow: 'DATA', label: 'Postgres', sublabel: 'Work orders · evidence', x: 680, y: 0, w: 250, h: 100, tone: 'paper' },
  { id: 'ai', eyebrow: 'AI', label: 'NEAR AI · OutLayer', sublabel: 'Suggests only', x: 980, y: 0, w: 300, h: 100, tone: 'ghost' },
  { id: 'contracts', eyebrow: 'CONTRACTS', label: 'Rust · NEAR', sublabel: 'Escrow · work orders · attestations', x: 0, y: 170, w: 380, h: 120, tone: 'green' },
  { id: 'dao', eyebrow: 'GOVERNANCE', label: 'Sputnik DAO', sublabel: '2 of 3 council votes', x: 430, y: 170, w: 300, h: 120, tone: 'mint' },
  { id: 'oneclick', eyebrow: 'PAYMENTS', label: '1Click', sublabel: 'Cross-chain settlement', x: 780, y: 170, w: 250, h: 120, tone: 'ghost' },
  { id: 'market', eyebrow: 'MARKET', label: 'Agent Market', sublabel: 'Contractor listings', x: 1080, y: 170, w: 330, h: 120, tone: 'amber' },
  { id: 'receipts', eyebrow: 'PROOF', label: 'Receipts', sublabel: 'payments · votes · attestations · signatures', x: 0, y: 350, w: 1680, h: 110, tone: 'ghost' },
];

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api' },
  { from: 'api', to: 'data' },
  { from: 'api', to: 'ai', dashed: true },
  { from: 'api', to: 'contracts' },
  { from: 'contracts', to: 'dao' },
  { from: 'dao', to: 'oneclick' },
  { from: 'oneclick', to: 'market' },
];

export const Tech: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(8), at(16), at(26)];
  const beats = [
    {
      kicker: 'Under the hood',
      title: 'Under the\nhood.',
      body: 'Next.js and React. A Fastify API. Postgres. Rust contracts on NEAR.',
    },
    {
      kicker: 'The stack',
      title: 'A live\ntestnet stack.',
    },
    {
      kicker: 'The proof',
      title: 'Every move\nhas a receipt.',
    },
    {
      kicker: 'The disclosure',
      title: 'Replay demo.\nReal receipts.',
      body: 'The pothole story is a replay. The contracts, DAO vote, AI signature and market listing are real.',
    },
  ];
  const archDim = 1 - fadeIn(frame, starts[3], 26) * 0.76;
  const disclosureIn = fadeIn(frame, starts[3] + 8, 24);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.greenDark }}>
      <AbsoluteFill
        style={{
          backgroundImage: [
            'radial-gradient(1000px 700px at 15% 0%, rgba(14, 74, 57, 0.62), transparent 64%)',
            'radial-gradient(900px 620px at 94% 90%, rgba(143, 211, 180, 0.14), transparent 60%)',
            'linear-gradient(145deg, #071b15 0%, #0b2a21 60%, #11221d 100%)',
          ].join(', '),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.05,
          backgroundImage:
            'linear-gradient(rgba(143, 211, 180, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(143, 211, 180, 0.8) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />
      <ChapterMark chapter={scene.chapter} tone="dark" />
      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 104,
          display: 'flex',
          gap: 10,
        }}
      >
        <Chip tone="mint" size="sm" icon="globe">
          NEAR testnet
        </Chip>
        <Chip tone="amber" size="sm" icon="play">
          Replay
        </Chip>
      </div>

      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="dark"
        size={76}
        style={{ left: 120, top: 150, width: 720, height: 300 }}
      />

      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 238,
          opacity: beatOpacity(frame, 0, starts),
          transform: `rotate(1deg) translateY(${(1 - beatOpacity(frame, 0, starts)) * 14}px)`,
        }}
      >
        <BrowserFrame
          width={560}
          height={370}
          src={assetSrc('appTech')}
          label="How it works"
          urlLabel="mend / how-it-works"
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 410,
          opacity: fadeIn(frame, starts[1] + 6, 22) * archDim,
        }}
      >
        <Architecture
          nodes={NODES}
          edges={EDGES}
          width={1680}
          height={470}
          revealAt={starts[1] + 12}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 260,
          top: 392,
          width: 1400,
          padding: '30px 34px',
          borderRadius: 26,
          backgroundColor: 'rgba(7, 27, 21, 0.94)',
          border: '1px solid rgba(143, 211, 180, 0.35)',
          boxShadow: '0 40px 100px rgba(0, 0, 0, 0.42)',
          opacity: disclosureIn,
          transform: `translateY(${(1 - disclosureIn) * 20}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Icon name="shield" size={20} color={palette.mint} />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              letterSpacing: '0.18em',
              color: palette.mint,
            }}
          >
            WHAT IS REAL · WHAT IS REPLAY
          </span>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div
            style={{
              flex: 1,
              padding: '22px 24px',
              borderRadius: 18,
              backgroundColor: 'rgba(169, 103, 18, 0.14)',
              border: '1px solid rgba(169, 103, 18, 0.42)',
            }}
          >
            <Chip tone="amber" size="sm" icon="play">
              Replay · simulation
            </Chip>
            <div
              style={{
                marginTop: 12,
                fontFamily: fonts.display,
                fontSize: 32,
                fontWeight: 600,
                color: palette.paper,
              }}
            >
              The pothole story
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: fonts.body,
                fontSize: 16,
                lineHeight: 1.5,
                color: 'rgba(245, 241, 230, 0.66)',
              }}
            >
              Illustrative stock footage. The software scenario is a replay, clearly labelled.
            </div>
          </div>
          <div
            style={{
              flex: 1.25,
              padding: '22px 24px',
              borderRadius: 18,
              backgroundColor: 'rgba(143, 211, 180, 0.1)',
              border: '1px solid rgba(143, 211, 180, 0.38)',
            }}
          >
            <Chip tone="mint" size="sm" icon="check">
              Real · NEAR testnet
            </Chip>
            <div
              style={{
                marginTop: 12,
                fontFamily: fonts.display,
                fontSize: 32,
                fontWeight: 600,
                color: palette.paper,
              }}
            >
              Contracts, DAO, AI signature, market
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: fonts.body,
                fontSize: 16,
                lineHeight: 1.5,
                color: 'rgba(245, 241, 230, 0.7)',
              }}
            >
              Real testnet / production as labelled. Every payment, vote and attestation has a
              verifiable receipt.
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid rgba(245, 241, 230, 0.14)',
            fontFamily: fonts.body,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'rgba(245, 241, 230, 0.5)',
          }}
        >
          Pothole and repair footage: illustrative stock footage from Pexels. Pothole software
          scenario: REPLAY / SIMULATION.
        </div>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
