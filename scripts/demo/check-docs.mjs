#!/usr/bin/env node
/**
 * MEND documentation sanity check.
 *
 * Verifies:
 *  - required documentation and demo files exist;
 *  - every relative markdown link resolves;
 *  - in-document anchors resolve (GitHub-style heading slugs);
 *  - every docs page links back to the docs index;
 *  - required mode labels and demo timestamps are present;
 *  - the submission description is 20–2,000 characters;
 *  - JSON templates parse;
 *  - forbidden unqualified trust claims do not appear in prose;
 *  - no developer-machine absolute paths leak into published docs.
 *
 * No dependencies beyond Node.js.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const errors = [];
const warnings = [];
let filesChecked = 0;
let linksChecked = 0;
let anchorsChecked = 0;
let placeholders = 0;

const REQUIRED_FILES = [
  'README.md',
  'docs/README.md',
  'docs/01-problem-and-product.md',
  'docs/02-user-roles.md',
  'docs/03-architecture.md',
  'docs/04-state-machine.md',
  'docs/05-payment-accounting.md',
  'docs/06-privacy-model.md',
  'docs/07-threat-model.md',
  'docs/08-oracle-and-human-trust.md',
  'docs/09-failure-cases.md',
  'docs/10-deployment-guide.md',
  'docs/11-limitations.md',
  'docs/12-real-world-evidence-package.md',
  'docs/13-demo-script.md',
  'docs/14-submission-package.md',
  'docs/15-demo-capture-plan.md',
  'docs/16-integration-evidence.md',
  'docs/17-copy-and-accessibility.md',
  'docs/RULES.md',
  'scripts/demo/README.md',
  'scripts/demo/check-docs.mjs',
  'scripts/demo/capture-replay-demo.mjs',
  'fixtures/demo/README.md',
  'fixtures/demo/media-checklist.md',
  'fixtures/demo/consent-record.template.md',
  'fixtures/demo/what-was-real-vs-staged.template.md',
  'fixtures/demo/evidence-manifest.template.json',
  'fixtures/demo/transactions.template.json',
  'fixtures/demo/submission-description.txt',
];

const REQUIRED_STRINGS = [
  ['README.md', 'Do X → See Y', 'README must contain the exact Do X → See Y heading'],
  ['README.md', 'REPLAY / SIMULATION', 'README must show the replay mode label'],
  ['README.md', 'LIVE TESTNET — TEST VALUE ONLY', 'README must show the testnet mode label'],
  ['README.md', 'MAINNET — REAL FUNDS', 'README must show the mainnet mode label'],
  ['docs/03-architecture.md', '## Source of truth rules', 'architecture source-of-truth section'],
  ['docs/04-state-machine.md', '## Warranty reopening', 'warranty reopening section'],
  ['docs/05-payment-accounting.md', '## The ledger invariant', 'ledger invariant section'],
  ['docs/08-oracle-and-human-trust.md', '## NEAR AI attestation', 'NEAR AI trust section'],
  ['docs/08-oracle-and-human-trust.md', '## OutLayer and the deterministic scorer', 'OutLayer trust section'],
  ['docs/08-oracle-and-human-trust.md', '## Sputnik DAO authorization', 'DAO trust section'],
  ['docs/08-oracle-and-human-trust.md', '## Human inspection', 'human inspection section'],
  ['docs/12-real-world-evidence-package.md', '## Before / repair / after / durability checklist', 'media checklist section'],
  ['docs/12-real-world-evidence-package.md', 'Current status: NOT COLLECTED', 'evidence status must be honest'],
  ['docs/13-demo-script.md', '0–8s', 'demo timestamp 0–8s'],
  ['docs/13-demo-script.md', '8–18s', 'demo timestamp 8–18s'],
  ['docs/13-demo-script.md', '18–28s', 'demo timestamp 18–28s'],
  ['docs/13-demo-script.md', '28–38s', 'demo timestamp 28–38s'],
  ['docs/13-demo-script.md', '38–50s', 'demo timestamp 38–50s'],
  ['docs/13-demo-script.md', '50–58s', 'demo timestamp 50–58s'],
  ['docs/13-demo-script.md', '58–68s', 'demo timestamp 58–68s'],
  ['docs/13-demo-script.md', '68–78s', 'demo timestamp 68–78s'],
  ['docs/13-demo-script.md', '78–86s', 'demo timestamp 78–86s'],
  ['docs/13-demo-script.md', '86–90s', 'demo timestamp 86–90s'],
  ['docs/14-submission-package.md', 'HUMAN SUPPLIED — DO NOT INVENT', 'human-supplied warning'],
  ['docs/15-demo-capture-plan.md', 'PENDING', 'capture status must be pending'],
  ['docs/17-copy-and-accessibility.md', 'WCAG 2.2 AA', 'accessibility target'],
];

const FORBIDDEN_PROSE = [
  { phrase: 'ai approved', hint: 'Say "AI suggested; a human inspector decided".' },
  { phrase: 'structurally safe', hint: 'Say "human inspector recorded completion; not a structural certification".' },
  { phrase: 'guaranteed', hint: 'Describe the durability holdback and inspection instead.' },
  { phrase: 'city adoption', hint: 'No city has adopted MEND; describe the pilot scope.' },
  { phrase: 'partnered with', hint: 'Name only a real documented relationship; currently none.' },
  { phrase: 'official partner', hint: 'Name only a real documented relationship; currently none.' },
  { phrase: 'production-ready', hint: 'Say "in active integration; limitations documented".' },
  { phrase: 'provably fair', hint: 'Say "deterministic, hash-pinned policy scoring".' },
];

const SKIP_BANNED_SECTION = /forbidden|non-claims|do not|must not|avoid|limitations|copy and accessibility/i;
const NEGATED_LINE = /\b(not|no|never|avoid|forbidden|banned|cannot|does not|do not|without|none)\b/i;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'captures') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function slugify(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

function headingSlugs(content) {
  const seen = new Map();
  const slugs = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    const base = slugify(match[2]);
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function stripFencedCode(content) {
  return content.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' '));
}

function stripInlineCode(content) {
  return content.replace(/`[^`]*`/g, '');
}

function extractLinks(content) {
  const clean = stripInlineCode(stripFencedCode(content));
  const links = [];
  const regex = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  let match;
  while ((match = regex.exec(clean)) !== null) links.push(match[1]);
  return links;
}

async function main() {
  for (const file of REQUIRED_FILES) {
    const full = path.join(ROOT, file);
    try {
      const info = await stat(full);
      if (!info.isFile()) errors.push(`${file}: required path is not a file`);
    } catch {
      errors.push(`${file}: required file is missing`);
    }
  }

  const markdown = [
    path.join(ROOT, 'README.md'),
    ...(await walk(path.join(ROOT, 'docs'))).filter((f) => f.endsWith('.md')),
    ...(await walk(path.join(ROOT, 'fixtures', 'demo'))).filter((f) => f.endsWith('.md')),
    path.join(ROOT, 'scripts', 'demo', 'README.md'),
  ];

  const uniqueMarkdown = [...new Set(markdown)].filter((f) => f.endsWith('.md'));
  const slugCache = new Map();

  for (const file of uniqueMarkdown) {
    let content;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      errors.push(`${rel(file)}: cannot read`);
      continue;
    }
    filesChecked += 1;
    if (!content.endsWith('\n')) warnings.push(`${rel(file)}: missing trailing newline`);

    const relFile = rel(file);
    placeholders += (content.match(/HUMAN[ _]SUPPLIED/g) ?? []).length;

    if (relFile.startsWith('docs/') && relFile !== 'docs/README.md') {
      const hasBacklink = /\]\((?:\.\/)?README\.md(?:#[^)]*)?\)/.test(content);
      if (!hasBacklink) errors.push(`${relFile}: missing link back to docs/README.md`);
    }

    const linkTargets = extractLinks(content);
    for (const rawTarget of linkTargets) {
      if (/^(?:https?:|mailto:|tel:|ipfs:|data:)/i.test(rawTarget)) continue;
      if (rawTarget.startsWith('#')) {
        const anchor = rawTarget.slice(1);
        if (!anchor) continue;
        if (!slugCache.has(file)) slugCache.set(file, headingSlugs(content));
        if (!slugCache.get(file).has(anchor)) {
          errors.push(`${relFile}: missing in-page anchor #${anchor}`);
        } else {
          anchorsChecked += 1;
        }
        continue;
      }

      const hashIndex = rawTarget.indexOf('#');
      const targetPath = hashIndex === -1 ? rawTarget : rawTarget.slice(0, hashIndex);
      const anchor = hashIndex === -1 ? '' : rawTarget.slice(hashIndex + 1);
      if (!targetPath) continue;

      let decoded;
      try {
        decoded = decodeURIComponent(targetPath);
      } catch {
        decoded = targetPath;
      }
      const resolved = path.resolve(path.dirname(file), decoded);
      let info;
      try {
        info = await stat(resolved);
        linksChecked += 1;
      } catch {
        errors.push(`${relFile}: dead relative link -> ${rawTarget}`);
        continue;
      }
      if (info.isDirectory()) {
        warnings.push(`${relFile}: link points to a directory -> ${rawTarget}`);
        continue;
      }
      if (anchor) {
        if (!slugCache.has(resolved)) slugCache.set(resolved, headingSlugs(await readFile(resolved, 'utf8')));
        if (!slugCache.get(resolved).has(anchor)) {
          errors.push(`${relFile}: dead anchor -> ${rawTarget}`);
        } else {
          anchorsChecked += 1;
        }
      }
    }

    let skip = false;
    const prose = stripInlineCode(stripFencedCode(content));
    const lines = prose.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        skip = SKIP_BANNED_SECTION.test(heading[2]);
        continue;
      }
      if (skip || NEGATED_LINE.test(line)) continue;
      const lower = line.toLowerCase();
      for (const { phrase, hint } of FORBIDDEN_PROSE) {
        if (lower.includes(phrase)) errors.push(`${relFile}:${i + 1}: forbidden claim "${phrase}". ${hint}`);
      }
    }
    if (/\/Volumes\/|\/Users\/[A-Za-z0-9._-]+\//.test(content)) {
      errors.push(`${relFile}: contains a developer-machine absolute path`);
    }
  }

  for (const [file, needle, label] of REQUIRED_STRINGS) {
    const full = path.join(ROOT, file);
    try {
      const content = await readFile(full, 'utf8');
      if (!content.includes(needle)) errors.push(`${file}: missing ${label} (expected "${needle}")`);
    } catch {
      errors.push(`${file}: cannot verify ${label}`);
    }
  }

  for (const jsonFile of ['fixtures/demo/evidence-manifest.template.json', 'fixtures/demo/transactions.template.json']) {
    try {
      JSON.parse(await readFile(path.join(ROOT, jsonFile), 'utf8'));
    } catch (error) {
      errors.push(`${jsonFile}: invalid JSON (${error.message})`);
    }
  }

  let descriptionLength = 0;
  try {
    const description = (await readFile(path.join(ROOT, 'fixtures/demo/submission-description.txt'), 'utf8')).trim();
    descriptionLength = description.length;
    if (descriptionLength < 20 || descriptionLength > 2000) {
      errors.push(`fixtures/demo/submission-description.txt: ${descriptionLength} characters, expected 20–2,000`);
    }
  } catch {
    errors.push('fixtures/demo/submission-description.txt: cannot read');
  }

  const readmePath = path.join(ROOT, 'README.md');
  try {
    const readme = await readFile(readmePath, 'utf8');
    if (!readme.includes('node scripts/demo/check-docs.mjs')) {
      errors.push('README.md: missing the docs check command');
    }
  } catch {
    // Already reported by the required-files check.
  }

  console.log('MEND docs check');
  console.log(`Root: ${ROOT}`);
  console.log(`Markdown files checked: ${filesChecked}`);
  console.log(`Relative links checked: ${linksChecked}`);
  console.log(`Anchors checked: ${anchorsChecked}`);
  console.log(`Submission description: ${descriptionLength} characters (required 20–2,000)`);
  console.log(`HUMAN SUPPLIED placeholders found: ${placeholders}`);

  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const warning of warnings) console.log(`  WARN ${warning}`);
  }

  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const error of errors) console.log(`  FAIL ${error}`);
    console.log('\nRESULT: FAIL');
    process.exitCode = 1;
    return;
  }

  console.log('\nRESULT: PASS — documentation, links, anchors, templates and claims are consistent.');
}

await main();
