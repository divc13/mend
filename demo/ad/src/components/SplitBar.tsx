import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, EASE_OUT } from '../motion';
import { fonts, palette } from '../theme';

export type SplitSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
  startFrame: number;
  textColor?: string;
};

type SplitBarProps = {
  segments: SplitSegment[];
  total: number;
  height?: number;
  showLabels?: boolean;
  style?: CSSProperties;
};

export const SplitBar: React.FC<SplitBarProps> = ({
  segments,
  total,
  height = 104,
  showLabels = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const safeTotal = Math.max(1, total);
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: palette.paperDeep,
        border: `1px solid ${palette.line}`,
        boxShadow: 'inset 0 2px 8px rgba(17, 34, 29, 0.08)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {segments.map((segment) => (
          <div
            key={`ghost-${segment.id}`}
            style={{
              width: `${(segment.value / safeTotal) * 100}%`,
              backgroundColor: segment.color,
              opacity: 0.1,
              borderRight: `2px solid ${palette.surface}`,
            }}
          />
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {segments.map((segment) => {
          const progress = interpolate(
            frame,
            [segment.startFrame, segment.startFrame + 42],
            [0, 1],
            { ...CLAMP, easing: EASE_OUT },
          );
          const width = (segment.value / safeTotal) * progress * 100;
          const wideEnough = (segment.value / safeTotal) * 100 > 7;
          return (
            <div
              key={segment.id}
              style={{
                width: `${width}%`,
                backgroundColor: segment.color,
                borderRight: width > 0 ? `2px solid ${palette.surface}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: progress,
              }}
            >
              {showLabels && wideEnough ? (
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: segment.textColor ?? palette.paper,
                    whiteSpace: 'nowrap',
                    opacity: progress,
                  }}
                >
                  {segment.value}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 42%, rgba(0, 0, 0, 0.08))',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
