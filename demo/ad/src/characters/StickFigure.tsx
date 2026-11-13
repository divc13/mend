import React from 'react';
import type { CSSProperties } from 'react';
import { evolvePath } from '@remotion/paths';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts, palette } from '../theme';

const VIEW_W = 220;
const VIEW_H = 380;
const GROUND = 352;
const CX = 110;
const HEAD_R = 28;
const ARM_UPPER = 48;
const ARM_LOWER = 44;
const LEG_UPPER = 58;
const LEG_LOWER = 56;

const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

type Point = { x: number; y: number };
type Limb = { upper: number; lower: number };
type Side = 'left' | 'right';

export type StickPose =
  | 'stand'
  | 'walk'
  | 'kneel'
  | 'raise-card'
  | 'hold-envelope'
  | 'hold-clipboard'
  | 'hold-phone';

export type StickAccessory =
  | 'phone'
  | 'card'
  | 'envelope'
  | 'clipboard'
  | 'wrench';

type PoseSpec = {
  hipY: number;
  neckY: number;
  headY: number;
  headTilt: number;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  footL: number;
  footR: number;
  accessorySide: Side;
  defaultAccessory?: StickAccessory;
};

const baseSpec = (): PoseSpec => ({
  hipY: 236,
  neckY: 94,
  headY: 62,
  headTilt: 0,
  armL: { upper: -10, lower: -14 },
  armR: { upper: 10, lower: 14 },
  legL: { upper: -6, lower: -2 },
  legR: { upper: 6, lower: 2 },
  footL: 0,
  footR: 0,
  accessorySide: 'right',
});

const POSES: Record<StickPose, PoseSpec> = {
  stand: baseSpec(),
  walk: baseSpec(),
  kneel: {
    hipY: 280,
    neckY: 158,
    headY: 126,
    headTilt: 5,
    armL: { upper: 18, lower: 6 },
    armR: { upper: 24, lower: 68 },
    legL: { upper: -20, lower: -80 },
    legR: { upper: 55, lower: -55 },
    footL: 180,
    footR: 0,
    accessorySide: 'right',
  },
  'raise-card': {
    ...baseSpec(),
    headTilt: -3,
    armL: { upper: -20, lower: -12 },
    armR: { upper: 135, lower: 155 },
    legL: { upper: -10, lower: -4 },
    legR: { upper: 10, lower: 4 },
    defaultAccessory: 'card',
  },
  'hold-envelope': {
    ...baseSpec(),
    armL: { upper: -12, lower: -6 },
    armR: { upper: 55, lower: 15 },
    legL: { upper: -8, lower: -3 },
    legR: { upper: 8, lower: 3 },
    defaultAccessory: 'envelope',
  },
  'hold-clipboard': {
    ...baseSpec(),
    headTilt: 4,
    armL: { upper: 35, lower: -35 },
    armR: { upper: 10, lower: 14 },
    legL: { upper: -7, lower: -2 },
    legR: { upper: 7, lower: 2 },
    accessorySide: 'left',
    defaultAccessory: 'clipboard',
  },
  'hold-phone': {
    ...baseSpec(),
    headTilt: 4,
    armL: { upper: -10, lower: -14 },
    armR: { upper: 5, lower: 145 },
    legL: { upper: -6, lower: -2 },
    legR: { upper: 6, lower: 2 },
    defaultAccessory: 'phone',
  },
};

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

const pointAt = (origin: Point, length: number, angle: number): Point => ({
  x: origin.x + Math.sin(toRad(angle)) * length,
  y: origin.y + Math.cos(toRad(angle)) * length,
});

type Skeleton = {
  head: Point;
  neck: Point;
  shoulder: Point;
  hip: Point;
  elbowL: Point;
  wristL: Point;
  elbowR: Point;
  wristR: Point;
  kneeL: Point;
  ankleL: Point;
  kneeR: Point;
  ankleR: Point;
};

type AngleOverrides = {
  armL?: number;
  armR?: number;
  foreL?: number;
  foreR?: number;
  legL?: number;
  legR?: number;
  shinL?: number;
  shinR?: number;
};

const buildSkeleton = (
  spec: PoseSpec,
  overrides: AngleOverrides,
  breath: number,
): Skeleton => {
  const neck = { x: CX, y: spec.neckY - breath };
  const head = { x: CX, y: spec.headY - breath };
  const shoulder = { x: CX, y: spec.neckY + 20 - breath };
  const hip = { x: CX, y: spec.hipY };

  const armL = {
    upper: overrides.armL ?? spec.armL.upper,
    lower: overrides.foreL ?? spec.armL.lower,
  };
  const armR = {
    upper: overrides.armR ?? spec.armR.upper,
    lower: overrides.foreR ?? spec.armR.lower,
  };
  const legL = {
    upper: overrides.legL ?? spec.legL.upper,
    lower: overrides.shinL ?? spec.legL.lower,
  };
  const legR = {
    upper: overrides.legR ?? spec.legR.upper,
    lower: overrides.shinR ?? spec.legR.lower,
  };

  const elbowL = pointAt(shoulder, ARM_UPPER, armL.upper);
  const wristL = pointAt(elbowL, ARM_LOWER, armL.lower);
  const elbowR = pointAt(shoulder, ARM_UPPER, armR.upper);
  const wristR = pointAt(elbowR, ARM_LOWER, armR.lower);
  const kneeL = pointAt(hip, LEG_UPPER, legL.upper);
  const ankleL = pointAt(kneeL, LEG_LOWER, legL.lower);
  const kneeR = pointAt(hip, LEG_UPPER, legR.upper);
  const ankleR = pointAt(kneeR, LEG_LOWER, legR.lower);

  return {
    head,
    neck,
    shoulder,
    hip,
    elbowL,
    wristL,
    elbowR,
    wristR,
    kneeL,
    ankleL,
    kneeR,
    ankleR,
  };
};

const walkSpec = (phase: number): PoseSpec => {
  const swing = Math.sin(phase * Math.PI * 2) * 26;
  const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 4;
  const bendL = swing < 0 ? 24 : 10;
  const bendR = swing > 0 ? 24 : 10;
  return {
    hipY: 236 - bob * 0.3,
    neckY: 94 - bob,
    headY: 62 - bob,
    headTilt: -1,
    armL: { upper: -8 - swing * 0.65, lower: -12 - swing * 0.65 },
    armR: { upper: 8 + swing * 0.65, lower: 12 + swing * 0.65 },
    legL: { upper: swing, lower: swing + bendL },
    legR: { upper: -swing, lower: -swing + bendR },
    footL: swing > 0 ? -8 : 8,
    footR: swing > 0 ? 8 : -8,
    accessorySide: 'right',
  };
};

const limbColor = palette.ink;
const hairColor = palette.ink;

const Shoe: React.FC<{ at: Point; angle: number }> = ({ at, angle }) => (
  <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
    <rect x={-8} y={-4} width={25} height={10} rx={5} fill={limbColor} />
  </g>
);

const Limb: React.FC<{
  points: Point[];
  width?: number;
  color?: string;
}> = ({ points, width = 9, color = limbColor }) => {
  const [first, ...rest] = points;
  if (!first) {
    return null;
  }
  const d = [
    `M ${first.x} ${first.y}`,
    ...rest.map((point) => `L ${point.x} ${point.y}`),
  ].join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

const Joint: React.FC<{ at: Point; r?: number; color?: string }> = ({
  at,
  r = 4.5,
  color = limbColor,
}) => <circle cx={at.x} cy={at.y} r={r} fill={color} />;

export type StickFigureProps = {
  /** Body pose preset. Angles can still be overridden below. */
  pose?: StickPose;
  width?: number;
  height?: number;
  colorTag?: string;
  tagLabel?: string;
  hardHat?: boolean;
  glasses?: boolean;
  /** Override the pose's default accessory. Pass null to hide it. */
  accessory?: StickAccessory | null;
  accessorySide?: 'left' | 'right';
  cardLabel?: string;
  cardTone?: string;
  sash?: string;
  stamp?: boolean;
  armAngles?: { left?: number; right?: number };
  forearmAngles?: { left?: number; right?: number };
  legAngles?: { left?: number; right?: number };
  shinAngles?: { left?: number; right?: number };
  flip?: boolean;
  animated?: boolean;
  frame?: number;
  fps?: number;
  enterAt?: number;
  progress?: number;
  seed?: number;
  showShadow?: boolean;
  style?: CSSProperties;
  className?: string;
};

export const StickFigure: React.FC<StickFigureProps> = ({
  pose = 'stand',
  width = VIEW_W,
  height = VIEW_H,
  colorTag = palette.mint,
  tagLabel,
  hardHat = false,
  glasses = false,
  accessory,
  accessorySide,
  cardLabel,
  cardTone = palette.mint,
  sash,
  stamp = false,
  armAngles,
  forearmAngles,
  legAngles,
  shinAngles,
  flip = false,
  animated = true,
  frame: frameOverride,
  fps: fpsOverride,
  enterAt = 0,
  progress,
  seed = 0,
  showShadow = true,
  style,
  className,
}) => {
  const currentFrame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const frame = frameOverride ?? currentFrame;
  const fps = fpsOverride ?? videoConfig.fps;

  const isWalk = pose === 'walk';
  const phase = progress ?? ((frame % 48) / 48);
  const spec = isWalk ? walkSpec(phase) : POSES[pose];
  const breath = isWalk ? 0 : Math.sin((frame + seed * 37) / 24) * 0.7;

  const skeleton = buildSkeleton(
    spec,
    {
      armL: armAngles?.left,
      armR: armAngles?.right,
      foreL: forearmAngles?.left,
      foreR: forearmAngles?.right,
      legL: legAngles?.left,
      legR: legAngles?.right,
      shinL: shinAngles?.left,
      shinR: shinAngles?.right,
    },
    breath,
  );

  const resolvedAccessory =
    accessory === undefined ? spec.defaultAccessory ?? null : accessory;
  const side = accessorySide ?? spec.accessorySide;
  const wrist = side === 'left' ? skeleton.wristL : skeleton.wristR;
  const elbow = side === 'left' ? skeleton.elbowL : skeleton.elbowR;
  const accessoryProgress =
    progress ?? (resolvedAccessory === 'envelope' ? 0 : 1);
  const ap = clamp(accessoryProgress);

  const localFrame = frame - enterAt;
  const entrance = animated
    ? spring({
        frame: Math.max(0, localFrame),
        fps,
        config: { damping: 15, stiffness: 130, mass: 0.8 },
      })
    : 1;
  const enterOpacity = animated
    ? interpolate(localFrame, [0, 8], [0, 1], CLAMP)
    : 1;
  const scale = 0.9 + entrance * 0.1;
  const translateY = (1 - entrance) * 10;

  const stampIn = animated
    ? spring({
        frame: Math.max(0, frame - 14 - seed * 2),
        fps,
        config: { damping: 11, stiffness: 160, mass: 0.7 },
      })
    : 1;
  const stampScale = 0.45 + stampIn * 0.55;
  const stampPath = 'M -7 0 L -2 5 L 8 -6';
  const stampEvolve = evolvePath(clamp(stampIn * 1.4), stampPath);

  const tagX = skeleton.shoulder.x + 14;
  const tagY = skeleton.shoulder.y + 34;
  const badgeRotation = -6;

  const cardW = 54;
  const cardH = 40;
  const envelopeW = 54;
  const envelopeH = 36;
  const clipboardW = 48;
  const clipboardH = 62;

  const phoneCenter = {
    x: wrist.x + 14,
    y: wrist.y - 2,
  };

  const renderAccessory = (): React.ReactNode => {
    if (resolvedAccessory === null) {
      return null;
    }

    if (resolvedAccessory === 'card') {
      return (
        <g
          transform={`translate(${wrist.x + 10} ${wrist.y - 16}) rotate(-5) scale(${
            0.45 + ap * 0.55
          })`}
          opacity={clamp(ap * 1.6)}
        >
          <rect
            x={-cardW / 2 + 2}
            y={-cardH / 2 + 3}
            width={cardW}
            height={cardH}
            rx={5}
            fill={palette.ink}
            opacity={0.12}
          />
          <rect
            x={-cardW / 2}
            y={-cardH / 2}
            width={cardW}
            height={cardH}
            rx={5}
            fill={cardTone}
            stroke={palette.ink}
            strokeWidth={3}
          />
          <rect
            x={-cardW / 2}
            y={-cardH / 2}
            width={cardW}
            height={11}
            rx={5}
            fill={palette.ink}
            opacity={0.12}
          />
          {cardLabel ? (
            <text
              x={0}
              y={3}
              textAnchor="middle"
              fontFamily={fonts.mono}
              fontSize={11.5}
              fontWeight={700}
              letterSpacing="0.06em"
              fill={palette.ink}
            >
              {cardLabel}
            </text>
          ) : (
            <path
              d="M -12 1 L -4 9 L 13 -8"
              fill="none"
              stroke={palette.ink}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      );
    }

    if (resolvedAccessory === 'envelope') {
      const open = clamp(ap);
      return (
        <g
          transform={`translate(${wrist.x + 10} ${wrist.y - 2}) rotate(6)`}
        >
          {open > 0.15 ? (
            <rect
              x={-envelopeW / 2 + 5}
              y={-envelopeH / 2 - 12 * open}
              width={envelopeW - 10}
              height={envelopeH - 6}
              rx={2}
              fill={palette.surfaceSoft}
              stroke={palette.ink}
              strokeWidth={2}
            />
          ) : null}
          <rect
            x={-envelopeW / 2 + 2}
            y={-envelopeH / 2 + 3}
            width={envelopeW}
            height={envelopeH}
            rx={4}
            fill={palette.ink}
            opacity={0.12}
          />
          <rect
            x={-envelopeW / 2}
            y={-envelopeH / 2}
            width={envelopeW}
            height={envelopeH}
            rx={4}
            fill={palette.surface}
            stroke={palette.ink}
            strokeWidth={3}
          />
          <path
            d={
              open < 0.5
                ? `M ${-envelopeW / 2 + 2} ${-envelopeH / 2 + 2} L 0 ${
                    envelopeH / 2 - 10
                  } L ${envelopeW / 2 - 2} ${-envelopeH / 2 + 2}`
                : `M ${-envelopeW / 2 + 2} ${-envelopeH / 2 + 2} L 0 ${
                    -envelopeH / 2 - 18 * open
                  } L ${envelopeW / 2 - 2} ${-envelopeH / 2 + 2}`
            }
            fill="none"
            stroke={palette.ink}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <circle
            cx={0}
            cy={3}
            r={7}
            fill={palette.amber}
            stroke={palette.ink}
            strokeWidth={2}
          />
          <path
            d="M -2.5 3 L -0.5 5 L 3.5 0.5"
            fill="none"
            stroke={palette.paper}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      );
    }

    if (resolvedAccessory === 'clipboard') {
      return (
        <g
          transform={`translate(${wrist.x - 4} ${wrist.y - 18}) rotate(-8)`}
        >
          <rect
            x={-clipboardW / 2 + 2}
            y={-clipboardH / 2 + 3}
            width={clipboardW}
            height={clipboardH}
            rx={5}
            fill={palette.ink}
            opacity={0.12}
          />
          <rect
            x={-clipboardW / 2}
            y={-clipboardH / 2}
            width={clipboardW}
            height={clipboardH}
            rx={5}
            fill={palette.amberSoft}
            stroke={palette.ink}
            strokeWidth={3}
          />
          <rect
            x={-clipboardW / 2 + 5}
            y={-clipboardH / 2 + 9}
            width={clipboardW - 10}
            height={clipboardH - 17}
            rx={2}
            fill={palette.surface}
            stroke={palette.ink}
            strokeWidth={1.8}
          />
          <rect
            x={-9}
            y={-clipboardH / 2 - 4}
            width={18}
            height={10}
            rx={3}
            fill={palette.ink}
          />
          {[0, 1, 2].map((line) => (
            <rect
              key={line}
              x={-clipboardW / 2 + 9}
              y={-clipboardH / 2 + 18 + line * 8}
              width={line === 2 ? 16 : clipboardW - 18}
              height={2.5}
              rx={1.2}
              fill={palette.ink}
              opacity={0.42}
            />
          ))}
          <path
            d="M -4 12 L 0 16 L 9 6"
            fill="none"
            stroke={palette.green}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }

    if (resolvedAccessory === 'wrench') {
      return (
        <g transform={`translate(${wrist.x + 10} ${wrist.y + 2}) rotate(18)`}>
          <rect
            x={-4}
            y={-24}
            width={8}
            height={48}
            rx={4}
            fill={palette.muted}
            stroke={palette.ink}
            strokeWidth={2.5}
          />
          <path
            d="M -12 -34 Q -12 -44 0 -44 Q 12 -44 12 -34 L 7 -30 L 7 -38 L -7 -38 L -7 -30 Z"
            fill={palette.muted}
            stroke={palette.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </g>
      );
    }

    return (
      <g>
        <ellipse
          cx={phoneCenter.x}
          cy={phoneCenter.y}
          rx={24}
          ry={34}
          fill={palette.mint}
          opacity={0.18 * ap}
        />
        <g
          transform={`translate(${phoneCenter.x} ${phoneCenter.y}) rotate(-8)`}
        >
          <rect
            x={-14}
            y={-24}
            width={28}
            height={48}
            rx={7}
            fill={palette.ink}
          />
          <rect
            x={-11.5}
            y={-21.5}
            width={23}
            height={43}
            rx={4.5}
            fill={palette.greenDark}
            stroke={palette.ink}
            strokeWidth={2}
          />
          <rect
            x={-9}
            y={-18}
            width={18}
            height={33}
            rx={2.5}
            fill={palette.mint}
            opacity={0.55 + 0.45 * ap}
          />
          <rect
            x={-6}
            y={-14}
            width={12}
            height={3}
            rx={1.5}
            fill={palette.green}
            opacity={0.75}
          />
          <rect
            x={-6}
            y={-8}
            width={8}
            height={2.5}
            rx={1.2}
            fill={palette.green}
            opacity={0.5}
          />
          <circle cx={0} cy={19} r={2} fill={palette.mint} />
        </g>
      </g>
    );
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      aria-hidden="true"
      style={{
        display: 'block',
        overflow: 'visible',
        opacity: enterOpacity,
        transform: `translateY(${translateY}px) scale(${
          flip ? -scale : scale
        }, ${scale})`,
        transformOrigin: '50% 100%',
        ...style,
      }}
    >
      {showShadow ? (
        <ellipse
          cx={CX}
          cy={GROUND + 2}
          rx={pose === 'kneel' ? 58 : 46}
          ry={7}
          fill={palette.ink}
          opacity={0.11}
        />
      ) : null}

      <g
        style={{
          filter: 'drop-shadow(3px 4px 0 rgba(17, 34, 29, 0.10))',
        }}
      >
        {/* Legs */}
        <Limb
          points={[skeleton.hip, skeleton.kneeL, skeleton.ankleL]}
          width={9}
        />
        <Joint at={skeleton.kneeL} />
        <Shoe at={skeleton.ankleL} angle={spec.footL} />

        <Limb
          points={[skeleton.hip, skeleton.kneeR, skeleton.ankleR]}
          width={9}
        />
        <Joint at={skeleton.kneeR} />
        <Shoe at={skeleton.ankleR} angle={spec.footR} />

        {/* Arms */}
        <Limb
          points={[skeleton.shoulder, skeleton.elbowL, skeleton.wristL]}
          width={9}
        />
        <Joint at={skeleton.elbowL} r={4} />
        <circle
          cx={skeleton.wristL.x}
          cy={skeleton.wristL.y}
          r={5.4}
          fill={limbColor}
        />

        <Limb
          points={[skeleton.shoulder, skeleton.elbowR, skeleton.wristR]}
          width={9}
        />
        <Joint at={skeleton.elbowR} r={4} />
        <circle
          cx={skeleton.wristR.x}
          cy={skeleton.wristR.y}
          r={5.4}
          fill={limbColor}
        />

        {/* Torso */}
        <Limb
          points={[
            { x: skeleton.head.x, y: skeleton.head.y + HEAD_R - 2 },
            skeleton.hip,
          ]}
          width={8.5}
        />

        {sash ? (
          <g>
            <path
              d={`M ${skeleton.shoulder.x - 22} ${
                skeleton.shoulder.y + 5
              } L ${skeleton.hip.x + 17} ${skeleton.hip.y - 10}`}
              stroke={palette.ink}
              strokeWidth={19}
              strokeLinecap="round"
            />
            <path
              d={`M ${skeleton.shoulder.x - 22} ${
                skeleton.shoulder.y + 5
              } L ${skeleton.hip.x + 17} ${skeleton.hip.y - 10}`}
              stroke={sash}
              strokeWidth={13}
              strokeLinecap="round"
            />
            <circle
              cx={skeleton.shoulder.x - 20}
              cy={skeleton.shoulder.y + 6}
              r={4.5}
              fill={palette.paper}
              stroke={palette.ink}
              strokeWidth={2}
            />
          </g>
        ) : null}

        {/* Head */}
        <g
          transform={`rotate(${spec.headTilt} ${skeleton.head.x} ${skeleton.head.y})`}
        >
          <circle
            cx={skeleton.head.x}
            cy={skeleton.head.y}
            r={HEAD_R}
            fill={palette.surface}
            stroke={palette.ink}
            strokeWidth={7.5}
          />
          {!hardHat ? (
            <path
              d={`M ${skeleton.head.x - 27} ${skeleton.head.y - 2}
                  Q ${skeleton.head.x - 29} ${skeleton.head.y - 31} ${
                skeleton.head.x
              } ${skeleton.head.y - 31}
                  Q ${skeleton.head.x + 29} ${skeleton.head.y - 31} ${
                skeleton.head.x + 27
              } ${skeleton.head.y - 2}
                  Q ${skeleton.head.x + 17} ${skeleton.head.y - 13} ${
                skeleton.head.x + 6
              } ${skeleton.head.y - 11}
                  Q ${skeleton.head.x - 9} ${skeleton.head.y - 18} ${
                skeleton.head.x - 20
              } ${skeleton.head.y - 6}
                  Z`}
              fill={hairColor}
            />
          ) : null}

          <circle
            cx={skeleton.head.x - 9}
            cy={skeleton.head.y + 1}
            r={2.4}
            fill={palette.ink}
          />
          <circle
            cx={skeleton.head.x + 9}
            cy={skeleton.head.y + 1}
            r={2.4}
            fill={palette.ink}
          />
          <path
            d={`M ${skeleton.head.x - 6} ${skeleton.head.y + 12} Q ${
              skeleton.head.x
            } ${skeleton.head.y + 15} ${skeleton.head.x + 6} ${
              skeleton.head.y + 12
            }`}
            fill="none"
            stroke={palette.ink}
            strokeWidth={2.2}
            strokeLinecap="round"
          />

          {glasses ? (
            <g
              fill="none"
              stroke={palette.ink}
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              <rect
                x={skeleton.head.x - 18}
                y={skeleton.head.y - 7}
                width={15}
                height={14}
                rx={4}
              />
              <rect
                x={skeleton.head.x + 3}
                y={skeleton.head.y - 7}
                width={15}
                height={14}
                rx={4}
              />
              <path
                d={`M ${skeleton.head.x - 3} ${skeleton.head.y} L ${
                  skeleton.head.x + 3
                } ${skeleton.head.y}`}
              />
            </g>
          ) : null}

          {hardHat ? (
            <g>
              <path
                d={`M ${skeleton.head.x - 30} ${skeleton.head.y - 14}
                    Q ${skeleton.head.x - 28} ${skeleton.head.y - 46} ${
                  skeleton.head.x
                } ${skeleton.head.y - 46}
                    Q ${skeleton.head.x + 28} ${skeleton.head.y - 46} ${
                  skeleton.head.x + 30
                } ${skeleton.head.y - 14} Z`}
                fill={palette.amber}
                stroke={palette.ink}
                strokeWidth={4}
                strokeLinejoin="round"
              />
              <rect
                x={skeleton.head.x - 38}
                y={skeleton.head.y - 19}
                width={76}
                height={8}
                rx={4}
                fill={palette.amberStrong}
                stroke={palette.ink}
                strokeWidth={3.5}
              />
              <path
                d={`M ${skeleton.head.x - 15} ${
                  skeleton.head.y - 38
                } L ${skeleton.head.x + 11} ${skeleton.head.y - 38}`}
                stroke={palette.amberSoft}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          ) : null}
        </g>

        {/* Chest tag */}
        <line
          x1={skeleton.neck.x}
          y1={skeleton.neck.y + 3}
          x2={tagX + 14}
          y2={tagY}
          stroke={palette.ink}
          strokeWidth={2}
        />
        <g
          transform={`rotate(${badgeRotation} ${tagX + 14} ${tagY + 10})`}
        >
          <rect
            x={tagX}
            y={tagY}
            width={28}
            height={20}
            rx={5}
            fill={colorTag}
            stroke={palette.ink}
            strokeWidth={2.5}
          />
          <circle
            cx={tagX + 14}
            cy={tagY + 4.5}
            r={2}
            fill={palette.paper}
            stroke={palette.ink}
            strokeWidth={1.4}
          />
          {tagLabel ? (
            <text
              x={tagX + 14}
              y={tagY + 15.5}
              textAnchor="middle"
              fontFamily={fonts.mono}
              fontSize={9}
              fontWeight={700}
              letterSpacing="0.06em"
              fill={palette.ink}
            >
              {tagLabel}
            </text>
          ) : (
            <path
              d={`M ${tagX + 9} ${tagY + 13} L ${tagX + 12.5} ${
                tagY + 16.5
              } L ${tagX + 19} ${tagY + 9}`}
              fill="none"
              stroke={palette.ink}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>

        {renderAccessory()}

        {stamp ? (
          <g
            transform={`translate(${wrist.x + 31} ${wrist.y - 38}) rotate(-11) scale(${stampScale})`}
            opacity={clamp(stampIn * 1.5)}
          >
            <circle
              cx={0}
              cy={0}
              r={17}
              fill={palette.paper}
              stroke={palette.green}
              strokeWidth={3}
            />
            <circle
              cx={0}
              cy={0}
              r={13}
              fill="none"
              stroke={palette.green}
              strokeWidth={1}
              opacity={0.55}
            />
            <path
              d={stampPath}
              fill="none"
              stroke={palette.green}
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={stampEvolve.strokeDasharray}
              strokeDashoffset={stampEvolve.strokeDashoffset}
            />
          </g>
        ) : null}
      </g>
    </svg>
  );
};
