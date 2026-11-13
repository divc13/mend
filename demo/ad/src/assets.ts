import { staticFile } from 'remotion';
import scriptJson from '../script.json';
import manifestJson from './asset-manifest.json';
import type { AssetKey, Script } from './types';

const script = scriptJson as unknown as Script;
const manifest = manifestJson as { files: string[] };

/**
 * The capture pipeline writes descriptive screenshot names while script.json
 * keeps stable semantic keys. Try the script path first, then known captures.
 */
const FALLBACKS: Partial<Record<AssetKey, string[]>> = {
  appReport: [
    'assets/app/report-1-filled.png',
    'assets/app/report-1.png',
    'assets/app/demo-pothole.png',
  ],
  appPrivacy: [
    'assets/app/report-2-photo.png',
    'assets/app/report-4-review.png',
  ],
  appTriage: [
    'assets/app/report-3-duplicate.png',
    'assets/app/report-4-review.png',
  ],
  appCase: [
    'assets/app/case-hero.png',
    'assets/app/case-scope.png',
    'assets/app/case-money.png',
  ],
  appSteward: ['assets/app/steward.png'],
  appBids: ['assets/app/bids.png', 'assets/app/bids-score.png'],
  appInspector: ['assets/app/inspector.png'],
  appPassport: ['assets/app/passport.png', 'assets/app/passport-history.png'],
  appTech: [
    'assets/app/how-it-works.png',
    'assets/app/how-it-works-stack.png',
    'assets/app/how-it-works-proof.png',
  ],
  appTrust: ['assets/app/trust.png'],
};

const normalize = (value: string): string => value.replace(/^\/+/, '');
const manifestSet = new Set(manifest.files.map(normalize));

type RuntimeStaticFile = { name: string };

const runtimeFiles = (): Set<string> | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const files = (window as unknown as { remotion_staticFiles?: RuntimeStaticFile[] })
    .remotion_staticFiles;
  if (!Array.isArray(files)) {
    return null;
  }
  return new Set(files.map((file) => normalize(file.name)));
};

/** True when the file is present in demo/ad/public (manifest or Studio runtime). */
export const hasAsset = (path: string): boolean => {
  const runtime = runtimeFiles();
  return (runtime ?? manifestSet).has(normalize(path));
};

export const assetPath = (key: AssetKey): string => script.assets[key];

const candidatePaths = (key: AssetKey): string[] => {
  const preferred = script.assets[key];
  const fallbacks = FALLBACKS[key] ?? [];
  return [preferred, ...fallbacks].filter(
    (path, index, list) => Boolean(path) && list.indexOf(path) === index,
  );
};

export const hasAssetKey = (key: AssetKey): boolean =>
  candidatePaths(key).some((path) => hasAsset(path));

/** Returns a staticFile() URL when the asset exists, otherwise null. */
export const assetSrc = (key: AssetKey): string | null => {
  const path = candidatePaths(key).find((candidate) => hasAsset(candidate));
  if (!path) {
    return null;
  }
  return staticFile(path);
};

export const assetSrcByPath = (path: string): string | null =>
  hasAsset(path) ? staticFile(path) : null;

export const assetManifest = manifest.files;
export const scriptData = script;
