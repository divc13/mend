import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { AppScene, type LiveSceneConfig } from './components/AppScene';
import { CloseV3 } from './scenes/CloseV3';
import { CastOverlays } from './components/CastOverlays';
import { FPS, sceneById, sceneFrames, TOTAL_FRAMES, v3Script, type V3Scene } from './lib/script';

type AppSceneId = Exclude<V3Scene['id'], 'hook' | 'close'>;

const CONFIG: Record<AppSceneId, LiveSceneConfig> = {
  report: {
    sceneId: 'report',
    asset: 'assets/live/report-live.mp4',
    playbackRate: 1,
    zoom: 1.02,
    chapter: '01 / INTAKE',
    headline: 'No wallet. No forms.',
    sub: 'A photo, a location, one sentence. The browser strips EXIF and GPS before upload; a private duplicate check proposes a merge.',
    metric: 'NO WALLET · EXIF STRIPPED',
    opening: {
      title: 'Every neighborhood\nhas one.',
      sub: 'A pothole nobody owns. This morning, Sam reports it.',
      until: 4.6,
    },
  },
  dao: {
    sceneId: 'dao',
    asset: 'assets/live/steward-live.mp4',
    playbackRate: 1,
    zoom: 1.035,
    origin: '50% 38%',
    chapter: '02 / AUTHORIZE',
    headline: 'Steward proposes. DAO decides.',
    sub: 'The steward writes the scope and maximum budget. Two of three council votes authorize it; the AI cannot approve or move money.',
    metric: '2 OF 3 · SPUTNIK DAO',
  },
  bids: {
    sceneId: 'bids',
    asset: 'assets/live/bids-live.mp4',
    playbackRate: 1,
    zoom: 1.045,
    origin: '50% 44%',
    chapter: '03 / COMPETE',
    headline: 'Three sealed bids. One policy.',
    sub: 'Price, warranty, duration and materials are scored by a hash-pinned policy. B wins on total value, not the lowest sticker.',
    metric: 'B 9,270 · VALUE WINNER',
  },
  repair: {
    sceneId: 'repair',
    asset: 'assets/live/inspector-live.mp4',
    playbackRate: 1,
    zoom: 1.04,
    offsetY: -84,
    origin: '50% 44%',
    chapter: '04 / INSPECT',
    headline: 'Fix it. Then inspect it.',
    sub: 'A different human checks the evidence, ticks the checklist and signs. The contractor cannot approve their own work.',
    metric: 'EVIDENCE · CHECKLIST · SIGNATURE',
  },
  payment: {
    sceneId: 'payment',
    asset: 'assets/live/payment-live.mp4',
    playbackRate: 0.56,
    zoom: 1.075,
    origin: '63% 32%',
    chapter: '05 / SETTLE',
    headline: 'Paid on acceptance.',
    sub: '100 funded. 20 refunded at award. 72 paid on acceptance. 8 held for durability. Exact, auditable, protocol-enforced.',
    metric: '100 → 20 / 72 / 8',
  },
  passport: {
    sceneId: 'passport',
    asset: 'assets/live/passport-live.mp4',
    playbackRate: 0.68,
    zoom: 1.055,
    origin: '48% 40%',
    chapter: '06 / REMEMBER',
    headline: 'One asset. One record.',
    sub: 'The repair stays attached to the pothole, not the contractor. If it fails, the same work order reopens with no new bounty.',
    metric: 'PATH-006 · SAME WORK ORDER',
  },
  tech: {
    sceneId: 'tech',
    asset: 'assets/live/tech-live.mp4',
    playbackRate: 0.34,
    zoom: 1.015,
    offsetY: -46,
    origin: '50% 40%',
    chapter: '07 / UNDER THE HOOD',
    headline: 'Live proof. Not vibes.',
    sub: 'The stack behind the receipt: Next.js, Fastify, Postgres, NEAR AI, Rust on NEAR, Sputnik DAO, OutLayer, 1Click, Agent Market.',
    metric: 'NEAR TESTNET · VERIFIABLE RECEIPTS',
  },
};

const Cut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity, backgroundColor: '#071b15' }}>{children}</AbsoluteFill>;
};

export const AdV3: React.FC = () => {
  const report = sceneById('report');
  const reportAll: V3Scene = {
    ...report,
    start: 0,
    sceneDuration: report.start + report.sceneDuration,
    stack: report.stack,
  };
  const appScenes = [
    reportAll,
    sceneById('dao'),
    sceneById('bids'),
    sceneById('repair'),
    sceneById('payment'),
    sceneById('passport'),
    sceneById('tech'),
  ];
  const close = sceneById('close');
  return (
    <AbsoluteFill style={{ backgroundColor: '#071b15' }}>
      {appScenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={Math.round(scene.start * FPS)}
          durationInFrames={Math.round(scene.sceneDuration * FPS)}
        >
          <Cut>
            <AppScene
              scene={scene}
              config={CONFIG[scene.id as AppSceneId]}
              index={index + 1}
            />
          </Cut>
        </Sequence>
      ))}
      <Sequence
        from={Math.round(close.start * FPS)}
        durationInFrames={Math.round(close.sceneDuration * FPS)}
      >
        <Cut>
          <CloseV3 scene={close} />
        </Cut>
      </Sequence>
      <CastOverlays />
      <div style={{ display: 'none' }}>{TOTAL_FRAMES}{v3Script.durationSeconds}{v3Script.scenes.length}{sceneFrames(report)}</div>
    </AbsoluteFill>
  );
};
