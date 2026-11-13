import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { palette, fonts } from '../theme';
import { StickFigure } from './StickFigure';

const VIEW_W = 900;
const VIEW_H = 320;

const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export type CouncilVote = 'yes' | 'no' | 'abstain';

export type CouncilTableProps = {
  votes?: [CouncilVote, CouncilVote, CouncilVote];
  revealProgress?: number | boolean;
  frame?: number;
  fps?: number;
  width?: number;
  height?: number;
  animated?: boolean;
  style?: CSSProperties;
  className?: string;
};

const voteMeta = (vote: CouncilVote): {
  label: string;
  card: string;
  sash: string;
} => {
  if (vote === 'yes') {
    return { label: 'YES', card: palette.mint, sash: palette.green };
  }
  if (vote === 'no') {
    return { label: 'NO', card: palette.redSoft, sash: palette.red };
  }
  return { label: 'ABSTAIN', card: palette.amberSoft, sash: palette.amber };
};

const voteTally = (votes: [CouncilVote, CouncilVote, CouncilVote]): string => {
  const yes = votes.filter((vote) => vote === 'yes').length;
  const no = votes.filter((vote) => vote === 'no').length;
  const abstain = votes.filter((vote) => vote === 'abstain').length;
  const parts = [`${yes} YES`];
  if (no > 0) {
    parts.push(`${no} NO`);
  }
  if (abstain > 0) {
    parts.push(`${abstain} ABSTAIN`);
  }
  return parts.join(' · ');
};

export const CouncilTable: React.FC<CouncilTableProps> = ({
  votes = ['yes', 'yes', 'abstain'],
  revealProgress,
  frame: frameOverride,
  fps: fpsOverride,
  width = VIEW_W,
  height = VIEW_H,
  animated = true,
  style,
  className,
}) => {
  const currentFrame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const frame = frameOverride ?? currentFrame;
  const fps = fpsOverride ?? videoConfig.fps;

  const reveal =
    typeof revealProgress === 'boolean'
      ? revealProgress
        ? 1
        : 0
      : revealProgress !== undefined
        ? clamp(revealProgress)
        : animated
          ? spring({
              frame: Math.max(0, frame - 12),
              fps,
              config: { damping: 14, stiffness: 100, mass: 0.9 },
            })
          : 1;

  const cardProgress = votes.map((_, index) => {
    if (revealProgress !== undefined) {
      return clamp((reveal - index * 0.12) / 0.76);
    }
    return animated
      ? spring({
          frame: Math.max(0, frame - 18 - index * 6),
          fps,
          config: { damping: 13, stiffness: 120, mass: 0.8 },
        })
      : 1;
  });

  const tap = animated
    ? interpolate(frame, [22, 29, 37], [0, 1, 0], CLAMP) * clamp(reveal * 2)
    : 0;
  const gavelAngle = -18 + tap * 22;
  const stampIn = animated
    ? spring({
        frame: Math.max(0, frame - 30),
        fps,
        config: { damping: 12, stiffness: 150, mass: 0.7 },
      }) * reveal
    : reveal;

  const figureXs = [250, 450, 650];
  const tally = voteTally(votes);
  const yesCount = votes.filter((vote) => vote === 'yes').length;
  const noCount = votes.filter((vote) => vote === 'no').length;
  const motion = yesCount > noCount ? 'MOTION CARRIED' : 'MOTION FAILED';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      <ellipse
        cx={450}
        cy={306}
        rx={370}
        ry={12}
        fill={palette.ink}
        opacity={0.08}
      />

      {votes.map((vote, index) => {
        const meta = voteMeta(vote);
        return (
          <g
            key={`${vote}-${index}`}
            transform={`translate(${figureXs[index]} 8) scale(0.72)`}
          >
            <StickFigure
              pose="raise-card"
              width={220}
              height={380}
              accessory="card"
              cardLabel={meta.label}
              cardTone={meta.card}
              sash={meta.sash}
              colorTag={meta.sash}
              progress={cardProgress[index]}
              frame={frame}
              fps={fps}
              animated={animated}
              enterAt={0}
              seed={index + 1}
            />
          </g>
        );
      })}

      {/* Table */}
      <rect
        x={70}
        y={228}
        width={760}
        height={28}
        rx={10}
        fill={palette.surface}
        stroke={palette.ink}
        strokeWidth={4}
      />
      <rect
        x={90}
        y={256}
        width={720}
        height={50}
        rx={6}
        fill={palette.green}
        stroke={palette.ink}
        strokeWidth={4}
      />
      <path
        d="M 96 264 L 804 264"
        stroke={palette.mint}
        strokeWidth={2.5}
        opacity={0.55}
        strokeLinecap="round"
      />
      <rect x={120} y={306} width={28} height={12} rx={3} fill={palette.greenDark} />
      <rect x={752} y={306} width={28} height={12} rx={3} fill={palette.greenDark} />

      <text
        x={450}
        y={287}
        textAnchor="middle"
        fontFamily={fonts.mono}
        fontSize={15}
        fontWeight={600}
        letterSpacing="0.12em"
        fill={palette.paper}
      >
        {motion} · {tally}
      </text>

      {[0, 1, 2].map((index) => {
        const meta = voteMeta(votes[index]);
        return (
          <circle
            key={`pip-${index}`}
            cx={700 + index * 20}
            cy={287}
            r={5}
            fill={meta.card}
            stroke={palette.ink}
            strokeWidth={1.5}
          />
        );
      })}

      {/* Approval paper + stamp */}
      <g transform="rotate(-2 450 228)">
        <rect
          x={370}
          y={202}
          width={160}
          height={52}
          rx={3}
          fill={palette.surface}
          stroke={palette.ink}
          strokeWidth={2.5}
        />
        <path
          d="M 386 214 L 514 214"
          stroke={palette.lineStrong}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
        <path
          d="M 386 222 L 470 222"
          stroke={palette.lineStrong}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      </g>

      <g
        transform={`translate(450 230) rotate(-9) scale(${
          0.55 + stampIn * 0.45
        })`}
        opacity={clamp(stampIn * 1.4)}
      >
        <circle
          cx={0}
          cy={0}
          r={24}
          fill="none"
          stroke={palette.green}
          strokeWidth={3.5}
        />
        <circle
          cx={0}
          cy={0}
          r={18}
          fill="none"
          stroke={palette.green}
          strokeWidth={1.2}
          opacity={0.55}
        />
        <path
          d="M -8 -3 L -3 3 L 8 -8"
          fill="none"
          stroke={palette.green}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x={0}
          y={12}
          textAnchor="middle"
          fontFamily={fonts.mono}
          fontSize={7.5}
          fontWeight={700}
          letterSpacing="0.06em"
          fill={palette.green}
        >
          APPROVED
        </text>
      </g>

      {/* Gavel */}
      <rect
        x={738}
        y={224}
        width={56}
        height={14}
        rx={4}
        fill={palette.amberSoft}
        stroke={palette.ink}
        strokeWidth={2.5}
      />
      <g transform={`translate(690 208) rotate(${gavelAngle})`}>
        <rect
          x={0}
          y={-6}
          width={72}
          height={12}
          rx={6}
          fill={palette.amber}
          stroke={palette.ink}
          strokeWidth={3}
        />
        <rect
          x={64}
          y={-20}
          width={30}
          height={40}
          rx={9}
          fill={palette.amberStrong}
          stroke={palette.ink}
          strokeWidth={3}
        />
        <path
          d="M 71 -12 L 87 -12"
          stroke={palette.amberSoft}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      {tap > 0.05 ? (
        <g
          transform="translate(772 214)"
          opacity={tap}
          stroke={palette.amber}
          strokeWidth={3}
          strokeLinecap="round"
        >
          <path d="M 0 -18 L 0 -8" />
          <path d="M 14 -12 L 8 -4" />
          <path d="M -14 -12 L -8 -4" />
          <path d="M 20 2 L 10 4" />
          <path d="M -20 2 L -10 4" />
        </g>
      ) : null}
    </svg>
  );
};
