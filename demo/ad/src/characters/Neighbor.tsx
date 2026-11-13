import React from 'react';
import type { CSSProperties } from 'react';
import { palette } from '../theme';
import { StickFigure } from './StickFigure';
import type { StickPose } from './StickFigure';

export type NeighborProps = {
  pose?: Extract<StickPose, 'stand' | 'walk' | 'hold-phone'>;
  width?: number;
  height?: number;
  flip?: boolean;
  frame?: number;
  fps?: number;
  animated?: boolean;
  enterAt?: number;
  colorTag?: string;
  style?: CSSProperties;
  className?: string;
};

export const Neighbor: React.FC<NeighborProps> = ({
  pose = 'hold-phone',
  width,
  height,
  flip,
  frame,
  fps,
  animated,
  enterAt,
  colorTag = palette.mint,
  style,
  className,
}) => (
  <StickFigure
    pose={pose}
    accessory={pose === 'hold-phone' ? 'phone' : null}
    width={width}
    height={height}
    flip={flip}
    frame={frame}
    fps={fps}
    animated={animated}
    enterAt={enterAt}
    colorTag={colorTag}
    tagLabel="NBR"
    style={style}
    className={className}
  />
);
