#!/usr/bin/env node
/** Copy the v3 timeline into src so Remotion can import it statically. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'script-v3.json');
const target = path.join(root, 'src/v3/script.generated.json');
const script = JSON.parse(fs.readFileSync(source, 'utf8'));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(script, null, 2)}\n`);
console.log(`[mend-ad:v3] ${script.scenes.length} scenes, ${script.durationSeconds}s`);
