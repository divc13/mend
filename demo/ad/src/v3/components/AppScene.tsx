import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Logo } from '../../components/Logo';
import { fonts, palette } from '../../theme';
import { liveMedia, mediaAt } from '../../v2/lib/assets';
import type { SceneId } from '../../v2/lib/script';
import { FPS, type V3Scene } from '../lib/script';

export type LiveSceneConfig = {
  sceneId: Exclude<V3Scene['id'], 'close'>;
  asset: string;
  /** Seconds into the source clip where populated app content begins. */
  sourceStart?: number;
  playbackRate?: number;
  zoom?: number;
  offsetY?: number;
  origin?: string;
  chapter: string;
  headline: string;
  sub: string;
  metric: string;
  opening?: { title: string; sub: string; until: number };
};

const panelHeight = (sceneId: V3Scene['id']): number => (sceneId === 'tech' ? 238 : 202);
const TOP_BAND = 104;

const TopBar: React.FC<{ config: LiveSceneConfig; index: number }> = ({ config, index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = 0.65 + Math.sin(frame / 9) * 0.35;
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: 3,
          width: `${progress * 100}%`,
          backgroundColor: palette.mint,
          zIndex: 31,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: TOP_BAND,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 46px',
          background: '#071b15',
          borderBottom: '1px solid rgba(143,211,180,0.22)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo size={38} tone="dark" />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: palette.mint,
              borderLeft: `1px solid rgba(143,211,180,0.45)`,
              paddingLeft: 14,
            }}
          >
            PRODUCT TOUR · REPLAY DATA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: palette.paper,
              background: 'rgba(7,27,21,0.66)',
              border: '1px solid rgba(245,241,230,0.22)',
              borderRadius: 999,
              padding: '8px 13px',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: '#e4674d',
                opacity: pulse,
              }}
            />
            REPLAY DATA · REAL APP
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'rgba(245,241,230,0.74)',
            }}
          >
            {String(index).padStart(2, '0')}/08
          </span>
        </div>
      </div>
    </>
  );
};

const StackChip: React.FC<{ name: string; active: boolean; index: number }> = ({
  name,
  active,
  index,
}) => {
  const frame = useCurrentFrame();
  const enter = spring({
    frame: Math.max(0, frame - index * 2),
    fps: 30,
    config: { damping: 200, stiffness: 130 },
  });
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? palette.green : palette.line}`,
        backgroundColor: active ? palette.green : 'rgba(255,253,248,0.7)',
        color: active ? palette.paper : palette.muted,
        fontFamily: fonts.mono,
        fontSize: 10,
        lineHeight: 1,
        letterSpacing: '0.04em',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 6}px)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          backgroundColor: active ? palette.mint : palette.line,
        }}
      />
      {name}
    </span>
  );
};

const BottomPanel: React.FC<{
  scene: V3Scene;
  config: LiveSceneConfig;
}> = ({ scene, config }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const activeIndex = Math.min(
    scene.stack.length - 1,
    Math.floor(progress * scene.stack.length),
  );
  const active = scene.stack[activeIndex] ?? scene.stack[0];
  const enter = spring({
    frame,
    fps: 30,
    config: { damping: 200, stiffness: 100 },
  });
  const height = panelHeight(scene.id);
  const openingActive = Boolean(config.opening) && frame < (config.opening?.until ?? 0) * 30;
  const headline = openingActive ? config.opening!.title : config.headline;
  const subline = openingActive ? config.opening!.sub : config.sub;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        display: 'flex',
        backgroundColor: palette.paper,
        borderTop: `4px solid ${palette.mint}`,
        boxShadow: '0 -24px 70px rgba(7,27,21,0.22)',
        zIndex: 25,
        transform: `translateY(${(1 - enter) * 26}px)`,
        opacity: enter,
      }}
    >
      <div
        style={{
          width: 760,
          padding: '22px 34px 18px 46px',
          borderRight: `1px solid ${palette.line}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: '0.18em',
              color: palette.amberStrong,
            }}
          >
            STACK IN PLAY
          </span>
          <span
            style={{
              width: 28,
              height: 1,
              backgroundColor: palette.amber,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: '0.08em',
              color: palette.muted,
            }}
          >
            {activeIndex + 1}/{scene.stack.length}
          </span>
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: scene.id === 'tech' ? 34 : 38,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: palette.ink,
          }}
        >
          {active.name}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            lineHeight: 1.32,
            color: palette.inkSoft,
          }}
        >
          {active.purpose}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 2,
          }}
        >
          {scene.stack.map((item, index) => (
            <StackChip key={item.name} name={item.name} active={index === activeIndex} index={index} />
          ))}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: '20px 46px 18px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 22 }}>
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.16em',
                color: palette.amberStrong,
                marginBottom: 7,
              }}
            >
              {config.chapter}
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: scene.id === 'tech' ? 40 : 45,
                lineHeight: 0.98,
                letterSpacing: '-0.035em',
                color: palette.ink,
              }}
            >
              {headline}
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              marginTop: 22,
              padding: '9px 13px',
              borderRadius: 4,
              backgroundColor: palette.green,
              color: palette.paper,
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              maxWidth: 330,
            }}
          >
            {config.metric}
          </div>
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 20,
            lineHeight: 1.3,
            color: palette.muted,
            maxWidth: 920,
          }}
        >
          {subline}
        </div>
      </div>
    </div>
  );
};

export const AppScene: React.FC<{ scene: V3Scene; config: LiveSceneConfig; index: number }> = ({
  scene,
  config,
  index,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const media = mediaAt(config.asset) ?? liveMedia(config.sceneId as SceneId);
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const baseZoom = config.zoom ?? 1.035;
  const zoom = baseZoom + progress * 0.03;
  const sourceStartFrame = Math.round((config.sourceStart ?? 0) * FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.greenDeep }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${TOP_BAND}px 0 0 0)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateY(${config.offsetY ?? 0}px) scale(${zoom})`,
            transformOrigin: config.origin ?? '50% 40%',
          }}
        >
          {media ? (
            media.kind === 'video' ? (
              <OffthreadVideo
                src={media.src}
                muted
                startFrom={sourceStartFrame}
                playbackRate={config.playbackRate ?? 1}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Img
                src={media.src}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )
          ) : (
            <AbsoluteFill
              style={{
                background: `linear-gradient(145deg, ${palette.greenDeep}, ${palette.green})`,
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(7,27,21,0.9) 0%, rgba(7,27,21,0.46) 7%, transparent 19%, transparent 64%, rgba(7,27,21,0.62) 84%, rgba(7,27,21,0.93) 100%)',
        }}
      />
      <TopBar config={config} index={index} />
      <BottomPanel scene={scene} config={config} />
    </AbsoluteFill>
  );
};
