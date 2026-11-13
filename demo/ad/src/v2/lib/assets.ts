import { getStaticFiles, staticFile } from 'remotion';
import manifestJson from '../asset-manifest.json';
import type { SceneId } from './script';

type Manifest = { files: string[] };

const manifest = manifestJson as Manifest;
const normalize = (value: string): string => value.replace(/^\/+/, '');
const manifestSet = new Set(manifest.files.map(normalize));

let runtimeCache: Set<string> | null | undefined;

/**
 * Studio exposes the public file list at runtime. During a render it may be
 * absent, in which case the generated manifest is authoritative.
 */
const runtimeFiles = (): Set<string> | null => {
  if (runtimeCache !== undefined) {
    return runtimeCache;
  }
  try {
    const files = getStaticFiles();
    runtimeCache = Array.isArray(files) && files.length > 0
      ? new Set(files.map((file) => normalize(file.name)))
      : null;
  } catch {
    runtimeCache = null;
  }
  return runtimeCache;
};

export const hasAsset = (path: string): boolean => {
  const clean = normalize(path);
  return manifestSet.has(clean) || Boolean(runtimeFiles()?.has(clean));
};

export const assetSrcByPath = (path: string): string | null =>
  hasAsset(path) ? staticFile(normalize(path)) : null;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

export type MediaKind = 'video' | 'image';

export type MediaAsset = {
  path: string;
  src: string;
  kind: MediaKind;
};

export const mediaKind = (path: string): MediaKind | null => {
  if (VIDEO_EXT.test(path)) {
    return 'video';
  }
  if (IMAGE_EXT.test(path)) {
    return 'image';
  }
  return null;
};

export const mediaAt = (path: string): MediaAsset | null => {
  const kind = mediaKind(path);
  const src = assetSrcByPath(path);
  if (!kind || !src) {
    return null;
  }
  return { path: normalize(path), src, kind };
};

export const firstMedia = (paths: string[]): MediaAsset | null => {
  for (const path of paths) {
    const asset = mediaAt(path);
    if (asset) {
      return asset;
    }
  }
  return null;
};

const LIVE_EXACT: Record<SceneId, string[]> = {
  hook: [
    'assets/live/hook.mp4',
    'assets/live/pothole.mp4',
    'assets/live/street.mp4',
  ],
  report: [
    'assets/live/report.mp4',
    'assets/live/report.webm',
    'assets/live/reporting.mp4',
    'assets/live/report/index.mp4',
    'assets/live/report/report.mp4',
    'assets/live/app-report.mp4',
  ],
  dao: [
    'assets/live/dao.mp4',
    'assets/live/steward.mp4',
    'assets/live/council.mp4',
    'assets/live/dao/index.mp4',
    'assets/live/authorize.mp4',
  ],
  bids: [
    'assets/live/bids.mp4',
    'assets/live/bid.mp4',
    'assets/live/auction.mp4',
    'assets/live/bids/index.mp4',
    'assets/live/score.mp4',
  ],
  repair: [
    'assets/live/repair.mp4',
    'assets/live/inspector.mp4',
    'assets/live/inspection.mp4',
    'assets/live/repair/index.mp4',
    'assets/live/repair/footage.mp4',
  ],
  payment: [
    'assets/live/payment.mp4',
    'assets/live/case.mp4',
    'assets/live/settle.mp4',
    'assets/live/settlement.mp4',
    'assets/live/payment/index.mp4',
  ],
  passport: [
    'assets/live/passport.mp4',
    'assets/live/warranty.mp4',
    'assets/live/passport/index.mp4',
    'assets/live/history.mp4',
  ],
  tech: [
    'assets/live/tech.mp4',
    'assets/live/how-it-works.mp4',
    'assets/live/architecture.mp4',
    'assets/live/tech/index.mp4',
    'assets/live/how-it-works/index.mp4',
  ],
  close: [
    'assets/live/close.mp4',
    'assets/live/outro.mp4',
    'assets/live/street-fixed.mp4',
  ],
};

const LIVE_KEYWORDS: Record<SceneId, RegExp> = {
  hook: /hook|street|pothole/i,
  report: /report|intake/i,
  dao: /dao|steward|council|authorize/i,
  bids: /bid|auction|contractor|score/i,
  repair: /repair|inspect|work-order|workorder/i,
  payment: /payment|settle|case|money|escrow/i,
  passport: /passport|warranty|history/i,
  tech: /tech|how-it-works|architecture|stack|proof/i,
  close: /close|outro|fixed|end/i,
};

const SCREENSHOT_FALLBACK: Record<SceneId, string[]> = {
  hook: [],
  report: [
    'assets/app/report-1-filled.png',
    'assets/app/report-2-photo.png',
    'assets/app/report-4-review.png',
  ],
  dao: ['assets/app/steward.png', 'assets/app/case-scope.png'],
  bids: ['assets/app/bids.png', 'assets/app/bids-score.png'],
  repair: ['assets/app/inspector.png', 'assets/app/case-scope.png'],
  payment: ['assets/app/case-money.png', 'assets/app/case-hero.png'],
  passport: ['assets/app/passport.png', 'assets/app/passport-history.png'],
  tech: [
    'assets/app/how-it-works.png',
    'assets/app/how-it-works-stack.png',
    'assets/app/how-it-works-proof.png',
  ],
  close: [],
};

const liveFiles = (): string[] =>
  manifest.files
    .map(normalize)
    .filter((file) => file.startsWith('assets/live/') && mediaKind(file))
    .sort((a, b) => a.localeCompare(b));

/**
 * Returns the best live capture for a scene. Exact names win, then any file in
 * assets/live/ whose path mentions the scene, then a still app capture.
 */
export const liveMedia = (scene: SceneId): MediaAsset | null => {
  const exact = firstMedia(LIVE_EXACT[scene]);
  if (exact) {
    return exact;
  }
  const keyword = LIVE_KEYWORDS[scene];
  const discovered = liveFiles().find((file) => keyword.test(file));
  if (discovered) {
    return mediaAt(discovered);
  }
  return firstMedia(SCREENSHOT_FALLBACK[scene]);
};

export const footageMedia = (name: string): MediaAsset | null =>
  firstMedia([
    `assets/footage/${name}.mp4`,
    `assets/footage/${name}-vertical.mp4`,
    `assets/live/${name}.mp4`,
  ]);

export const photoMedia = (name: string): MediaAsset | null =>
  firstMedia([`assets/photos/${name}.jpg`, `assets/photos/${name}.png`]);

export const appMedia = (name: string): MediaAsset | null =>
  firstMedia([
    `assets/app/${name}.png`,
    `assets/app/${name}.jpg`,
  ]);

export const publicFiles = manifest.files;
