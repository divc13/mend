import React from 'react';
import type { CSSProperties } from 'react';
import { useId } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts, palette } from '../theme';

export type ArchNodeTone = 'paper' | 'green' | 'mint' | 'amber' | 'ghost';

export type ArchNode = {
  id: string;
  eyebrow: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: ArchNodeTone;
};

export type ArchEdge = {
  from: string;
  to: string;
  dashed?: boolean;
  label?: string;
};

type ArchitectureProps = {
  nodes: ArchNode[];
  edges: ArchEdge[];
  width: number;
  height: number;
  revealAt?: number;
  background?: string;
  style?: CSSProperties;
};

const toneStyles: Record<
  ArchNodeTone,
  { background: string; border: string; color: string; eyebrow: string }
> = {
  paper: {
    background: palette.surface,
    border: palette.line,
    color: palette.ink,
    eyebrow: palette.amber,
  },
  green: {
    background: palette.green,
    border: 'rgba(143, 211, 180, 0.45)',
    color: palette.paper,
    eyebrow: palette.mint,
  },
  mint: {
    background: palette.mintSoft,
    border: palette.mint,
    color: palette.green,
    eyebrow: palette.green,
  },
  amber: {
    background: palette.amberSoft,
    border: 'rgba(169, 103, 18, 0.4)',
    color: palette.amberStrong,
    eyebrow: palette.amberStrong,
  },
  ghost: {
    background: 'rgba(255, 255, 255, 0.045)',
    border: 'rgba(255, 255, 255, 0.14)',
    color: palette.paper,
    eyebrow: palette.mint,
  },
};

export const Architecture: React.FC<ArchitectureProps> = ({
  nodes,
  edges,
  width,
  height,
  revealAt = 0,
  background = palette.greenDark,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uid = useId().replaceAll(':', '');
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div style={{ position: 'relative', width, height, ...style }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id={`${uid}-dot`}
            viewBox="0 0 8 8"
            refX="4"
            refY="4"
            markerWidth="6"
            markerHeight="6"
          >
            <circle cx="4" cy="4" r="3" fill={palette.mint} />
          </marker>
        </defs>
        {edges.map((edge, index) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) {
            return null;
          }
          const fromCx = from.x + from.w / 2;
          const fromCy = from.y + from.h / 2;
          const toCx = to.x + to.w / 2;
          const toCy = to.y + to.h / 2;
          const dx = toCx - fromCx;
          const dy = toCy - fromCy;
          const horizontal = Math.abs(dx) >= Math.abs(dy);
          const x1 = horizontal
            ? fromCx + Math.sign(dx) * (from.w / 2)
            : fromCx;
          const y1 = horizontal
            ? fromCy
            : fromCy + Math.sign(dy) * (from.h / 2);
          const x2 = horizontal ? toCx - Math.sign(dx) * (to.w / 2) : toCx;
          const y2 = horizontal ? toCy : toCy - Math.sign(dy) * (to.h / 2);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const path = horizontal
            ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
          const progress = spring({
            frame: Math.max(0, frame - revealAt - 10 - index * 3),
            fps,
            config: { damping: 200, stiffness: 90, mass: 0.9 },
          });
          return (
            <g key={`${edge.from}-${edge.to}-${index}`} opacity={progress}>
              <path
                d={path}
                fill="none"
                stroke={edge.dashed ? 'rgba(143, 211, 180, 0.38)' : 'rgba(143, 211, 180, 0.6)'}
                strokeWidth={edge.dashed ? 2 : 2.4}
                strokeDasharray={edge.dashed ? '5 8' : undefined}
                markerEnd={`url(#${uid}-dot)`}
              />
              {edge.label ? (
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill="rgba(245, 241, 230, 0.56)"
                  stroke={background}
                  strokeWidth={6}
                  paintOrder="stroke"
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodes.map((node, index) => {
        const tone = toneStyles[node.tone ?? 'ghost'];
        const progress = spring({
          frame: Math.max(0, frame - revealAt - index * 4),
          fps,
          config: { damping: 200, stiffness: 110, mass: 0.9 },
        });
        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: node.w,
              height: node.h,
              borderRadius: 20,
              padding: '16px 20px',
              backgroundColor: tone.background,
              border: `1px solid ${tone.border}`,
              color: tone.color,
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.18)',
              opacity: progress,
              transform: `translateY(${(1 - progress) * 18}px) scale(${0.97 + progress * 0.03})`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: tone.eyebrow,
              }}
            >
              {node.eyebrow}
            </span>
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: node.h > 110 ? 30 : 26,
                fontWeight: 600,
                lineHeight: 1.05,
              }}
            >
              {node.label}
            </span>
            {node.sublabel ? (
              <span
                style={{
                  fontFamily: fonts.body,
                  fontSize: 15,
                  lineHeight: 1.3,
                  opacity: 0.72,
                }}
              >
                {node.sublabel}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
