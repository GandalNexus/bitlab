/**
 * Bundles the browser-side regtest chain engine into public/regtest/engine.js.
 * This runs before next build so the worker can import it without a bundler.
 *
 * Usage:  node scripts/build-regtest-worker.mjs
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/regtest/engine.js');

await build({
  entryPoints: [join(ROOT, 'src/lib/regtest-engine/engine-browser.ts')],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  platform: 'browser',
  target: ['es2020'],
  external: [],
  treeShaking: true,
  minify: false,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});

const hash = createHash('sha256')
  .update(readFileSync(OUT))
  .digest('hex')
  .slice(0, 12);

console.log(`public/regtest/engine.js bundled — hash: ${hash}`);

// Patch the worker to embed the hash as a cache-buster query param.
const workerPath = join(ROOT, 'public/regtest/worker.js');
let worker = readFileSync(workerPath, 'utf8');
worker = worker.replace(
  /import \{[^}]+\} from '\/regtest\/engine\.js(\?v=[a-f0-9]+)?'/,
  (match) => match.replace(/\/regtest\/engine\.js(\?v=[a-f0-9]+)?'/, `/regtest/engine.js?v=${hash}'`),
);
writeFileSync(workerPath, worker);
console.log(`worker.js patched with hash ${hash}`);
