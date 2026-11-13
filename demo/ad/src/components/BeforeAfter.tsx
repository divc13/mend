import React from 'react';
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AssetImage } from './Asset';
import { RoadPlate } from './RoadPlate';
import { CLAMP, EASE_IN_OUT } from '../motion';
import { fonts, palette } from '../theme';

type BeforeAfterProps = {
  width?: number;
  height?: number;
  delay?: number;
  style?: CSSProperties;
};

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  width = 820,
  height = 520,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 54], [0.08, 0.56], {
    ...CLAMP,
    easing: EASE_IN_OUT,
  });
  const divider = progress * 100;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 26,
        overflow: 'hidden',
        border: `1px solid rgba(245, 241, 230, 0.22)`,
        boxShadow: '0 34px 90px rgba(0, 0, 0, 0.38)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <AssetImage
          assetKey="potholePhoto"
          alt="Before repair"
          placeholder={<RoadPlate variant="pothole" label={false} />}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 ${100 - divider}% 0 0)`,
        }}
      >
        <AssetImage
          assetKey="afterPhoto"
          alt="After repair"
          placeholder={<RoadPlate variant="repair" label={false} />}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${divider}%`,
          width: 3,
          backgroundColor: palette.mint,
          boxShadow: `0 0 18px rgba(143, 211, 180, 0.7)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${divider}%`,
          transform: 'translate(-50%, -50%)',
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: palette.paper,
          border: `2px solid ${palette.mint}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 26px rgba(0, 0, 0, 0.3)',
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 18,
            color: palette.green,
            letterSpacing: '-0.12em',
          }}
        >
          ‹›
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 18,
          padding: '7px 12px',
          borderRadius: 8,
          backgroundColor: 'rgba(7, 27, 21, 0.72)',
          border: '1px solid rgba(245, 241, 230, 0.2)',
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: '0.14em',
          color: palette.paper,
        }}
      >
        BEFORE
      </div>
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          padding: '7px 12px',
          borderRadius: 8,
          backgroundColor: palette.mint,
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: '0.14em',
          color: palette.greenDeep,
        }}
      >
        AFTER
      </div>
    </div>
  );
};
