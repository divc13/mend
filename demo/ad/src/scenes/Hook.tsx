import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { AssetVideo } from '../components/Asset';
import { Caption } from '../components/Caption';
import { ChapterMark } from '../components/LowerThird';
import { Chip } from '../components/Chip';
import { LowerThird } from '../components/LowerThird';
import { RoadPlate } from '../components/RoadPlate';
import { CLAMP, fadeIn, fadeOut, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const HeadlineBeat: React.FC<{
  from: number;
  to: number;
  children: React.ReactNode;
}> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const incoming = fadeIn(frame, from, 20);
  const outgoing = fadeOut(frame, to - 10, 10);
  const opacity = Math.min(incoming, outgoing);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `translateY(${(1 - incoming) * 30}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Hook: React.FC<SceneProps> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const push = interpolate(frame, [0, durationInFrames], [1.02, 1.1], CLAMP);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.greenDark, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AssetVideo
          assetKey="pothole"
          placeholder={<RoadPlate variant="pothole" showCyclist label />}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 18, 14, 0.92) 0%, rgba(5, 18, 14, 0.72) 38%, rgba(5, 18, 14, 0.18) 72%, rgba(5, 18, 14, 0.42) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(0deg, rgba(5, 18, 14, 0.72) 0%, transparent 34%, transparent 78%, rgba(5, 18, 14, 0.3) 100%)',
        }}
      />
      <ChapterMark chapter={scene.chapter} tone="dark" />

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 238,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: fadeIn(frame, 10, 20),
        }}
      >
        <Chip tone="dark" size="md" icon="map">
          A MEND STORY
        </Chip>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 16,
            letterSpacing: '0.16em',
            color: 'rgba(245, 241, 230, 0.5)',
          }}
        >
          ONE STREET · ONE REPAIR
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 318,
          width: 1080,
          height: 430,
        }}
      >
        <HeadlineBeat from={at(0.7)} to={at(7)}>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 108,
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: palette.paper,
              textShadow: '0 18px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            Every neighborhood
            <br />
            has one.
          </div>
        </HeadlineBeat>
        <HeadlineBeat from={at(7)} to={at(13.2)}>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 0.96,
              letterSpacing: '-0.035em',
              color: palette.paper,
              textShadow: '0 18px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            A pothole
            <br />
            everyone avoids.
          </div>
        </HeadlineBeat>
        <HeadlineBeat from={at(13.2)} to={at(20)}>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 108,
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: palette.paper,
              textShadow: '0 18px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            Nobody owns it.
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: fonts.display,
              fontSize: 46,
              fontStyle: 'italic',
              fontWeight: 500,
              color: palette.mint,
            }}
          >
            Until this morning.
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: fonts.body,
              fontSize: 25,
              color: 'rgba(245, 241, 230, 0.7)',
            }}
          >
            Sam decides to change that.
          </div>
        </HeadlineBeat>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 110,
          top: 456,
          width: 336,
          padding: '22px 24px',
          borderRadius: 18,
          backgroundColor: 'rgba(7, 27, 21, 0.78)',
          border: '1px solid rgba(169, 103, 18, 0.38)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.26)',
          opacity: fadeIn(frame, at(8.5), 24),
          transform: `translateY(${(1 - fadeIn(frame, at(8.5), 24)) * 20}px)`,
        }}
      >
        <Chip tone="amber" size="sm" icon="alert">
          Still open
        </Chip>
        <div
          style={{
            marginTop: 14,
            fontFamily: fonts.display,
            fontSize: 31,
            lineHeight: 1.08,
            color: palette.paper,
          }}
        >
          Months, not days.
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: fonts.body,
            fontSize: 17,
            lineHeight: 1.45,
            color: 'rgba(245, 241, 230, 0.62)',
          }}
        >
          No owner. No record. No way to hold the fix.
        </div>
      </div>

      <LowerThird
        kicker="SAM"
        title="Neighbor"
        subtitle="Reports the pothole"
        tone="dark"
        delay={at(14)}
        style={{ left: 120, bottom: 188 }}
      />

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
