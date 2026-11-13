import React from 'react';
import type { CSSProperties } from 'react';
import { palette } from '../../theme';
import {
  Contractor,
  Inspector,
  Neighbor,
  StickFigure as CharacterStick,
} from '../../characters';
import type { SamPose as CharacterSamPose } from '../../characters/Sam';
import { Sam as CharacterSam } from '../../characters/Sam';
import { StickFigure as PaperStickFigure } from './PaperCast';

export type SamPose = 'walk' | 'phone' | 'point' | 'cheer' | 'inspect' | 'stand' | 'wave';

type SamProps = {
  pose?: SamPose;
  scale?: number;
  flip?: boolean;
  phoneGlow?: number;
  seed?: number;
  style?: CSSProperties;
  label?: string;
};

const samPoseMap: Record<SamPose, CharacterSamPose> = {
  walk: 'walk',
  phone: 'look-at-screen',
  point: 'stop',
  cheer: 'raise-phone',
  inspect: 'kneel',
  stand: 'stop',
  wave: 'stop',
};

/**
 * Adapter around the v2 character system's paper-cut Sam. Keeps the compact
 * 240 x 456 footprint used by the scene layouts while delegating the actual
 * skeleton, phone and paper layers to `src/characters/Sam`.
 */
export const Sam: React.FC<SamProps> = ({
  pose = 'walk',
  scale = 1,
  flip = false,
  phoneGlow = 0,
  seed = 0,
  style,
  label,
}) => {
  const width = 240 * scale;
  const height = 456 * scale;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        ...style,
      }}
      aria-label={label ?? 'Sam'}
    >
      <CharacterSam
        pose={samPoseMap[pose]}
        width={width}
        height={height}
        flip={flip}
        seed={seed}
        flash={false}
        accent={phoneGlow > 0.2 ? palette.amber : palette.mint}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
};

export type StickRole =
  | 'neighbor'
  | 'steward'
  | 'contractor'
  | 'inspector'
  | 'bidder'
  | 'council'
  | 'cyclist'
  | 'resident';

type StickFigureProps = {
  role?: StickRole;
  pose?: 'stand' | 'walk' | 'wave' | 'point' | 'clipboard' | 'vote' | 'cheer' | 'ride';
  scale?: number;
  flip?: boolean;
  accent?: string;
  seed?: number;
  style?: CSSProperties;
  label?: string;
};

const roleAccent: Record<StickRole, string> = {
  neighbor: palette.amber,
  steward: palette.green,
  contractor: palette.amber,
  inspector: palette.blue,
  bidder: palette.red,
  council: palette.green,
  cyclist: palette.mint,
  resident: palette.blue,
};

/**
 * Adapter around the v2 stick-figure cast. The cyclist keeps the paper-cut
 * bicycle from the v2 supporting cast; everyone else uses the character
 * system's jointed ink-line figures.
 */
export const StickFigure: React.FC<StickFigureProps> = ({
  role = 'neighbor',
  pose = 'stand',
  scale = 1,
  flip = false,
  accent,
  seed = 0,
  style,
  label,
}) => {
  const width = 240 * scale;
  const height = 414 * scale;
  const color = accent ?? roleAccent[role];
  if (role === 'cyclist') {
    return (
      <PaperStickFigure
        role="cyclist"
        pose="ride"
        scale={scale}
        flip={flip}
        accent={color}
        seed={seed}
        style={style}
        label={label}
      />
    );
  }

  const common = {
    width,
    height,
    flip,
    colorTag: color,
    style: { position: 'absolute' as const, inset: 0 },
  };

  let figure: React.ReactNode;
  if (role === 'contractor') {
    figure = (
      <Contractor
        {...common}
        pose={pose === 'walk' ? 'walk' : 'stand'}
        showWrench
      />
    );
  } else if (role === 'inspector') {
    figure = (
      <Inspector
        {...common}
        pose={pose === 'walk' ? 'walk' : 'hold-clipboard'}
        stamp
      />
    );
  } else if (role === 'neighbor') {
    if (pose === 'wave' || pose === 'cheer') {
      figure = (
        <CharacterStick
          {...common}
          pose="stand"
          accessory="phone"
          armAngles={pose === 'cheer' ? { left: 150, right: 150 } : { right: 150 }}
          tagLabel="NBR"
          seed={seed}
        />
      );
    } else if (pose === 'clipboard') {
      figure = (
        <CharacterStick
          {...common}
          pose="hold-clipboard"
          accessory="clipboard"
          tagLabel="NBR"
          seed={seed}
        />
      );
    } else {
      figure = (
        <Neighbor
          {...common}
          pose={pose === 'walk' ? 'walk' : 'hold-phone'}
          enterAt={0}
        />
      );
    }
  } else if (role === 'steward') {
    figure = (
      <CharacterStick
        {...common}
        pose="hold-clipboard"
        accessory="clipboard"
        tagLabel="STW"
        seed={seed}
      />
    );
  } else if (role === 'bidder') {
    figure = (
      <CharacterStick
        {...common}
        pose="hold-envelope"
        accessory="envelope"
        tagLabel="BID"
        seed={seed}
      />
    );
  } else if (role === 'council') {
    figure = (
      <CharacterStick
        {...common}
        pose="raise-card"
        accessory="card"
        cardLabel="YES"
        tagLabel="VOTE"
        seed={seed}
      />
    );
  } else {
    figure = (
      <CharacterStick
        {...common}
        pose="stand"
        tagLabel="RES"
        seed={seed}
      />
    );
  }

  return (
    <div
      style={{ position: 'absolute', width, height, ...style }}
      aria-label={label ?? role}
    >
      {figure}
    </div>
  );
};
