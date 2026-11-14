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
} from '../../characters';
import { Pothole } from '../../v2/components/PaperCast';
import { mediaAt } from '../../v2/lib/assets';
import { fonts, palette } from '../../theme';
import { ACTIONS } from '../lib/timing';
import { FPS, v3Script, type V3Scene } from '../lib/script';

const CARD_SHADOW = '0 26px 60px rgba(7,27,21,0.32)';
/** Paper-cut cast never leaves a 320px edge lane. */
const CAST_W = 300;
const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

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
      letterSpacing: '0.06em',
      color: dark ? palette.paper : palette.muted,
      background: dark ? 'rgba(7,27,21,0.75)' : 'rgba(255,253,248,0.82)',
      padding: '4px 6px',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}
  >
    {children}
  </div>
);

const PrivateAiCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = [
    { label: 'PHOTO', text: 'GPS + EXIF erased in browser' },
    { label: 'PRIVATE AI', text: 'reads only the cleaned note' },
    { label: 'SUGGESTS', text: 'duplicate + scope' },
    { label: 'HUMAN', text: 'approves; AI has no wallet' },
  ];
  return (
    <Card
      label="PRIVATE AI · THE TUTOR"
      kicker="NO WALLET"
      style={{ right: 16, top: 126, width: 336, height: 366 }}
      rotate={1.2}
    >
      <div
        style={{
          height: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 8.5,
            letterSpacing: '0.1em',
            color: palette.amberStrong,
          }}
        >
          WHAT HAPPENS TO THE PHOTO
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 11 }}>
          {steps.map((step, index) => {
            const on = frame >= 8 + index * Math.round(fps * 0.9);
            return (
              <div
                key={step.label}
                style={{
                  display: 'flex',
                  gap: 10,
                  opacity: on ? 1 : 0.32,
                  transform: `translateX(${on ? 0 : 6}px)`,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: 999,
                    border: `1px solid ${on ? palette.green : palette.line}`,
                    backgroundColor: on ? palette.green : 'transparent',
                    color: on ? palette.paper : palette.muted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: fonts.mono,
                    fontSize: 10,
                  }}
                >
                  {index + 1}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: on ? palette.green : palette.muted,
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontFamily: fonts.body,
                      fontSize: 14.5,
                      lineHeight: 1.25,
                      color: palette.inkSoft,
                    }}
                  >
                    {step.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 11,
            borderTop: `1px dashed ${palette.line}`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 23,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: palette.green,
            }}
          >
            AI helps. Humans decide.
          </div>
          <div
            style={{
              marginTop: 7,
              fontFamily: fonts.mono,
              fontSize: 7,
              letterSpacing: '0.04em',
              color: palette.muted,
            }}
          >
            SIGNED RESPONSE · TEE PROOF UNAVAILABLE (LABELLED)
          </div>
        </div>
      </div>
    </Card>
  );
};

const ReportCast: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const photoFrame = ACTIONS.report.photo * fps;
  const snapping = frame >= photoFrame - 2 && frame <= photoFrame + 12;
  const snap = interpolate(
    frame,
    [photoFrame, photoFrame + 4, photoFrame + 28],
    [0, 1, 0],
    CLAMP,
  );
  const reportStartFrame = Math.round(
    (v3Script.scenes.find((item) => item.id === 'hook')?.sceneDuration ?? 0) * fps,
  );
  return (
    <>
      <Card
        label="THE STREET"
        kicker="PAPER CUT"
        style={{ left: 18, top: 126, width: CAST_W, height: 318 }}
        rotate={-1.4}
      >
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
          flash={snapping}
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
          {scene.caption.split('\n')[1] ?? 'REPORT · EXIF STRIPPED'}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 26,
            fontFamily: fonts.mono,
            fontSize: 7.5,
            letterSpacing: '0.08em',
            color: palette.green,
            opacity: snap,
            transform: `translateY(${(1 - snap) * 3}px)`,
          }}
        >
          SNAP · GPS STRIPPED
        </div>
        <BottomLabel>2 REPORTS · 1 POTHOLE · SAM + NEIGHBOR</BottomLabel>
      </Card>
      <Sequence from={reportStartFrame} durationInFrames={durationInFrames - reportStartFrame}>
        <PrivateAiCard />
      </Sequence>
    </>
  );
};

const CouncilCast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const voteFrame = ACTIONS.dao.award * fps;
  const voted = frame >= voteFrame;
  const votes: ['yes' | 'abstain', 'yes' | 'abstain', 'yes' | 'abstain'] = voted
    ? ['yes', 'yes', 'abstain']
    : ['yes', 'abstain', 'abstain'];
  const reveal = voted
    ? 1
    : Math.min(0.62, 0.3 + (frame / Math.max(1, voteFrame)) * 0.32);
  const pulse = interpolate(
    frame,
    [voteFrame, voteFrame + 6, voteFrame + 20],
    [1, 1.045, 1],
    CLAMP,
  );
  return (
    <Card
      label="THE COUNCIL"
      kicker="2 OF 3"
      style={{ left: 18, top: 126, width: CAST_W, height: 252 }}
      rotate={-1.1}
    >
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 4,
          transform: `scale(${pulse})`,
          transformOrigin: '50% 80%',
        }}
      >
        <CouncilTable
          votes={votes}
          revealProgress={reveal}
          width={288}
          height={186}
          frame={frame}
          fps={fps}
        />
      </div>
      <BottomLabel>{voted ? 'MOTION CARRIED · 2 OF 3 · NO AI VOTE' : 'YES · ABSTAIN · ABSTAIN · NO AI VOTE'}</BottomLabel>
    </Card>
  );
};

const BidderCast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealFrame = ACTIONS.bids.reveal * fps;
  const revealed = Math.min(1, Math.max(0, (frame - revealFrame) / 16));
  const winner = frame >= revealFrame + 10 ? 'B' : null;
  return (
    <Card
      label="THE BIDDERS"
      kicker="SEALED"
      style={{ left: 18, bottom: 214, width: CAST_W, height: 238 }}
      rotate={0.8}
    >
      <BidderRow
        revealed={revealed}
        winner={winner}
        bids={{ A: 2873, B: 9270, C: 5200 }}
        width={288}
        height={190}
        frame={frame}
        fps={fps}
        style={{ position: 'absolute', left: 6, top: 6 }}
      />
      <BottomLabel>{winner ? 'B 9,270 · VALUE WINNER' : 'SEALED · REVEAL WINDOW'}</BottomLabel>
    </Card>
  );
};

const RepairCast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const checklistFrame = ACTIONS.repair.checklist * fps;
  const acceptFrame = ACTIONS.repair.accept * fps;
  const accepted = frame >= acceptFrame;
  const video = mediaAt('assets/footage/repair.mp4');
  const checks: Array<{ label: string; on: boolean }> = [
    { label: 'CHECKLIST', on: frame >= checklistFrame },
    { label: 'EVIDENCE', on: frame >= checklistFrame + 8 },
    { label: 'SIGNATURE', on: accepted },
  ];
  return (
    <>
      <Card
        label="THE REPAIR"
        kicker="VIDEO"
        style={{ left: 18, top: 126, width: CAST_W, height: 236 }}
        rotate={-1.1}
      >
        {video?.kind === 'video' ? (
          <OffthreadVideo
            src={video.src}
            muted
            playbackRate={0.67}
            style={{
              position: 'absolute',
              inset: 8,
              width: 'calc(100% - 16px)',
              height: 'calc(100% - 16px)',
              objectFit: 'cover',
            }}
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
          style={{ position: 'absolute', right: 8, bottom: 28, zIndex: 2 }}
        />
        <BottomLabel dark>ILLUSTRATIVE REPAIR B-ROLL · LOCAL CONTRACTOR</BottomLabel>
      </Card>
      <Card
        label="THE INSPECTOR"
        kicker="HUMAN"
        style={{ right: 18, bottom: 214, width: CAST_W, height: 230 }}
        rotate={1.2}
      >
        <Inspector
          pose="hold-clipboard"
          width={86}
          height={172}
          frame={frame}
          fps={fps}
          animated
          enterAt={5}
          stamp={accepted}
          style={{ position: 'absolute', left: 38, bottom: 26 }}
        />
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 16,
            width: 132,
            fontFamily: fonts.mono,
            fontSize: 9,
            lineHeight: 1.6,
            color: palette.inkSoft,
          }}
        >
          {checks.map((check) => (
            <div key={check.label} style={{ color: check.on ? palette.green : palette.muted }}>
              {check.on ? '✓ ' : '· '}
              {check.label}
            </div>
          ))}
          <span style={{ color: palette.green }}>NOT THE CONTRACTOR</span>
        </div>
        <BottomLabel>{accepted ? 'SIGNED · ACCEPTED · PAYMENT RELEASED' : 'CHECKLIST · EVIDENCE · SIGNATURE'}</BottomLabel>
      </Card>
    </>
  );
};

const PaymentCast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const splitFrame = ACTIONS.payment.split * fps;
  const paid = Math.round(interpolate(frame, [splitFrame, splitFrame + 14], [0, 72], CLAMP));
  const held = Math.round(interpolate(frame, [splitFrame + 16, splitFrame + 28], [0, 8], CLAMP));
  const paidNow = frame >= splitFrame + 14;
  const pulse = interpolate(
    frame,
    [splitFrame + 12, splitFrame + 18, splitFrame + 34],
    [1, 1.05, 1],
    CLAMP,
  );
  const bar = interpolate(frame, [splitFrame, splitFrame + 24], [0, 100], CLAMP);
  return (
    <Card
      label="THE PAYOUT"
      kicker="SETTLED"
      style={{ right: 18, bottom: 214, width: CAST_W, height: 232 }}
      rotate={-1}
    >
      <div
        style={{
          position: 'absolute',
          left: 22,
          bottom: 30,
          transform: `scale(${pulse})`,
          transformOrigin: '50% 100%',
        }}
      >
        <Contractor
          pose="stand"
          width={82}
          height={154}
          frame={frame}
          fps={fps}
          animated
          enterAt={4}
        />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 16, width: 172 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: fonts.display, fontSize: 34, color: palette.green, lineHeight: 1 }}>
            {paid}
          </span>
          {paidNow ? (
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: palette.paper,
                background: palette.green,
                borderRadius: 999,
                padding: '3px 6px',
              }}
            >
              PAID
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: palette.muted }}>
          USDC PAID
        </div>
        <div style={{ marginTop: 14, fontFamily: fonts.display, fontSize: 26, color: palette.amberStrong, lineHeight: 1 }}>
          {held}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: palette.muted }}>
          HELD → RELEASED
        </div>
        <div style={{ marginTop: 13, height: 4, width: 140, background: palette.line }}>
          <div style={{ height: '100%', width: `${bar}%`, background: palette.green }} />
        </div>
      </div>
      <BottomLabel>EXACT 100 · 20 · 72 · 8</BottomLabel>
    </Card>
  );
};

const PassportCast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const historyFrame = ACTIONS.passport.history * fps;
  const entriesFrame = ACTIONS.passport.entries * fps;
  const recorded = frame >= entriesFrame;
  const samPulse = interpolate(
    frame,
    [historyFrame, historyFrame + 8, historyFrame + 24],
    [1, 1.035, 1],
    CLAMP,
  );
  return (
    <Card
      label="THE PASSPORT"
      kicker="SAME ASSET"
      style={{ left: 18, bottom: 214, width: CAST_W, height: 238 }}
      rotate={1.1}
    >
      <Pothole variant="fixed" scale={0.36} style={{ left: 5, bottom: 40 }} />
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 12,
          fontFamily: fonts.mono,
          fontSize: 9,
          color: palette.green,
          lineHeight: 1.55,
        }}
      >
        PATH-006
        <br />
        FIXED
        <br />
        REMEMBERED
      </div>
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          fontFamily: fonts.mono,
          fontSize: 7.5,
          letterSpacing: '0.06em',
          color: palette.paper,
          background: palette.green,
          padding: '3px 6px',
          opacity: recorded ? 1 : 0,
          transform: `translateY(${recorded ? 0 : 3}px)`,
        }}
      >
        RECORDED
      </div>
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 26,
          transform: `scale(${samPulse})`,
          transformOrigin: '50% 100%',
        }}
      >
        <Sam
          pose="look-at-screen"
          width={86}
          height={172}
          frame={frame}
          fps={fps}
          animated
          enterAt={5}
        />
      </div>
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
      <BottomLabel>THE REPAIR STAYS WITH THE ASSET</BottomLabel>
    </Card>
  );
};

const CastForScene: React.FC<{ scene: V3Scene }> = ({ scene }) => {
  switch (scene.id) {
    case 'report':
      return <ReportCast scene={scene} />;
    case 'dao':
      return <CouncilCast />;
    case 'bids':
      return <BidderCast />;
    case 'repair':
      return <RepairCast />;
    case 'payment':
      return <PaymentCast />;
    case 'passport':
      return <PassportCast />;
    case 'tech':
      // Tech beat is deliberately cast-free: the three-layer rail needs the room.
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
        const duration =
          scene.id === 'report' ? scene.start + scene.sceneDuration : scene.sceneDuration;
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
