import React from 'react';
import type { CSSProperties } from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  BidderRow,
  Contractor,
  CouncilTable,
  Inspector,
  Neighbor,
  Sam,
  StickFigure,
} from '../../characters';
import { Pothole } from '../../v2/components/PaperCast';
import { mediaAt } from '../../v2/lib/assets';
import { fonts, palette } from '../../theme';
import { FPS, v3Script, type V3Scene } from '../lib/script';

const CARD_SHADOW = '0 26px 60px rgba(7,27,21,0.32)';

type CardProps = {
  label: string;
  kicker?: string;
  children: React.ReactNode;
  style: CSSProperties;
  rotate?: number;
};

const Card: React.FC<CardProps> = ({ label, kicker, children, style, rotate = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 190, stiffness: 105 } });
  const drift = Math.sin(frame / 42) * 1.4;
  return (
    <div
      style={{
        position: 'absolute',
        ...style,
        backgroundColor: palette.surface,
        border: `1.5px solid ${palette.ink}`,
        boxShadow: CARD_SHADOW,
        overflow: 'hidden',
        transform: `rotate(${rotate}deg) translateY(${(1 - enter) * 22 + drift}px) scale(${0.94 + enter * 0.06})`,
        opacity: enter,
        zIndex: 40,
      }}
    >
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: `1px solid ${palette.line}`,
          background: `linear-gradient(90deg, ${palette.mintSoft}, ${palette.surface})`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 8,
            letterSpacing: '0.14em',
            color: palette.green,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 7,
            letterSpacing: '0.08em',
            color: palette.muted,
          }}
        >
          {kicker ?? 'LIVE CAST'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 'calc(100% - 32px)' }}>{children}</div>
      <div
        style={{
          position: 'absolute',
          left: -3,
          top: -3,
          width: 44,
          height: 10,
          backgroundColor: 'rgba(143,211,180,0.82)',
          transform: 'rotate(-4deg)',
        }}
      />
    </div>
  );
};

const BottomLabel: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({
  children,
  dark = false,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 6,
      fontFamily: fonts.mono,
      fontSize: 8,
      letterSpacing: '0.08em',
      color: dark ? palette.paper : palette.muted,
      background: dark ? 'rgba(7,27,21,0.75)' : 'rgba(255,253,248,0.82)',
      padding: '4px 6px',
      textAlign: 'center',
    }}
  >
    {children}
  </div>
);

const ReportCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Card label="THE STREET" kicker="PAPER CUT" style={{ left: 22, top: 126, width: 306, height: 318 }} rotate={-1.4}>
      <Pothole variant="open" scale={0.34} style={{ left: 8, bottom: 44 }} />
      <Neighbor
        pose="hold-phone"
        width={52}
        height={104}
        frame={frame}
        fps={fps}
        animated
        enterAt={4}
        style={{ position: 'absolute', left: 10, bottom: 36, opacity: 0.88 }}
      />
      <Sam
        pose="take-photo"
        width={98}
        height={198}
        frame={frame}
        fps={fps}
        animated
        enterAt={8}
        style={{ position: 'absolute', right: 8, bottom: 34 }}
      />
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          fontFamily: fonts.mono,
          fontSize: 8,
          color: palette.amberStrong,
          letterSpacing: '0.08em',
        }}
      >
        {scene.caption.split('\n')[0]}
      </div>
      <BottomLabel>2 REPORTS · 1 POTHOLE · SAM + NEIGHBOR</BottomLabel>
    </Card>
  );
};

const CouncilCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, scene.sceneDuration * fps));
  const votes: ['yes' | 'abstain', 'yes' | 'abstain', 'yes' | 'abstain'] =
    progress > 0.48 ? ['yes', 'yes', 'abstain'] : ['yes', 'abstain', 'abstain'];
  return (
    <Card label="THE COUNCIL" kicker="2 OF 3" style={{ right: 22, top: 126, width: 360, height: 252 }} rotate={1.1}>
      <CouncilTable
        votes={votes}
        revealProgress={Math.min(1, progress * 1.4)}
        width={342}
        height={188}
        frame={frame}
        fps={fps}
        style={{ position: 'absolute', left: 9, top: 4 }}
      />
      <BottomLabel>YES · YES · ABSTAIN — NO AI PAYMENT AUTHORITY</BottomLabel>
    </Card>
  );
};

const BidderCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, scene.sceneDuration * fps));
  return (
    <Card label="THE BIDDERS" kicker="SEALED" style={{ right: 22, bottom: 214, width: 380, height: 238 }} rotate={-0.8}>
      <BidderRow
        revealed={Math.min(1, progress * 1.5)}
        winner={progress > 0.5 ? 'B' : null}
        bids={{ A: 2873, B: 9270, C: 5200 }}
        width={362}
        height={180}
        frame={frame}
        fps={fps}
        style={{ position: 'absolute', left: 8, top: 6 }}
      />
      <BottomLabel>B 9,270 · VALUE WINNER · NOT LOWEST STICKER</BottomLabel>
    </Card>
  );
};

const RepairCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, scene.sceneDuration * fps));
  const video = mediaAt('assets/footage/repair.mp4');
  return (
    <>
      <Card label="THE REPAIR" kicker="VIDEO" style={{ left: 22, top: 126, width: 330, height: 236 }} rotate={-1.1}>
        {video?.kind === 'video' ? (
          <OffthreadVideo
            src={video.src}
            muted
            playbackRate={0.67}
            style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'cover' }}
          />
        ) : (
          <Pothole variant="patched" scale={0.38} style={{ left: 8, bottom: 34 }} />
        )}
        <div
          style={{
            position: 'absolute',
            right: 4,
            bottom: 22,
            width: 88,
            height: 122,
            borderRadius: 44,
            background: 'rgba(255,253,248,0.72)',
            border: `1px solid ${palette.line}`,
          }}
        />
        <Contractor
          pose="kneel"
          width={74}
          height={124}
          frame={frame}
          fps={fps}
          animated
          enterAt={6}
          style={{ position: 'absolute', right: 10, bottom: 28, zIndex: 2 }}
        />
        <BottomLabel dark>ILLUSTRATIVE REPAIR B-ROLL · LOCAL CONTRACTOR</BottomLabel>
      </Card>
      <Card label="THE INSPECTOR" kicker="HUMAN" style={{ right: 22, bottom: 214, width: 316, height: 230 }} rotate={1.2}>
        <Inspector
          pose="hold-clipboard"
          width={86}
          height={172}
          frame={frame}
          fps={fps}
          animated
          enterAt={5}
          stamp={progress > 0.62}
          style={{ position: 'absolute', left: 42, bottom: 26 }}
        />
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            width: 132,
            fontFamily: fonts.mono,
            fontSize: 9,
            lineHeight: 1.6,
            color: palette.inkSoft,
          }}
        >
          CHECKLIST
          <br />
          EVIDENCE
          <br />
          SIGNATURE
          <br />
          <span style={{ color: palette.green }}>NOT THE CONTRACTOR</span>
        </div>
        <BottomLabel>INDEPENDENT HUMAN INSPECTION</BottomLabel>
      </Card>
    </>
  );
};

const PaymentCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, scene.sceneDuration * fps));
  return (
    <Card label="THE PAYOUT" kicker="SETTLED" style={{ right: 22, bottom: 214, width: 306, height: 232 }} rotate={-1}>
      <Contractor
        pose="stand"
        width={82}
        height={154}
        frame={frame}
        fps={fps}
        animated
        enterAt={4}
        style={{ position: 'absolute', left: 24, bottom: 30 }}
      />
      <div style={{ position: 'absolute', left: 118, top: 16, width: 164 }}>
        <div style={{ fontFamily: fonts.display, fontSize: 34, color: palette.green, lineHeight: 1 }}>72</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: palette.muted }}>USDC PAID</div>
        <div style={{ marginTop: 14, fontFamily: fonts.display, fontSize: 26, color: palette.amberStrong, lineHeight: 1 }}>8</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: palette.muted }}>HELD → RELEASED</div>
        <div
          style={{
            marginTop: 13,
            height: 4,
            width: 130,
            background: palette.line,
          }}
        >
          <div style={{ height: '100%', width: `${Math.min(1, progress * 1.4) * 100}%`, background: palette.green }} />
        </div>
      </div>
      <BottomLabel>EXACT 100 · 20 · 72 · 8</BottomLabel>
    </Card>
  );
};

const PassportCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Card label="THE PASSPORT" kicker="SAME ASSET" style={{ left: 22, bottom: 214, width: 334, height: 238 }} rotate={1.1}>
      <Pothole variant="fixed" scale={0.36} style={{ left: 5, bottom: 40 }} />
      <Sam
        pose="look-at-screen"
        width={86}
        height={172}
        frame={frame}
        fps={fps}
        animated
        enterAt={5}
        style={{ position: 'absolute', right: 8, bottom: 26 }}
      />
      <Neighbor
        pose="stand"
        width={42}
        height={92}
        frame={frame}
        fps={fps}
        animated
        enterAt={8}
        style={{ position: 'absolute', left: 10, bottom: 26 }}
      />
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 16,
          fontFamily: fonts.mono,
          fontSize: 9,
          color: palette.green,
          lineHeight: 1.6,
          textAlign: 'right',
        }}
      >
        PATH-006
        <br />
        FIXED
        <br />
        REMEMBERED
      </div>
      <BottomLabel>THE REPAIR STAYS WITH THE ASSET</BottomLabel>
    </Card>
  );
};

const TechCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const figures = [
    { pose: 'hold-phone' as const, accessory: 'phone' as const, label: 'REPORTER', color: palette.mint },
    { pose: 'raise-card' as const, accessory: 'card' as const, label: 'STEWARD', color: palette.amber },
    { pose: 'hold-envelope' as const, accessory: 'envelope' as const, label: 'BIDDER', color: palette.blue },
    { pose: 'hold-clipboard' as const, accessory: 'clipboard' as const, label: 'INSPECTOR', color: palette.green },
  ];
  return (
    <Card label="THE CAST" kicker="HUMAN LAYER" style={{ right: 22, bottom: 250, width: 360, height: 286 }} rotate={1}>
      <div
        style={{
          position: 'absolute',
          inset: 10,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
        }}
      >
        {figures.map((figure, index) => (
          <div
            key={figure.label}
            style={{
              position: 'relative',
              border: `1px solid ${palette.line}`,
              background: 'rgba(250,247,238,0.8)',
            }}
          >
            <StickFigure
              pose={figure.pose}
              accessory={figure.accessory}
              width={66}
              height={104}
              colorTag={figure.color}
              tagLabel={figure.label}
              frame={frame}
              fps={fps}
              animated
              enterAt={4 + index * 3}
              style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)' }}
            />
          </div>
        ))}
      </div>
      <BottomLabel>{scene.stack.length} LAYERS · HUMANS HOLD THE PAYMENT KEYS</BottomLabel>
    </Card>
  );
};

const CastForScene: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  switch (scene.id) {
    case 'report':
      return <ReportCast scene={scene} />;
    case 'dao':
      return <CouncilCast scene={scene} />;
    case 'bids':
      return <BidderCast scene={scene} />;
    case 'repair':
      return <RepairCast scene={scene} />;
    case 'payment':
      return <PaymentCast scene={scene} />;
    case 'passport':
      return <PassportCast scene={scene} />;
    case 'tech':
      return null;
    default:
      return null;
  }
};

export const CastOverlays: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {v3Script.scenes
      .filter((scene) => scene.id !== 'hook' && scene.id !== 'close')
      .map((scene) => {
        const start = scene.id === 'report' ? 0 : scene.start;
        const duration = scene.id === 'report' ? scene.start + scene.sceneDuration : scene.sceneDuration;
        return (
          <Sequence
            key={scene.id}
            from={Math.round(start * FPS)}
            durationInFrames={Math.round(duration * FPS)}
          >
            <CastForScene scene={scene} />
          </Sequence>
        );
      })}
  </AbsoluteFill>
);
