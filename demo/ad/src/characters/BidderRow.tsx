import React from 'react';
import type { CSSProperties } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts, palette } from '../theme';
import { StickFigure } from './StickFigure';

const VIEW_W = 900;
const VIEW_H = 300;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export type BidderId = 'A' | 'B' | 'C';

export type BidderRowProps = {
  revealed?: boolean | number;
  winner?: BidderId | null;
  bids?: Partial<Record<BidderId, number>>;
  frame?: number;
  fps?: number;
  width?: number;
  height?: number;
  animated?: boolean;
  style?: CSSProperties;
  className?: string;
};

const DEFAULT_BIDS: Record<BidderId, number> = {
  A: 92,
  B: 78,
  C: 85,
};

const BIDDER_COLORS: Record<BidderId, string> = {
  A: palette.mint,
  B: palette.amber,
  C: palette.blue,
};

const LockIcon: React.FC = () => (
  <g>
    <path
      d="M -6 -3 L -6 -7 Q -6 -13 0 -13 Q 6 -13 6 -7 L 6 -3"
      fill="none"
      stroke={palette.ink}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <rect
      x={-9}
      y={-3}
      width={18}
      height={14}
      rx={3}
      fill={palette.amberSoft}
      stroke={palette.ink}
      strokeWidth={2}
    />
    <circle cx={0} cy={3} r={1.8} fill={palette.ink} />
  </g>
);

export const BidderRow: React.FC<BidderRowProps> = ({
  revealed,
  winner = null,
  bids,
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

  const resolvedBids: Record<BidderId, number> = {
    ...DEFAULT_BIDS,
    ...bids,
  };

  const reveal =
    typeof revealed === 'boolean'
      ? revealed
        ? 1
        : 0
      : revealed !== undefined
        ? clamp(revealed)
        : animated
          ? spring({
              frame: Math.max(0, frame - 14),
              fps,
              config: { damping: 14, stiffness: 105, mass: 0.9 },
            })
          : 1;

  const ids: BidderId[] = ['A', 'B', 'C'];
  const figureXs = [225, 450, 675];

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
        cy={284}
        rx={360}
        ry={10}
        fill={palette.ink}
        opacity={0.07}
      />

      {ids.map((id, index) => {
        const x = figureXs[index];
        const step = clamp((reveal - index * 0.12) / 0.76);
        const isWinner = winner === id;
        const bounce =
          isWinner && step > 0.5 && animated
            ? Math.abs(Math.sin((frame - 18) / 8)) * 10 * step
            : 0;
        const bid = resolvedBids[id];

        return (
          <g key={id}>
            {isWinner ? (
              <ellipse
                cx={x}
                cy={158}
                rx={78}
                ry={102}
                fill={palette.mint}
                opacity={0.12 * step}
              />
            ) : null}

            <ellipse
              cx={x}
              cy={280}
              rx={62}
              ry={7}
              fill={palette.ink}
              opacity={0.09}
            />

            <g transform={`translate(${x} ${24 - bounce}) scale(0.68)`}>
              <StickFigure
                pose="hold-envelope"
                width={220}
                height={380}
                accessory="envelope"
                colorTag={BIDDER_COLORS[id]}
                tagLabel={id}
                progress={step}
                frame={frame}
                fps={fps}
                animated={animated}
                enterAt={0}
                seed={index + 2}
              />
            </g>

            {/* Status card above the head */}
            <g transform={`translate(${x} 2)`}>
              <g opacity={1 - clamp(step * 1.4)}>
                <rect
                  x={-40}
                  y={0}
                  width={80}
                  height={28}
                  rx={14}
                  fill={palette.surface}
                  stroke={palette.ink}
                  strokeWidth={2.5}
                />
                <g transform="translate(-21 14)">
                  <LockIcon />
                </g>
                <text
                  x={4}
                  y={18}
                  textAnchor="middle"
                  fontFamily={fonts.mono}
                  fontSize={9}
                  fontWeight={600}
                  letterSpacing="0.08em"
                  fill={palette.ink}
                >
                  SEALED
                </text>
              </g>

              <g
                opacity={clamp(step * 1.5)}
                transform={`scale(${0.8 + step * 0.2})`}
              >
                <rect
                  x={-48}
                  y={0}
                  width={96}
                  height={28}
                  rx={8}
                  fill={isWinner ? palette.mint : palette.surface}
                  stroke={palette.ink}
                  strokeWidth={2.5}
                />
                <text
                  x={0}
                  y={18}
                  textAnchor="middle"
                  fontFamily={fonts.mono}
                  fontSize={9.5}
                  fontWeight={700}
                  letterSpacing="0.04em"
                  fill={palette.ink}
                >
                  {id} · {bid} USDC
                </text>
              </g>
            </g>

            <text
              x={x}
              y={291}
              textAnchor="middle"
              fontFamily={fonts.mono}
              fontSize={11}
              fontWeight={isWinner ? 700 : 500}
              letterSpacing="0.12em"
              fill={isWinner && step > 0.5 ? palette.green : palette.muted}
            >
              {isWinner && step > 0.5 ? 'WINNER' : `BIDDER ${id}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
