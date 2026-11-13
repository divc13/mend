#!/usr/bin/env node

/**
 * Capture-only staging for the pothole replay case.
 *
 * Writes apps/web/src/lib/demo-case-state.json so the fixtures build
 * WO-PATH-001-0002 in the requested lifecycle state. This is not a runtime
 * `?demo=` flag: the app genuinely renders that state after Next reloads.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATES = ['BIDDING', 'COMPLETION_SUBMITTED', 'CLOSED'];

const NEXT_ACTIONS = {
  BIDDING: [
    'In /steward select WO-PATH-001-0002, tick the acting-as-steward box, then click Confirm award.',
    'In /bids/WO-PATH-001-0002 the offers start sealed; click Reveal comparison to show the live reveal.',
  ],
  COMPLETION_SUBMITTED: [
    'In /inspector/WO-PATH-001-0002 tick the three human confirmations, then click Accept completion.',
  ],
  CLOSED: [
    'No action is required. Verify /cases/WO-PATH-001-0002 shows 100 funded / 20 refunded / 72 completion / 8 holdback.',
    'Verify /assets/PATH-006 still renders the closed passport and both pothole work orders.',
  ],
};

const requested = process.argv[2];

if (!requested || !STATES.includes(requested)) {
  console.error(`Usage: node scripts/demo/stage-pothole-case.mjs <${STATES.join('|')}>`);
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const statePath = resolve(repoRoot, 'apps/web/src/lib/demo-case-state.json');

let previous;
try {
  previous = JSON.parse(await readFile(statePath, 'utf8')).status;
} catch {
  previous = undefined;
}

await writeFile(statePath, `${JSON.stringify({ status: requested }, null, 2)}\n`, 'utf8');

const routes = {
  BIDDING: [
    '/steward',
    '/bids/WO-PATH-001-0002',
    '/cases/WO-PATH-001-0002',
    '/assets/PATH-006',
  ],
  COMPLETION_SUBMITTED: [
    '/inspector/WO-PATH-001-0002',
    '/cases/WO-PATH-001-0002',
    '/assets/PATH-006',
  ],
  CLOSED: ['/cases/WO-PATH-001-0002', '/assets/PATH-006'],
}[requested];

console.log(
  `Staged WO-PATH-001-0002 as ${requested}${previous && previous !== requested ? ` (was ${previous})` : ''}.`,
);
console.log(`Wrote ${statePath}`);
console.log('');
console.log('Next dev reload:');
console.log(
  '  The JSON file is part of the app module graph. If `npm run dev --workspace @mend/web` is running,',
);
console.log(
  '  Next recompiles the affected routes when the file changes. Refresh the page after compilation.',
);
console.log(
  '  If a route still shows the previous state, stop the dev server and start it again before capturing.',
);
console.log('');
console.log('Production capture:');
console.log('  Run `npm run build --workspace @mend/web` after staging, then start the built app.');
console.log('');
console.log('Open:');
for (const route of routes) console.log(`  http://localhost:3000${route}`);
console.log('');
console.log('Capture sequence:');
for (const action of NEXT_ACTIONS[requested]) console.log(`  - ${action}`);
