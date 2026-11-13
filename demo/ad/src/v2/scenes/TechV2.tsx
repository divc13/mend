import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Architecture, type ArchEdge, type ArchNode } from '../../components/Architecture';
import { CLAMP } from '../../motion';
import { palette } from '../../theme';
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

const nodes: ArchNode[] = [
  { id: 'client', x: 8, y: 18, w: 214, h: 104, eyebrow: 'CLIENT', label: 'Next.js + React', tone: 'mint' },
  { id: 'api', x: 266, y: 18, w: 198, h: 104, eyebrow: 'API', label: 'Fastify', tone: 'ghost' },
  { id: 'db', x: 508, y: 18, w: 198, h: 104, eyebrow: 'DATA', label: 'Postgres', tone: 'ghost' },
  { id: 'ai', x: 750, y: 18, w: 214, h: 104, eyebrow: 'PRIVATE AI', label: 'NEAR AI', tone: 'ghost' },
  { id: 'contracts', x: 8, y: 214, w: 250, h: 122, eyebrow: 'CONTRACTS', label: 'Rust on NEAR', tone: 'green' },
  { id: 'dao', x: 302, y: 214, w: 224, h: 122, eyebrow: 'GOVERNANCE', label: 'Sputnik DAO', tone: 'amber' },
  { id: 'market', x: 570, y: 214, w: 218, h: 122, eyebrow: 'MARKET', label: 'Agent Market', tone: 'ghost' },
  { id: 'outlayer', x: 832, y: 214, w: 214, h: 122, eyebrow: 'EXECUTION', label: 'OutLayer', tone: 'ghost' },
  { id: 'oneclick', x: 302, y: 410, w: 224, h: 116, eyebrow: 'SETTLEMENT', label: '1Click', tone: 'ghost' },
  { id: 'proof', x: 570, y: 410, w: 312, h: 116, eyebrow: 'PROOF', label: 'Every action has a receipt', tone: 'mint' },
];

const edges: ArchEdge[] = [
  { from: 'client', to: 'api' },
  { from: 'api', to: 'db' },
  { from: 'api', to: 'ai', dashed: true },
  { from: 'api', to: 'contracts' },
  { from: 'contracts', to: 'dao' },
  { from: 'contracts', to: 'market' },
  { from: 'dao', to: 'oneclick' },
  { from: 'market', to: 'outlayer' },
  { from: 'oneclick', to: 'proof' },
  { from: 'outlayer', to: 'proof', dashed: true },
];

export const TechV2: React.FC<V2SceneProps> = ({ scene, durationInFrames, sequenceFrom }) => {
  const frame = useCurrentFrame();
  const c0 = useCue({ sceneId: 'tech', sequenceFrom, index: 0, fallbackAt: 1.5 });
  const c1 = useCue({ sceneId: 'tech', sequenceFrom, index: 1, fallbackAt: 7.8 });
  const c2 = useCue({ sceneId: 'tech', sequenceFrom, index: 2, fallbackAt: 14.2 });
  const c3 = useCue({ sceneId: 'tech', sequenceFrom, index: 3, fallbackAt: 20.6 });
  const c5 = useCue({ sceneId: 'tech', sequenceFrom, index: 5, fallbackAt: 31.4 });
  const push = 1.02 + interpolate(frame, [0, durationInFrames], [0, 0.035], CLAMP);

  return (
    <SceneShell scene={scene} durationInFrames={durationInFrames} chapterIndex="08">
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '58% 48%' }}>
        <div style={{ position: 'absolute', left: 96, top: 150, width: 690 }}>
          <V2Heading
            kicker="Under the hood"
            title={'Live proof.\nNot vibes.'}
            body="Next.js, Fastify, Postgres, Rust contracts on NEAR, a real Sputnik DAO, NEAR AI, OutLayer, 1Click and Agent Market."
            tone="dark"
            size={84}
            width={660}
          />
        </div>

        <div style={{ position: 'absolute', left: 96, top: 490, width: 640, height: 330 }}>
          <LiveCapture
            sceneId="tech"
            label="mend.app / how-it-works"
            tone="dark"
            loopFrames={durationInFrames}
            style={{ inset: 0 }}
          />
          <div style={{ position: 'absolute', left: 20, top: 52, display: 'flex', gap: 8, zIndex: 5 }}>
            <MediaBadge tone="dark">LIVE TESTNET</MediaBadge>
            <MediaBadge tone="dark">REPLAY DEMO</MediaBadge>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <TinyLabel tone="dark">Contracts · DAO · AI signature · market</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>NEAR</span>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 34, top: 196, width: 1060, height: 600 }}>
          <Architecture
            nodes={nodes}
            edges={edges}
            width={1060}
            height={600}
            revealAt={Math.max(0, c0.frame)}
            background={palette.greenDark}
            style={{ transform: 'scale(0.96)', transformOrigin: 'top left' }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 838,
            width: 640,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            opacity: 0.72 + Math.max(0, c5.progress) * 0.28,
            transform: `scale(${1 + Math.max(0, c5.progress) * 0.015})`,
            transformOrigin: 'left bottom',
          }}
        >
          {[
            ['CONTRACTS', 'REAL'],
            ['DAO VOTE', 'REAL'],
            ['AI SIGNATURE', 'REAL'],
            ['AGENT MARKET', 'REAL'],
            ['POTHOLE STORY', 'REPLAY'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                borderRadius: 5,
                border: `1px solid ${value === 'REAL' ? 'rgba(143, 211, 180, 0.35)' : 'rgba(217, 154, 61, 0.35)'}`,
                backgroundColor: value === 'REAL' ? 'rgba(143, 211, 180, 0.08)' : 'rgba(217, 154, 61, 0.08)',
              }}
            >
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 7, letterSpacing: '0.08em', color: 'rgba(245, 241, 230, 0.55)' }}>{label}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 7, fontWeight: 800, letterSpacing: '0.08em', color: value === 'REAL' ? palette.mint : palette.amber }}>{value}</span>
            </div>
          ))}
        </div>

        <RevealCard cue={c2} from="right" tone="dark" style={{ right: 70, top: 786, width: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <TinyLabel tone="dark">Rust contracts</TinyLabel>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: palette.mint }}>TESTNET</span>
          </div>
          <div style={{ marginTop: 6, fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 600, color: palette.paper }}>
            Scope, bids, escrow, attestation.
          </div>
          <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: 'rgba(245, 241, 230, 0.5)' }}>
            verifiable · no invented tx links
          </div>
        </RevealCard>

        <CueRing cue={c0} tone="dark" size={360} style={{ right: 480, top: 420 }} />
        <CueStamp
          cue={c3}
          label="Live testnet"
          sublabel="Proof, not promises"
          tone="dark"
          rotate={3}
          style={{ right: 104, top: 704 }}
        />
      </AbsoluteFill>
    </SceneShell>
  );
};
