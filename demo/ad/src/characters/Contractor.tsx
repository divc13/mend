import React from 'react';
import type { CSSProperties } from 'react';
import { palette } from '../theme';
import { StickFigure } from './StickFigure';
import type { StickPose } from './StickFigure';

export type ContractorProps = {
  pose?: Extract<StickPose, 'stand' | 'walk' | 'kneel'>;
  width?: number;
  height?: number;
  flip?: boolean;
  frame?: number;
  fps?: number;
  animated?: boolean;
  enterAt?: number;
  colorTag?: string;
  showWrench?: boolean;
  style?: CSSProperties;
  className?: string;
};

export const Contractor: React.FC<ContractorProps> = ({
  pose = 'stand',
  width,
  height,
  flip,
  frame,
  fps,
  animated,
  enterAt,
  colorTag = palette.amber,
  showWrench = true,
  style,
  className,
}) => (
  <StickFigure
    pose={pose}
    accessory={showWrench ? 'wrench' : null}
    width={width}
    height={height}
    flip={flip}
    frame={frame}
    fps={fps}
    animated={animated}
    enterAt={enterAt}
    colorTag={colorTag}
    tagLabel="CREW"
    hardHat
    style={style}
    className={className}
  />
);
