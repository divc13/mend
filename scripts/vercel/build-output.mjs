/**
 * Build the MEND Fastify API into a Vercel Build Output API v3 deployment.
 *
 * Why hand-build the output instead of relying on Vercel's zero-config Node
 * builder:
 *   - npm workspace packages point at TypeScript source. Vercel externalizes
 *     them and the Node 22 runtime then cannot resolve `@mend/db`.
 *   - Vercel's API-function helpers consume the request body before Fastify
 *     sees it. We disable them so Fastify owns parsing.
 *   - A fully bundled handler keeps the prebuilt upload tiny and avoids the
 *     free-plan per-file upload limit.
 *
 * Usage:
 *   node scripts/vercel/build-output.mjs
 *   vercel deploy --prebuilt --prod --archive=tgz
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const output = path.join(root, '.vercel', 'output');
const functionDir = path.join(output, 'functions', 'api', 'index.func');
const handlerDir = path.join(functionDir, 'api');
const migrationsSource = path.join(root, 'packages', 'db', 'migrations');
const migrationsTarget = path.join(functionDir, 'packages', 'db', 'migrations');

await rm(output, { recursive: true, force: true });
await mkdir(handlerDir, { recursive: true });
await mkdir(path.join(output, 'static'), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: ['api/index.ts'],
  outfile: path.join(handlerDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  define: {
    // packages/db computes a default migrations path from import.meta.url.
    // esbuild's CJS output has no import.meta, so provide a real file URL.
    'import.meta.url': 'importMetaUrl',
  },
  banner: {
    js: "const importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  footer: {
    // Vercel invokes the CommonJS handler export directly.
    js: 'module.exports = module.exports.default || module.exports;',
  },
});

const migrationFiles = (await readdir(migrationsSource)).filter((name) => name.endsWith('.sql'));
await mkdir(migrationsTarget, { recursive: true });
for (const name of migrationFiles) {
  await cp(path.join(migrationsSource, name), path.join(migrationsTarget, name));
}

await writeFile(
  path.join(functionDir, 'package.json'),
  `${JSON.stringify({ name: 'mend-api-function', private: true, type: 'commonjs' }, null, 2)}\n`,
);

await writeFile(
  path.join(functionDir, '.vc-config.json'),
  `${JSON.stringify(
    {
      handler: 'api/index.js',
      runtime: 'nodejs22.x',
      architecture: 'arm64',
      memory: 1024,
      maxDuration: 60,
      launcherType: 'Nodejs',
      // Fastify must read the raw request stream itself.
      shouldAddHelpers: false,
      shouldAddSourcemapSupport: true,
    },
    null,
    2,
  )}\n`,
);

await writeFile(
  path.join(output, 'config.json'),
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/api/index' },
      ],
    },
    null,
    2,
  )}\n`,
);

await writeFile(path.join(output, 'static', '.gitkeep'), '');

console.log(
  `[vercel] built .vercel/output: 1 function (maxDuration 60, nodejs22.x, ${migrationFiles.length} migrations)`,
);
