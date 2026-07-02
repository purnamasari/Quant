// Build script: bundles the Electron main process, preload, and React renderer
// with esbuild, then copies static assets into dist/.
//
//   dist/main/main.js        <- src/main/main.ts       (node, cjs, electron external)
//   dist/main/preload.js     <- src/main/preload.ts    (node, cjs, electron external)
//   dist/main/data/*         <- src/main/data/*        (bundled JSON datasets)
//   dist/renderer/renderer.js/.css <- src/renderer/index.tsx
//   dist/renderer/index.html <- src/renderer/index.html

import { build } from 'esbuild';
import { cpSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(root, ...p);

mkdirSync(r('dist/main'), { recursive: true });
mkdirSync(r('dist/renderer'), { recursive: true });

await build({
  entryPoints: [r('src/main/main.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  outfile: r('dist/main/main.js'),
  sourcemap: 'inline',
  logLevel: 'warning',
});

await build({
  entryPoints: [r('src/main/preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  outfile: r('dist/main/preload.js'),
  sourcemap: 'inline',
  logLevel: 'warning',
});

await build({
  entryPoints: [r('src/renderer/index.tsx')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  outfile: r('dist/renderer/renderer.js'),
  sourcemap: 'inline',
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

copyFileSync(r('src/renderer/index.html'), r('dist/renderer/index.html'));
if (existsSync(r('src/main/data'))) {
  cpSync(r('src/main/data'), r('dist/main/data'), { recursive: true });
}

console.log('build ok');
