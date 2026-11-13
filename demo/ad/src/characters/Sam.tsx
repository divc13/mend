import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { palette } from '../theme';

const VIEW_W = 400;
const VIEW_H = 760;
const GROUND = 730;

const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

type Point = { x: number; y: number };
type Limb = { upper: number; lower: number };

const pointAt = (origin: Point, length: number, angle: number): Point => ({
  x: origin.x + Math.sin(toRad(angle)) * length,
  y: origin.y + Math.cos(toRad(angle)) * length,
});

const rotateAround = (origin: Point, point: Point, degrees: number): Point => {
  const rad = toRad(degrees);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
};

const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

const lerpPoint = (from: Point, to: Point, progress: number): Point => ({
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
});

type PhonePlacement = {
  anchor: 'right' | 'both';
  dx: number;
  dy: number;
  rotation: number;
};

type PoseSpec = {
  hip: Point;
  torsoLength: number;
  lean: number;
  headTilt: number;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  footL: number;
  footR: number;
  phone: PhonePlacement;
};

type SamSkeleton = {
  hip: Point;
  shoulderMid: Point;
  shoulderL: Point;
  shoulderR: Point;
  neck: Point;
  head: Point;
  elbowL: Point;
  wristL: Point;
  elbowR: Point;
  wristR: Point;
  kneeL: Point;
  ankleL: Point;
  kneeR: Point;
  ankleR: Point;
  phone: Point;
  phoneRotation: number;
  lean: number;
  headTilt: number;
  torsoLength: number;
  footL: number;
  footR: number;
};

const ARM_UPPER = 96;
const ARM_LOWER = 90;
const LEG_UPPER = 132;
const LEG_LOWER = 128;

const buildSkeleton = (spec: PoseSpec): SamSkeleton => {
  const hip = spec.hip;
  const shoulderMid = rotateAround(
    hip,
    { x: hip.x, y: hip.y - spec.torsoLength },
    spec.lean,
  );
  const axisRaw = {
    x: shoulderMid.x - hip.x,
    y: shoulderMid.y - hip.y,
  };
  const axisLength = Math.hypot(axisRaw.x, axisRaw.y) || 1;
  const axis = { x: axisRaw.x / axisLength, y: axisRaw.y / axisLength };
  const perp = { x: -axis.y, y: axis.x };

  const shoulderL = {
    x: shoulderMid.x - perp.x * 34,
    y: shoulderMid.y - perp.y * 34,
  };
  const shoulderR = {
    x: shoulderMid.x + perp.x * 34,
    y: shoulderMid.y + perp.y * 34,
  };
  const neck = {
    x: shoulderMid.x + axis.x * 22,
    y: shoulderMid.y + axis.y * 22,
  };
  const headBase = {
    x: neck.x + axis.x * 58,
    y: neck.y + axis.y * 58,
  };
  const head = rotateAround(neck, headBase, spec.headTilt);

  const elbowL = pointAt(shoulderL, ARM_UPPER, spec.armL.upper);
  const wristL = pointAt(elbowL, ARM_LOWER, spec.armL.lower);
  const elbowR = pointAt(shoulderR, ARM_UPPER, spec.armR.upper);
  const wristR = pointAt(elbowR, ARM_LOWER, spec.armR.lower);

  const hipL = { x: hip.x - perp.x * 20, y: hip.y - perp.y * 20 };
  const hipR = { x: hip.x + perp.x * 20, y: hip.y + perp.y * 20 };
  const kneeL = pointAt(hipL, LEG_UPPER, spec.legL.upper);
  const ankleL = pointAt(kneeL, LEG_LOWER, spec.legL.lower);
  const kneeR = pointAt(hipR, LEG_UPPER, spec.legR.upper);
  const ankleR = pointAt(kneeR, LEG_LOWER, spec.legR.lower);

  const phoneBase =
    spec.phone.anchor === 'both'
      ? {
          x: (wristL.x + wristR.x) / 2,
          y: (wristL.y + wristR.y) / 2,
        }
      : wristR;
  const phone = {
    x: phoneBase.x + spec.phone.dx,
    y: phoneBase.y + spec.phone.dy,
  };

  return {
    hip,
    shoulderMid,
    shoulderL,
    shoulderR,
    neck,
    head,
    elbowL,
    wristL,
    elbowR,
    wristR,
    kneeL,
    ankleL,
    kneeR,
    ankleR,
    phone,
    phoneRotation: spec.phone.rotation,
    lean: spec.lean,
    headTilt: spec.headTilt,
    torsoLength: spec.torsoLength,
    footL: spec.footL,
    footR: spec.footR,
  };
};

const lerpSkeleton = (
  from: SamSkeleton,
  to: SamSkeleton,
  progress: number,
): SamSkeleton => ({
  hip: lerpPoint(from.hip, to.hip, progress),
  shoulderMid: lerpPoint(from.shoulderMid, to.shoulderMid, progress),
  shoulderL: lerpPoint(from.shoulderL, to.shoulderL, progress),
  shoulderR: lerpPoint(from.shoulderR, to.shoulderR, progress),
  neck: lerpPoint(from.neck, to.neck, progress),
  head: lerpPoint(from.head, to.head, progress),
  elbowL: lerpPoint(from.elbowL, to.elbowL, progress),
  wristL: lerpPoint(from.wristL, to.wristL, progress),
  elbowR: lerpPoint(from.elbowR, to.elbowR, progress),
  wristR: lerpPoint(from.wristR, to.wristR, progress),
  kneeL: lerpPoint(from.kneeL, to.kneeL, progress),
  ankleL: lerpPoint(from.ankleL, to.ankleL, progress),
  kneeR: lerpPoint(from.kneeR, to.kneeR, progress),
  ankleR: lerpPoint(from.ankleR, to.ankleR, progress),
  phone: lerpPoint(from.phone, to.phone, progress),
  phoneRotation: lerp(from.phoneRotation, to.phoneRotation, progress),
  lean: lerp(from.lean, to.lean, progress),
  headTilt: lerp(from.headTilt, to.headTilt, progress),
  torsoLength: lerp(from.torsoLength, to.torsoLength, progress),
  footL: lerp(from.footL, to.footL, progress),
  footR: lerp(from.footR, to.footR, progress),
});

const standSpec = (): PoseSpec => ({
  hip: { x: 200, y: 452 },
  torsoLength: 218,
  lean: 0,
  headTilt: 0,
  armL: { upper: -18, lower: -12 },
  armR: { upper: 10, lower: 6 },
  legL: { upper: -4, lower: -1 },
  legR: { upper: 4, lower: 1 },
  footL: 0,
  footR: 0,
  phone: { anchor: 'right', dx: 6, dy: 32, rotation: 6 },
});

const raisePhoneSpec = (): PoseSpec => ({
  ...standSpec(),
  headTilt: 4,
  armR: { upper: 8, lower: 150 },
  phone: { anchor: 'right', dx: 14, dy: -30, rotation: -8 },
});

const takePhotoSpec = (): PoseSpec => ({
  ...standSpec(),
  lean: 2,
  headTilt: 0,
  armL: { upper: -20, lower: 80 },
  armR: { upper: 20, lower: 100 },
  phone: { anchor: 'right', dx: -2, dy: -36, rotation: -10 },
});

const lookAtScreenSpec = (): PoseSpec => ({
  ...standSpec(),
  lean: 1,
  headTilt: 10,
  armL: { upper: -35, lower: 55 },
  armR: { upper: 35, lower: -55 },
  phone: { anchor: 'both', dx: 0, dy: -38, rotation: -6 },
});

const kneelSpec = (): PoseSpec => ({
  hip: { x: 224, y: 570 },
  torsoLength: 225,
  lean: 10,
  headTilt: 8,
  armL: { upper: 20, lower: 10 },
  armR: { upper: 30, lower: -33 },
  legL: { upper: -5, lower: -80 },
  legR: { upper: 80, lower: 5 },
  footL: 180,
  footR: 0,
  phone: { anchor: 'right', dx: 4, dy: -26, rotation: 8 },
});

const walkSpec = (phase: number): PoseSpec => {
  const swing = Math.sin(phase * Math.PI * 2) * 24;
  const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 8;
  const bendL = 8 + Math.max(0, -swing) * 0.5;
  const bendR = 8 + Math.max(0, swing) * 0.5;
  return {
    hip: { x: 200, y: 452 - bob * 0.5 },
    torsoLength: 218,
    lean: 4,
    headTilt: -1,
    armL: { upper: -16 - swing * 0.55, lower: -12 - swing * 0.55 },
    armR: { upper: 8 + swing * 0.55, lower: 14 + swing * 0.55 },
    legL: { upper: swing, lower: swing + bendL },
    legR: { upper: -swing, lower: -swing + bendR },
    footL: swing > 0 ? -6 : 6,
    footR: swing > 0 ? 6 : -6,
    phone: { anchor: 'right', dx: 6, dy: 32, rotation: 6 },
  };
};

export type SamPose =
  | 'walk'
  | 'stop'
  | 'kneel'
  | 'raise-phone'
  | 'take-photo'
  | 'look-at-screen';

export type SamProps = {
  pose?: SamPose;
  progress?: number;
  frame?: number;
  fps?: number;
  width?: number;
  height?: number;
  animated?: boolean;
  enterAt?: number;
  /** Rendered inside the phone screen — pass a real app screenshot or any React node. */
  phoneScreen?: ReactNode;
  /** Convenience image URL for the phone screen (rendered with Remotion's Img). */
  phoneScreenSrc?: string;
  flash?: boolean;
  flip?: boolean;
  accent?: string;
  seed?: number;
  style?: CSSProperties;
  className?: string;
};

const SKIN = '#d8a47a';
const SKIN_SHADOW = '#b9825a';
const JACKET = palette.green;
const JACKET_BACK = palette.greenDeep;
const JACKET_DARK = palette.greenDark;
const SHIRT = palette.paper;
const TROUSERS = '#1d2b26';
const TROUSERS_BACK = '#16231f';
const SHOE = '#101a16';

const torsoPath = (hip: Point, torsoLength: number): string => {
  const shoulderY = hip.y - torsoLength;
  return [
    `M ${hip.x - 72} ${shoulderY}`,
    `C ${hip.x - 78} ${shoulderY + 80}, ${hip.x - 68} ${hip.y - 70}, ${
      hip.x - 58
    } ${hip.y}`,
    `Q ${hip.x} ${hip.y + 18}, ${hip.x + 58} ${hip.y}`,
    `C ${hip.x + 68} ${hip.y - 70}, ${hip.x + 78} ${shoulderY + 80}, ${
      hip.x + 72
    } ${shoulderY}`,
    `Q ${hip.x} ${shoulderY - 20}, ${hip.x - 72} ${shoulderY}`,
    'Z',
  ].join(' ');
};

const Shoe: React.FC<{ at: Point; angle: number; back?: boolean }> = ({
  at,
  angle,
  back = false,
}) => (
  <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
    <path
      d="M -18 -10 Q -23 7 -1 10 L 27 10 Q 36 10 34 1 Q 30 -7 18 -9 L -3 -11 Z"
      fill={back ? '#0c1411' : SHOE}
      stroke={palette.ink}
      strokeWidth={3}
      strokeLinejoin="round"
    />
    <path
      d="M -13 7 L 29 7"
      stroke={palette.paper}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.55}
    />
  </g>
);

const Limb: React.FC<{
  points: Point[];
  outer: number;
  inner: number;
  color: string;
}> = ({ points, outer, inner, color }) => {
  const [first, ...rest] = points;
  if (!first) {
    return null;
  }
  const d = [
    `M ${first.x} ${first.y}`,
    ...rest.map((point) => `L ${point.x} ${point.y}`),
  ].join(' ');
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={palette.ink}
        strokeWidth={outer}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={inner}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
};

const PhoneScreenFallback: React.FC<{ accent: string }> = ({ accent }) => (
  <>
    <rect x={-27} y={-54} width={54} height={108} rx={8} fill={palette.mint} />
    <rect
      x={-27}
      y={-54}
      width={54}
      height={22}
      rx={8}
      fill={palette.surface}
      opacity={0.94}
    />
    <circle cx={18} cy={-44} r={3} fill={palette.amber} />
    <rect
      x={-20}
      y={-46}
      width={23}
      height={4}
      rx={2}
      fill={palette.ink}
      opacity={0.78}
    />
    <rect
      x={-20}
      y={-26}
      width={40}
      height={27}
      rx={4}
      fill={palette.surface}
    />
    <rect
      x={-16}
      y={-22}
      width={18}
      height={3}
      rx={1.5}
      fill={palette.green}
      opacity={0.62}
    />
    <rect
      x={-16}
      y={-16}
      width={28}
      height={3}
      rx={1.5}
      fill={palette.green}
      opacity={0.3}
    />
    <circle cx={13} cy={-7} r={6} fill={accent} />
    <path
      d="M 10 -7 L 12.5 -4.5 L 16.5 -10"
      fill="none"
      stroke={palette.ink}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x={-20}
      y={7}
      width={40}
      height={4}
      rx={2}
      fill={palette.green}
      opacity={0.32}
    />
    <rect
      x={-20}
      y={15}
      width={30}
      height={4}
      rx={2}
      fill={palette.green}
      opacity={0.22}
    />
    <rect x={-20} y={27} width={40} height={13} rx={4} fill={palette.green} />
    <rect
      x={-12}
      y={32}
      width={24}
      height={3}
      rx={1.5}
      fill={palette.mint}
      opacity={0.9}
    />
  </>
);

export const Sam: React.FC<SamProps> = ({
  pose = 'stop',
  progress,
  frame: frameOverride,
  fps: fpsOverride,
  width = VIEW_W,
  height = VIEW_H,
  animated = true,
  enterAt = 0,
  phoneScreen,
  phoneScreenSrc,
  flash,
  flip = false,
  accent = palette.mint,
  seed = 0,
  style,
  className,
}) => {
  const currentFrame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const frame = frameOverride ?? currentFrame;
  const fps = fpsOverride ?? videoConfig.fps;

  const isWalk = pose === 'walk';
  const phase = progress ?? ((frame % 44) / 44);
  const action = clamp(
    progress ??
      (pose === 'stop'
        ? 1
        : spring({
            frame: Math.max(0, frame - enterAt - 4),
            fps,
            config: { damping: 14, stiffness: 90, mass: 1 },
          })),
  );

  const breath =
    isWalk || pose === 'kneel'
      ? 0
      : Math.sin((frame + seed * 31) / 24) * 1.1;

  const stand = buildSkeleton({
    ...standSpec(),
    torsoLength: standSpec().torsoLength + breath,
  });

  let skeleton: SamSkeleton;
  if (isWalk) {
    skeleton = buildSkeleton(walkSpec(phase));
  } else if (pose === 'stop') {
    skeleton = stand;
  } else if (pose === 'kneel') {
    skeleton = lerpSkeleton(stand, buildSkeleton(kneelSpec()), action);
  } else if (pose === 'raise-phone') {
    skeleton = lerpSkeleton(stand, buildSkeleton(raisePhoneSpec()), action);
  } else if (pose === 'take-photo') {
    skeleton = lerpSkeleton(stand, buildSkeleton(takePhotoSpec()), action);
  } else {
    skeleton = lerpSkeleton(stand, buildSkeleton(lookAtScreenSpec()), action);
  }

  const localFrame = frame - enterAt;
  const entrance = animated
    ? spring({
        frame: Math.max(0, localFrame),
        fps,
        config: { damping: 16, stiffness: 110, mass: 0.9 },
      })
    : 1;
  const enterOpacity = animated
    ? interpolate(localFrame, [0, 9], [0, 1], CLAMP)
    : 1;
  const scale = 0.94 + entrance * 0.06;
  const translateY = (1 - entrance) * 16;

  const flashAmount =
    flash === false
      ? 0
      : flash === true
        ? 1
        : pose === 'take-photo'
          ? clamp((action - 0.45) * 2.2)
          : 0;

  const hip = skeleton.hip;
  const shoulderY = hip.y - skeleton.torsoLength;
  const torso = torsoPath(hip, skeleton.torsoLength);
  const shirtTopY = shoulderY + 12;
  const shirtBottomY = shoulderY + 88;
  const pinX = hip.x - 38;
  const pinY = shoulderY + 56;

  const phoneScreenNode =
    phoneScreen ??
    (phoneScreenSrc ? (
      <Img
        src={phoneScreenSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top',
          display: 'block',
        }}
      />
    ) : (
      <PhoneScreenFallback accent={accent} />
    ));

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
      <ellipse
        cx={200}
        cy={GROUND + 2}
        rx={pose === 'kneel' ? 152 : 118}
        ry={18}
        fill={palette.ink}
        opacity={0.1}
      />

      <g
        style={{
          filter: 'drop-shadow(6px 8px 0 rgba(17, 34, 29, 0.10))',
        }}
      >
        {/* Back arm */}
        <Limb
          points={[skeleton.shoulderL, skeleton.elbowL, skeleton.wristL]}
          outer={40}
          inner={33}
          color={JACKET_BACK}
        />
        <ellipse
          cx={skeleton.elbowL.x}
          cy={skeleton.elbowL.y}
          rx={15}
          ry={12}
          fill={JACKET_BACK}
          stroke={palette.ink}
          strokeWidth={2.5}
          transform={`rotate(${
            (Math.atan2(
              skeleton.wristL.y - skeleton.elbowL.y,
              skeleton.wristL.x - skeleton.elbowL.x,
            ) *
              180) /
            Math.PI
          } ${skeleton.elbowL.x} ${skeleton.elbowL.y})`}
        />
        <circle
          cx={skeleton.wristL.x}
          cy={skeleton.wristL.y}
          r={17}
          fill={SKIN}
          stroke={palette.ink}
          strokeWidth={3.5}
        />

        {/* Legs */}
        <Limb
          points={[hip, skeleton.kneeL, skeleton.ankleL]}
          outer={39}
          inner={32}
          color={TROUSERS_BACK}
        />
        <circle
          cx={skeleton.kneeL.x}
          cy={skeleton.kneeL.y}
          r={17}
          fill={TROUSERS_BACK}
          stroke={palette.ink}
          strokeWidth={3}
        />
        <Shoe at={skeleton.ankleL} angle={skeleton.footL} back />

        <Limb
          points={[hip, skeleton.kneeR, skeleton.ankleR]}
          outer={39}
          inner={32}
          color={TROUSERS}
        />
        <circle
          cx={skeleton.kneeR.x}
          cy={skeleton.kneeR.y}
          r={17}
          fill={TROUSERS}
          stroke={palette.ink}
          strokeWidth={3}
        />
        <Shoe at={skeleton.ankleR} angle={skeleton.footR} />

        {/* Torso, shirt, belt, pockets */}
        <g transform={`rotate(${skeleton.lean} ${hip.x} ${hip.y})`}>
          <path
            d={torso}
            transform="translate(5 7)"
            fill={palette.ink}
            opacity={0.12}
          />
          <path
            d={torso}
            fill={JACKET}
            stroke={palette.ink}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />

          <path
            d={`M ${hip.x - 34} ${shirtTopY} L ${hip.x} ${shirtBottomY} L ${
              hip.x + 34
            } ${shirtTopY} Z`}
            fill={SHIRT}
            stroke={palette.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <path
            d={`M ${hip.x - 36} ${shirtTopY} L ${hip.x - 7} ${
              shirtTopY + 34
            } L ${hip.x - 2} ${shirtTopY + 10} Z`}
            fill={JACKET_DARK}
            stroke={palette.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <path
            d={`M ${hip.x + 36} ${shirtTopY} L ${hip.x + 7} ${
              shirtTopY + 34
            } L ${hip.x + 2} ${shirtTopY + 10} Z`}
            fill={JACKET_DARK}
            stroke={palette.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />

          <path
            d={`M ${hip.x} ${shirtBottomY + 2} L ${hip.x} ${hip.y - 12}`}
            stroke={palette.ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <rect
            x={hip.x - 3}
            y={hip.y - 30}
            width={6}
            height={12}
            rx={3}
            fill={palette.mint}
            stroke={palette.ink}
            strokeWidth={1.6}
          />

          <path
            d={`M ${hip.x - 66} ${shoulderY + 30} Q ${hip.x - 52} ${
              hip.y - 66
            } ${hip.x - 46} ${hip.y - 20}`}
            fill="none"
            stroke={JACKET_DARK}
            strokeWidth={2}
            opacity={0.55}
          />
          <path
            d={`M ${hip.x + 66} ${shoulderY + 30} Q ${hip.x + 52} ${
              hip.y - 66
            } ${hip.x + 46} ${hip.y - 20}`}
            fill="none"
            stroke={JACKET_DARK}
            strokeWidth={2}
            opacity={0.55}
          />

          <rect
            x={hip.x - 63}
            y={hip.y - 9}
            width={126}
            height={18}
            rx={4}
            fill="#0b1512"
            stroke={palette.ink}
            strokeWidth={2.5}
          />
          <rect
            x={hip.x - 10}
            y={hip.y - 6}
            width={20}
            height={12}
            rx={2}
            fill={palette.mint}
            stroke={palette.ink}
            strokeWidth={2}
          />

          {[-1, 1].map((side) => (
            <g key={side}>
              <rect
                x={hip.x + side * 42 - 21}
                y={hip.y - 72}
                width={42}
                height={28}
                rx={4}
                fill={palette.green600}
                stroke={palette.ink}
                strokeWidth={2.5}
              />
              <path
                d={`M ${hip.x + side * 42 - 21} ${hip.y - 64} L ${
                  hip.x + side * 42 + 21
                } ${hip.y - 64}`}
                stroke={palette.ink}
                strokeWidth={2}
                opacity={0.7}
              />
            </g>
          ))}

          <circle
            cx={pinX}
            cy={pinY}
            r={9}
            fill={JACKET_DARK}
            stroke={palette.mint}
            strokeWidth={2}
          />
          <path
            d={`M ${pinX - 4} ${pinY} L ${pinX - 1} ${pinY + 3} L ${
              pinX + 4
            } ${pinY - 3}`}
            fill="none"
            stroke={palette.mint}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Neck */}
        <path
          d={`M ${skeleton.shoulderMid.x} ${skeleton.shoulderMid.y} L ${
            skeleton.head.x
          } ${skeleton.head.y + 40}`}
          stroke={palette.ink}
          strokeWidth={36}
          strokeLinecap="round"
        />
        <path
          d={`M ${skeleton.shoulderMid.x} ${skeleton.shoulderMid.y} L ${
            skeleton.head.x
          } ${skeleton.head.y + 40}`}
          stroke={SKIN}
          strokeWidth={29}
          strokeLinecap="round"
        />
        <path
          d={`M ${skeleton.shoulderMid.x} ${skeleton.shoulderMid.y + 8} L ${
            skeleton.head.x
          } ${skeleton.head.y + 38}`}
          stroke={SKIN_SHADOW}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.35}
        />

        {/* Head */}
        <g
          transform={`rotate(${skeleton.lean + skeleton.headTilt} ${
            skeleton.head.x
          } ${skeleton.head.y})`}
        >
          <ellipse
            cx={skeleton.head.x + 4}
            cy={skeleton.head.y + 6}
            rx={50}
            ry={56}
            fill={palette.ink}
            opacity={0.12}
          />
          <ellipse
            cx={skeleton.head.x}
            cy={skeleton.head.y}
            rx={50}
            ry={56}
            fill={SKIN}
            stroke={palette.ink}
            strokeWidth={3.5}
          />
          <circle
            cx={skeleton.head.x + 48}
            cy={skeleton.head.y + 9}
            r={12}
            fill={SKIN}
            stroke={palette.ink}
            strokeWidth={3}
          />
          <path
            d={`M ${skeleton.head.x + 45} ${skeleton.head.y + 7} Q ${
              skeleton.head.x + 50
            } ${skeleton.head.y + 10} ${skeleton.head.x + 45} ${
              skeleton.head.y + 15
            }`}
            fill="none"
            stroke={SKIN_SHADOW}
            strokeWidth={2.4}
            strokeLinecap="round"
          />

          <path
            d={`M ${skeleton.head.x - 52} ${skeleton.head.y + 8}
                C ${skeleton.head.x - 58} ${skeleton.head.y - 48}, ${
              skeleton.head.x - 30
            } ${skeleton.head.y - 64}, ${skeleton.head.x} ${
              skeleton.head.y - 64
            }
                C ${skeleton.head.x + 34} ${skeleton.head.y - 64}, ${
              skeleton.head.x + 56
            } ${skeleton.head.y - 48}, ${skeleton.head.x + 52} ${
              skeleton.head.y + 6
            }
                L ${skeleton.head.x + 44} ${skeleton.head.y - 12}
                C ${skeleton.head.x + 38} ${skeleton.head.y - 36}, ${
              skeleton.head.x + 18
            } ${skeleton.head.y - 42}, ${skeleton.head.x - 2} ${
              skeleton.head.y - 35
            }
                C ${skeleton.head.x - 22} ${skeleton.head.y - 28}, ${
              skeleton.head.x - 38
            } ${skeleton.head.y - 16}, ${skeleton.head.x - 42} ${
              skeleton.head.y + 10
            }
                Z`}
            fill={palette.ink}
          />
          <path
            d={`M ${skeleton.head.x - 20} ${skeleton.head.y - 49} Q ${
              skeleton.head.x - 4
            } ${skeleton.head.y - 58} ${skeleton.head.x + 14} ${
              skeleton.head.y - 52
            }`}
            fill="none"
            stroke={palette.green600}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />

          <circle
            cx={skeleton.head.x - 18}
            cy={skeleton.head.y + 2}
            r={3.4}
            fill={palette.ink}
          />
          <circle
            cx={skeleton.head.x + 18}
            cy={skeleton.head.y + 2}
            r={3.4}
            fill={palette.ink}
          />
          <path
            d={`M ${skeleton.head.x - 28} ${skeleton.head.y - 12} Q ${
              skeleton.head.x - 18
            } ${skeleton.head.y - 17} ${skeleton.head.x - 8} ${
              skeleton.head.y - 12
            }`}
            fill="none"
            stroke={palette.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path
            d={`M ${skeleton.head.x + 8} ${skeleton.head.y - 12} Q ${
              skeleton.head.x + 18
            } ${skeleton.head.y - 17} ${skeleton.head.x + 28} ${
              skeleton.head.y - 12
            }`}
            fill="none"
            stroke={palette.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path
            d={`M ${skeleton.head.x - 2} ${skeleton.head.y + 12} L ${
              skeleton.head.x - 5
            } ${skeleton.head.y + 22} L ${skeleton.head.x + 3} ${
              skeleton.head.y + 23
            }`}
            fill="none"
            stroke={SKIN_SHADOW}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M ${skeleton.head.x - 9} ${skeleton.head.y + 36} Q ${
              skeleton.head.x
            } ${skeleton.head.y + 40} ${skeleton.head.x + 9} ${
              skeleton.head.y + 36
            }`}
            fill="none"
            stroke={palette.ink}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </g>

        {/* Front arm */}
        <Limb
          points={[skeleton.shoulderR, skeleton.elbowR, skeleton.wristR]}
          outer={40}
          inner={33}
          color={JACKET}
        />
        <ellipse
          cx={skeleton.elbowR.x}
          cy={skeleton.elbowR.y}
          rx={15}
          ry={12}
          fill={JACKET}
          stroke={palette.ink}
          strokeWidth={2.5}
          transform={`rotate(${
            (Math.atan2(
              skeleton.wristR.y - skeleton.elbowR.y,
              skeleton.wristR.x - skeleton.elbowR.x,
            ) *
              180) /
            Math.PI
          } ${skeleton.elbowR.x} ${skeleton.elbowR.y})`}
        />
        <path
          d={`M ${lerpPoint(skeleton.elbowR, skeleton.wristR, 0.78).x} ${
            lerpPoint(skeleton.elbowR, skeleton.wristR, 0.78).y
          } L ${skeleton.wristR.x} ${skeleton.wristR.y}`}
          stroke={palette.ink}
          strokeWidth={42}
          strokeLinecap="round"
        />
        <path
          d={`M ${lerpPoint(skeleton.elbowR, skeleton.wristR, 0.78).x} ${
            lerpPoint(skeleton.elbowR, skeleton.wristR, 0.78).y
          } L ${skeleton.wristR.x} ${skeleton.wristR.y}`}
          stroke={palette.mintSoft}
          strokeWidth={34}
          strokeLinecap="round"
        />
        <circle
          cx={skeleton.wristR.x}
          cy={skeleton.wristR.y}
          r={17}
          fill={SKIN}
          stroke={palette.ink}
          strokeWidth={3.5}
        />

        {/* Phone */}
        <g
          transform={`translate(${skeleton.phone.x} ${skeleton.phone.y}) rotate(${skeleton.phoneRotation})`}
        >
          <ellipse
            cx={0}
            cy={0}
            rx={46}
            ry={70}
            fill={accent}
            opacity={0.14}
          />
          <rect
            x={-34}
            y={-62}
            width={68}
            height={124}
            rx={16}
            fill={palette.ink}
          />
          <rect
            x={-30}
            y={-58}
            width={60}
            height={116}
            rx={12}
            fill="#0a1411"
            stroke={palette.ink}
            strokeWidth={2.5}
          />
          <rect
            x={-27}
            y={-54}
            width={54}
            height={108}
            rx={8}
            fill={palette.mint}
          />
          <foreignObject
            x={-27}
            y={-54}
            width={54}
            height={108}
            style={{ borderRadius: 8, overflow: 'hidden' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: 8,
                backgroundColor: palette.mint,
              }}
            >
              {phoneScreenNode}
            </div>
          </foreignObject>
          <rect
            x={-27}
            y={-54}
            width={54}
            height={108}
            rx={8}
            fill="none"
            stroke={palette.ink}
            strokeWidth={1.8}
          />
          <rect
            x={-9}
            y={-51}
            width={18}
            height={3.5}
            rx={1.75}
            fill={palette.ink}
            opacity={0.55}
          />
          <circle cx={0} cy={58} r={2.5} fill={palette.mint} opacity={0.8} />
          <path
            d="M -20 -46 L 20 12"
            stroke={palette.white}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.1}
          />
        </g>

        {flashAmount > 0 ? (
          <g
            transform={`translate(${skeleton.phone.x} ${
              skeleton.phone.y - 76
            })`}
            opacity={flashAmount}
          >
            <circle r={26} fill={palette.amberSoft} opacity={0.9} />
            <circle r={12} fill={palette.white} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
              const inner = pointAt({ x: 0, y: 0 }, 18, angle);
              const outer = pointAt({ x: 0, y: 0 }, 36, angle);
              return (
                <line
                  key={angle}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={palette.amber}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}
          </g>
        ) : null}
      </g>
    </svg>
  );
};
