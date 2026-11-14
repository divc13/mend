import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { AppScene, type LiveSceneConfig } from './components/AppScene';
import { CloseV3 } from './scenes/CloseV3';
import { CastOverlays } from './components/CastOverlays';
import { ACTIONS, SCENE_TRIM } from './lib/actions';
import { FPS, sceneById, sceneFrames, TOTAL_FRAMES, v3Script, type V3Scene } from './lib/script';

type AppSceneId = Exclude<V3Scene['id'], 'hook' | 'close'>;

/**
 * The report player starts with the hook, so its scene begins at 0 while the
 * stack strip only appears when the report section does.
 */
const HOOK_END = sceneById('hook').sceneDuration;

/**
 * Camera keyframes are scene-local and peak on the captured action. The
 * strongest punch stays at 1.13x; the app remains full-bleed, never a slide.
 * Source trims and rates come from `lib/actions.ts` so they stay in sync with
 * the action table and with the 0.60 s breath at the end of every scene.
 */
const CONFIG: Record<AppSceneId, LiveSceneConfig> = {
  report: {
    sceneId: 'report',
    asset: 'assets/live/report-live.mp4',
    ...SCENE_TRIM.report,
    origin: '50% 42%',
    camera: [
      { at: 0, scale: 1.04, x: 0, y: 0 },
      { at: ACTIONS.report.privacy - 1.2, scale: 1.04, x: 0, y: 0 },
      { at: ACTIONS.report.privacy, scale: 1.1, x: -22, y: 12 },
      { at: ACTIONS.report.duplicate - 1, scale: 1.1, x: -22, y: 12 },
      { at: ACTIONS.report.duplicate, scale: 1.1, x: 18, y: -4 },
      { at: ACTIONS.report.submit - 1.2, scale: 1.1, x: 18, y: -4 },
      { at: ACTIONS.report.submit, scale: 1.13, x: 8, y: 20 },
    ],
    hookStrip: true,
    stackRevealAt: HOOK_END,
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
    ...SCENE_TRIM.dao,
    origin: '50% 10%',
    camera: [
      { at: 0, scale: 1.035, x: 0, y: 0 },
      { at: ACTIONS.dao.scope - 1, scale: 1.035, x: 0, y: 0 },
      { at: ACTIONS.dao.scope, scale: 1.08, x: -12, y: 6 },
      { at: ACTIONS.dao.saveDraft - 1, scale: 1.08, x: -12, y: 6 },
      { at: ACTIONS.dao.saveDraft, scale: 1.1, x: 10, y: 12 },
      { at: ACTIONS.dao.award - 1.2, scale: 1.1, x: 10, y: 12 },
      { at: ACTIONS.dao.award, scale: 1.13, x: 16, y: 20 },
    ],
    chapter: '02 / AUTHORIZE',
    headline: 'Steward proposes. DAO decides.',
    sub: 'The steward writes the scope and maximum budget. Two of three council votes authorize it; the AI cannot approve or move money.',
    metric: '2 OF 3 · SPUTNIK DAO',
  },
  bids: {
    sceneId: 'bids',
    asset: 'assets/live/bids-live.mp4',
    ...SCENE_TRIM.bids,
    origin: '50% 44%',
    camera: [
      { at: 0, scale: 1.045, x: 0, y: 0 },
      { at: ACTIONS.bids.reveal - 0.9, scale: 1.045, x: 0, y: 0 },
      { at: ACTIONS.bids.reveal, scale: 1.1, x: -24, y: 0 },
      { at: ACTIONS.bids.score - 0.9, scale: 1.1, x: -24, y: 0 },
      { at: ACTIONS.bids.score, scale: 1.12, x: 18, y: 8 },
      { at: ACTIONS.bids.hashes - 1, scale: 1.12, x: 18, y: 8 },
      { at: ACTIONS.bids.hashes, scale: 1.1, x: 0, y: 24 },
    ],
    chapter: '03 / COMPETE',
    headline: 'Three sealed bids. One policy.',
    sub: 'Price, warranty, duration and materials are scored by a hash-pinned policy. B wins on total value, not the lowest sticker.',
    metric: 'B 9,270 · VALUE WINNER',
  },
  repair: {
    sceneId: 'repair',
    asset: 'assets/live/inspector-live.mp4',
    ...SCENE_TRIM.repair,
    offsetY: -84,
    origin: '50% 10%',
    camera: [
      { at: 0, scale: 1.04, x: 0, y: 0 },
      { at: ACTIONS.repair.checklist - 1, scale: 1.04, x: 0, y: 0 },
      { at: ACTIONS.repair.checklist, scale: 1.08, x: -16, y: 6 },
      { at: ACTIONS.repair.accept - 1.2, scale: 1.08, x: -16, y: 6 },
      { at: ACTIONS.repair.accept, scale: 1.13, x: 18, y: 0 },
    ],
    chapter: '04 / INSPECT',
    headline: 'Fix it. Then inspect it.',
    sub: 'A different human checks the evidence, ticks the checklist and signs. The contractor cannot approve their own work.',
    metric: 'EVIDENCE · CHECKLIST · SIGNATURE',
  },
  payment: {
    sceneId: 'payment',
    asset: 'assets/live/payment-live.mp4',
    ...SCENE_TRIM.payment,
    origin: '63% 32%',
    camera: [
      { at: 0, scale: 1.075, x: 0, y: 0 },
      { at: ACTIONS.payment.split - 1, scale: 1.075, x: 0, y: 0 },
      { at: ACTIONS.payment.split, scale: 1.11, x: -16, y: 6 },
      { at: ACTIONS.payment.payments - 1, scale: 1.11, x: -16, y: 6 },
      { at: ACTIONS.payment.payments, scale: 1.13, x: 14, y: 16 },
    ],
    chapter: '05 / SETTLE',
    headline: 'Paid on acceptance.',
    sub: '100 funded. 20 refunded at award. 72 paid on acceptance. 8 held for durability. Exact, auditable, protocol-enforced.',
    metric: '100 → 20 / 72 / 8',
  },
  passport: {
    sceneId: 'passport',
    asset: 'assets/live/passport-live.mp4',
    ...SCENE_TRIM.passport,
    origin: '48% 40%',
    camera: [
      { at: 0, scale: 1.055, x: 0, y: 0 },
      { at: ACTIONS.passport.history, scale: 1.08, x: -14, y: 8 },
      { at: ACTIONS.passport.entries, scale: 1.11, x: 8, y: 18 },
    ],
    chapter: '06 / REMEMBER',
    headline: 'One asset. One record.',
    sub: 'The repair stays attached to the pothole, not the contractor. If it fails, the same work order reopens with no new bounty.',
    metric: 'PATH-006 · SAME WORK ORDER',
  },
  tech: {
    sceneId: 'tech',
    asset: 'assets/live/tech-live.mp4',
    ...SCENE_TRIM.tech,
    offsetY: -46,
    origin: '50% 40%',
    camera: [
      { at: 0, scale: 1.015, x: 0, y: 0 },
      { at: ACTIONS.tech.stack, scale: 1.06, x: -8, y: -10 },
      { at: ACTIONS.tech.cards, scale: 1.08, x: 6, y: -14 },
      { at: ACTIONS.tech.proof, scale: 1.1, x: 0, y: 4 },
    ],
    chapter: '07 / UNDER THE HOOD',
    headline: 'Live proof. Not vibes.',
    sub: 'Live on NEAR testnet. Contracts, DAO vote, AI signature and Agent Market listing are real; the pothole story is a replay.',
    metric: 'NEAR TESTNET · VERIFIABLE RECEIPTS',
  },
};

// Cuts land directly on populated app content. A near-black fade here made the
// first frames of every scene read as a blank app behind the floating cast card.
const Cut: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: '#071b15' }}>{children}</AbsoluteFill>
);

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
