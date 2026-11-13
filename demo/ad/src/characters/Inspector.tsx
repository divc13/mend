import React from 'react';
import type { CSSProperties } from 'react';
import { palette } from '../theme';
import { StickFigure } from './StickFigure';
import type { StickPose } from './StickFigure';

export type InspectorProps = {
  pose?: Extract<StickPose, 'hold-clipboard' | 'stand' | 'walk'>;
  width?: number;
  height?: number;
  flip?: boolean;
  frame?: number;
  fps?: number;
  animated?: boolean;
  enterAt?: number;
  colorTag?: string;
  stamp?: boolean;
  style?: CSSProperties;
  className?: string;
};

export const Inspector: React.FC<InspectorProps> = ({
  pose = 'hold-clipboard',
  width,
  height,
  flip,
  frame,
  fps,
  animated,
  enterAt,
  colorTag = palette.blue,
  stamp = true,
  style,
  className,
}) => (
  <StickFigure
    pose={pose}
    accessory="clipboard"
    accessorySide={pose === 'hold-clipboard' ? 'left' : 'right'}
    width={width}
    height={height}
    flip={flip}
    frame={frame}
    fps={fps}
    animated={animated}
    enterAt={enterAt}
    colorTag={colorTag}
    tagLabel="QA"
    glasses
    stamp={stamp}
    style={style}
    className={className}
  />
);
