import React from 'react';
import type { CSSProperties } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../motion';

type KineticNumberProps = {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: CSSProperties;
};

const formatter = (decimals: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const KineticNumber: React.FC<KineticNumberProps> = ({
  value,
  from = 0,
  delay = 0,
  duration = 42,
  decimals = 0,
  prefix = '',
  suffix = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + duration], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const current = from + (value - from) * progress;
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum"',
        ...style,
      }}
    >
      {prefix}
      {formatter(decimals).format(current)}
      {suffix}
    </span>
  );
};
