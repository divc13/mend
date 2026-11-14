import React from 'react';
import {
  AbsoluteFill,
  Easing,
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
import { FPS, type V3Scene, v3Script } from '../lib/script';

export type CameraKeyframe = {
  /** Scene-local seconds. */
  at: number;
  scale: number;
  x?: number;
  y?: number;
};

export type LiveSceneConfig = {
  sceneId: Exclude<V3Scene['id'], 'close'>;
  asset: string;
  /** Seconds into the source clip where populated app content begins. */
  sourceStart?: number;
  playbackRate?: number;
  offsetY?: number;
  origin?: string;
  /** Config-driven punch-ins. The first keyframe is the resting frame. */
  camera?: CameraKeyframe[];
  /** Keep the stack hidden until the hook has earned it (scene-local seconds). */
  stackRevealAt?: number;
  hookStrip?: boolean;
  chapter: string;
  headline: string;
  sub: string;
  metric: string;
  opening?: { title: string; sub: string; until: number };
};

const TOP_BAND = 104;

const panelHeight = (sceneId: V3Scene['id']): number => (sceneId === 'tech' ? 276 : 202);

const cameraAt = (
  seconds: number,
  keys: CameraKeyframe[] | undefined,
): { scale: number; x: number; y: number } => {
  const fallback: CameraKeyframe = { at: 0, scale: 1.035, x: 0, y: 0 };
  const list = keys && keys.length > 0 ? keys : [fallback];
  const first = list[0];
  if (seconds <= first.at) {
    return { scale: first.scale, x: first.x ?? 0, y: first.y ?? 0 };
  }
  let previous = first;
  let next: CameraKeyframe | undefined;
  for (const key of list) {
    if (key.at <= seconds) {
      previous = key;
    } else {
      next = key;
      break;
    }
  }
  if (!next) {
    return { scale: previous.scale, x: previous.x ?? 0, y: previous.y ?? 0 };
  }
  const span = Math.max(0.001, next.at - previous.at);
  const raw = Math.min(1, Math.max(0, (seconds - previous.at) / span));
  const eased = Easing.bezier(0.42, 0, 0.18, 1)(raw);
  return {
    scale: previous.scale + (next.scale - previous.scale) * eased,
    x: (previous.x ?? 0) + ((next.x ?? 0) - (previous.x ?? 0)) * eased,
    y: (previous.y ?? 0) + ((next.y ?? 0) - (previous.y ?? 0)) * eased,
  };
};

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
              borderLeft: '1px solid rgba(143,211,180,0.45)',
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
        fontSize: 11,
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

const HookStrip: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: palette.amberStrong,
        }}
      >
        BEFORE THE STACK
      </span>
      <span style={{ width: 28, height: 1, backgroundColor: palette.amber, display: 'inline-block' }} />
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: '0.08em',
          color: palette.muted,
        }}
      >
        HUMAN STORY FIRST
      </span>
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 29,
        lineHeight: 1.06,
        letterSpacing: '-0.025em',
        color: palette.ink,
      }}
    >
      No wallet · No forms · <span style={{ color: palette.green }}>Private by default.</span>
    </div>
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: 16,
        lineHeight: 1.35,
        color: palette.inkSoft,
        maxWidth: 660,
      }}
    >
      EXIF + GPS stripped in the browser before upload. Duplicate reports merge privately.
    </div>
    <div style={{ display: 'flex', gap: 7, marginTop: 1 }}>
      {['NO ACCOUNT', 'NO PAYMENT', 'HUMAN APPROVAL'].map((label) => (
        <span
          key={label}
          style={{
            fontFamily: fonts.mono,
            fontSize: 9,
            letterSpacing: '0.08em',
            color: palette.green,
            border: `1px solid ${palette.lineStrong}`,
            backgroundColor: 'rgba(255,253,248,0.72)',
            borderRadius: 999,
            padding: '5px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  </div>
);

const StackBlock: React.FC<{ scene: V3Scene; activeIndex: number }> = ({ scene, activeIndex }) => {
  const active = scene.stack[activeIndex] ?? scene.stack[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
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
        <span style={{ width: 28, height: 1, backgroundColor: palette.amber, display: 'inline-block' }} />
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
          fontSize: 34,
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
          fontSize: 20,
          lineHeight: 1.28,
          color: palette.inkSoft,
        }}
      >
        {active.purpose}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {scene.stack.map((item, index) => (
          <StackChip key={item.name} name={item.name} active={index === activeIndex} index={index} />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tech rail: three legible layers instead of ten tiny chips.         */
/* ------------------------------------------------------------------ */

type TechLayer = 'interface' | 'trust' | 'proof';

type TechItem = {
  id: string;
  name: string;
  purpose: string;
  layer: TechLayer;
};

const TECH_STACK = v3Script.scenes.find((scene) => scene.id === 'tech')?.stack ?? [];
const techPurpose = (name: string, fallback: string): string =>
  TECH_STACK.find((item) => item.name === name)?.purpose ?? fallback;

const TECH_ITEMS: TechItem[] = [
  {
    id: 'nextjs',
    name: 'Next.js + React',
    purpose: techPurpose('Next.js + React', 'front door, report from a phone'),
    layer: 'interface',
  },
  {
    id: 'relayer',
    name: 'NEP-366 relayer',
    purpose: techPurpose('NEP-366 relayer', 'free stamp, relayer pays gas'),
    layer: 'interface',
  },
  {
    id: 'fastify',
    name: 'Fastify',
    purpose: techPurpose('Fastify', 'town clerk, receives the report'),
    layer: 'trust',
  },
  {
    id: 'postgres',
    name: 'Postgres',
    purpose: techPurpose('Postgres', 'ledger, one case + history'),
    layer: 'trust',
  },
  {
    id: 'rust',
    name: 'Rust on NEAR',
    purpose: techPurpose('Rust on NEAR', 'lockbox, holds 100 / pays 72 / refunds 20 / holds 8'),
    layer: 'trust',
  },
  {
    id: 'sputnik',
    name: 'Sputnik DAO',
    purpose: techPurpose('Sputnik DAO', 'committee, 2 of 3 humans'),
    layer: 'trust',
  },
  {
    id: 'nearai',
    name: 'NEAR AI',
    purpose: techPurpose('NEAR AI', 'private tutor, reads cleaned note, never touches money'),
    layer: 'proof',
  },
  {
    id: 'outlayer',
    name: 'OutLayer',
    purpose: techPurpose('OutLayer', 'referee, same scoring rules'),
    layer: 'proof',
  },
  {
    id: 'oneclick',
    name: '1Click',
    purpose: techPurpose('1Click', 'cross-chain quote rail, pending not used here'),
    layer: 'proof',
  },
  {
    id: 'agentmarket',
    name: 'Agent Market',
    purpose: techPurpose('Agent Market', 'outside reviewer, evidence completeness'),
    layer: 'proof',
  },
];

const TECH_LAYERS: Array<{ id: TechLayer; label: string; status: string; statusTone: 'green' | 'amber' | 'mint' }> = [
  { id: 'interface', label: 'INTERFACE', status: 'INTEGRATED', statusTone: 'mint' },
  { id: 'trust', label: 'TRUST', status: 'LIVE TESTNET', statusTone: 'green' },
  { id: 'proof', label: 'PROOF', status: '42 TX VERIFIED', statusTone: 'amber' },
];

/** Roughly follows the voice-over list from "Next.js and React" to "Agent Market". */
const TECH_ACTIVE: Array<{ at: number; id: string }> = [
  { at: 0.6, id: 'nextjs' },
  { at: 2.3, id: 'fastify' },
  { at: 3.6, id: 'postgres' },
  { at: 5.1, id: 'rust' },
  { at: 6.9, id: 'sputnik' },
  { at: 8.7, id: 'nearai' },
  { at: 10.5, id: 'outlayer' },
  { at: 12.3, id: 'oneclick' },
  { at: 14.2, id: 'agentmarket' },
  { at: 17.9, id: 'receipts' },
];

const TECH_RECEIPTS: TechItem = {
  id: 'receipts',
  name: 'Verifiable receipts',
  purpose: '42 transactions: every payment, vote and attestation',
  layer: 'proof',
};

const StatusPill: React.FC<{ children: React.ReactNode; tone?: 'green' | 'amber' | 'mint' }> = ({
  children,
  tone = 'mint',
}) => {
  const style =
    tone === 'green'
      ? { background: palette.green, color: palette.paper, border: palette.green }
      : tone === 'amber'
        ? { background: palette.amberSoft, color: palette.amberStrong, border: 'rgba(169,103,18,0.42)' }
        : { background: 'rgba(255,253,248,0.78)', color: palette.green, border: palette.lineStrong };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: fonts.mono,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.08em',
        lineHeight: 1,
        borderRadius: 999,
        padding: '5px 8px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
};

const TechRail: React.FC<{ activeId: string }> = ({ activeId }) => {
  const active = TECH_ITEMS.find((item) => item.id === activeId) ?? TECH_RECEIPTS;
  const activeLayer = active.layer;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
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
        <span style={{ width: 24, height: 1, backgroundColor: palette.amber, display: 'inline-block' }} />
        <StatusPill tone="green">LIVE TESTNET</StatusPill>
        <StatusPill tone="amber">REPLAY</StatusPill>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: '0.09em',
            color: palette.green,
          }}
        >
          42 TX VERIFIED
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: palette.amberStrong,
            }}
          >
            {active.name.toUpperCase()}
          </span>
          <span style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: '0.08em',
              color: palette.muted,
            }}
          >
            {active.id === 'receipts' ? 'PROOF' : `${TECH_ITEMS.findIndex((item) => item.id === active.id) + 1}/10`}
          </span>
        </div>
        <div
          style={{
            marginTop: 5,
            fontFamily: fonts.display,
            fontSize: 33,
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            color: palette.ink,
          }}
        >
          {active.purpose}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
        {TECH_LAYERS.map((layer) => {
          const items = TECH_ITEMS.filter((item) => item.layer === layer.id);
          const layerActive = active.id === 'receipts' ? layer.id === 'proof' : layer.id === activeLayer;
          return (
            <div
              key={layer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 27,
                padding: '2px 8px 2px 6px',
                borderLeft: `3px solid ${layerActive ? palette.green : 'transparent'}`,
                background: layerActive ? 'rgba(143,211,180,0.16)' : 'transparent',
              }}
            >
              <span
                style={{
                  width: 74,
                  flexShrink: 0,
                  fontFamily: fonts.mono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: palette.amberStrong,
                }}
              >
                {layer.label}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                  fontFamily: fonts.body,
                  fontSize: 16,
                  lineHeight: 1.2,
                  color: palette.inkSoft,
                }}
              >
                {items.map((item, index) => {
                  const isActive = item.id === active.id;
                  return (
                    <React.Fragment key={item.id}>
                      {index > 0 ? (
                        <span style={{ color: palette.lineStrong, fontSize: 13 }}>·</span>
                      ) : null}
                      <span
                        style={{
                          color: isActive ? palette.green : palette.inkSoft,
                          fontWeight: isActive ? 700 : 400,
                          whiteSpace: 'nowrap',
                          borderBottom: isActive ? `2px solid ${palette.mint}` : '2px solid transparent',
                          paddingBottom: 1,
                        }}
                      >
                        {item.name}
                      </span>
                    </React.Fragment>
                  );
                })}
              </span>
              <StatusPill tone={layer.statusTone}>{layer.status}</StatusPill>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 'auto',
          paddingTop: 6,
          fontFamily: fonts.mono,
          fontSize: 9.5,
          letterSpacing: '0.06em',
        }}
      >
        <span style={{ color: palette.amberStrong }}>SIGNATURE VALID · TEE UNAVAILABLE (LABELLED)</span>
        <span style={{ width: 1, height: 10, background: palette.lineStrong }} />
        <span style={{ color: palette.muted }}>PAYMENTS · VOTES · ATTESTATIONS</span>
      </div>
    </div>
  );
};

const TechBottomPanel: React.FC<{ scene: V3Scene; config: LiveSceneConfig }> = ({
  scene,
  config,
}) => {
  const frame = useCurrentFrame();
  const seconds = frame / FPS;
  const activeEntry = TECH_ACTIVE.reduce(
    (current, entry) => (seconds >= entry.at ? entry : current),
    TECH_ACTIVE[0],
  );
  const enter = spring({ frame, fps: 30, config: { damping: 200, stiffness: 100 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: panelHeight(scene.id),
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
          width: 1110,
          padding: '15px 26px 12px 46px',
          borderRight: `1px solid ${palette.line}`,
        }}
      >
        <TechRail activeId={activeEntry.id} />
      </div>
      <div
        style={{
          flex: 1,
          padding: '16px 42px 14px 30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.16em',
                color: palette.amberStrong,
                marginBottom: 6,
              }}
            >
              {config.chapter}
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 41,
                lineHeight: 0.98,
                letterSpacing: '-0.035em',
                color: palette.ink,
              }}
            >
              {config.headline}
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              marginTop: 20,
              padding: '8px 11px',
              borderRadius: 4,
              backgroundColor: palette.green,
              color: palette.paper,
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              maxWidth: 300,
            }}
          >
            {config.metric}
          </div>
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 17,
            lineHeight: 1.32,
            color: palette.muted,
            maxWidth: 700,
          }}
        >
          {config.sub}
        </div>
      </div>
    </div>
  );
};

const BottomPanel: React.FC<{
  scene: V3Scene;
  config: LiveSceneConfig;
}> = ({ scene, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const hookEnd = config.stackRevealAt ?? 0;
  const stackReveal = config.hookStrip
    ? spring({
        frame: Math.max(0, frame - Math.round(hookEnd * fps)),
        fps,
        config: { damping: 200, stiffness: 92 },
      })
    : 1;
  const stackStart = config.hookStrip ? hookEnd : 0;
  const stackWindow = Math.max(0.4, scene.sceneDuration - stackStart - 0.35);
  const stackProgress = Math.min(
    1,
    Math.max(0, (seconds - stackStart) / stackWindow),
  );
  const activeIndex = Math.min(
    scene.stack.length - 1,
    Math.floor(stackProgress * scene.stack.length),
  );
  const enter = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 100 },
  });
  const height = panelHeight(scene.id);
  const openingActive = Boolean(config.opening) && frame < (config.opening?.until ?? 0) * fps;
  const headline = openingActive ? config.opening!.title : config.headline;
  const subline = openingActive ? config.opening!.sub : config.sub;
  const leftPad = '22px 34px 18px 46px';
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
          position: 'relative',
          borderRight: `1px solid ${palette.line}`,
          overflow: 'hidden',
        }}
      >
        {config.hookStrip ? (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: leftPad,
                opacity: 1 - stackReveal,
                transform: `translateY(${-stackReveal * 10}px)`,
              }}
            >
              <HookStrip />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: leftPad,
                opacity: stackReveal,
                transform: `translateY(${(1 - stackReveal) * 14}px)`,
              }}
            >
              <StackBlock scene={scene} activeIndex={activeIndex} />
            </div>
          </>
        ) : (
          <div style={{ padding: leftPad }}>
            <StackBlock scene={scene} activeIndex={activeIndex} />
          </div>
        )}
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
                fontSize: 45,
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
  const media = mediaAt(config.asset) ?? liveMedia(config.sceneId as SceneId);
  const seconds = frame / FPS;
  const camera = cameraAt(seconds, config.camera);
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
            transform: `translate(${camera.x}px, ${(config.offsetY ?? 0) + camera.y}px) scale(${camera.scale})`,
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
      {scene.id === 'tech' ? (
        <TechBottomPanel scene={scene} config={config} />
      ) : (
        <BottomPanel scene={scene} config={config} />
      )}
    </AbsoluteFill>
  );
};
