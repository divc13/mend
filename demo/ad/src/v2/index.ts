import { registerRoot } from 'remotion';
import { RemotionRoot } from '../Root';

/**
 * Standalone entry point for the v2 composition:
 *   npx remotion studio demo/ad/src/v2/index.ts
 * The main entry (`src/index.ts`) registers the same root, so both list every
 * composition without duplicating the composition definitions.
 */
registerRoot(RemotionRoot);
