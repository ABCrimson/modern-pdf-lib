/**
 * Post-build smoke test: import every built entry point from `dist/` and assert
 * it LINKS and exposes its key exports.
 *
 * This guards against a class of bug that the unit suite cannot catch: the unit
 * tests import from `src/`, never from the bundled `dist/`. A bundler that emits
 * a broken `export { … }` (e.g. a type-only re-export leaked into the value
 * graph) produces a package that throws `SyntaxError: Export 'X' is not defined
 * in module` at link time for EVERY consumer — while `tsc`, `vitest`, and the
 * build all still pass. v0.28.0 shipped exactly that bug. This script makes the
 * published artifact a first-class, verified gate.
 *
 * Usage: `node scripts/smoke-dist.mjs` (run after `npm run build`).
 * Exits non-zero on the first failure.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(process.cwd(), 'dist');

/** ESM entries → value exports we expect (a representative cross-section,
 *  incl. one advanced symbol per specialized guide so they can't be silently
 *  dropped from the root barrel). */
const ESM_ENTRIES = [
  {
    file: 'index.mjs',
    expect: [
      'createPdf',
      'loadPdf',
      'parseContentStream',
      'extractTextWithPositions',
      // one per specialized guide (form-scripts / verification / jpeg2000 / pdfx)
      'formatAcrobatDate',
      'TrustStore',
      'decodeJpeg2000',
      'validatePdfX',
      // 0.29.x rendering
      'renderPageToImage',
      'interpretPage',
      'comparePages',
      // 0.30.x PDF 2.0 core
      'attachAssociatedFiles',
      'buildSoftMaskGroupExtGState',
      'buildPageOutputIntent',
      // 0.31.x tagged PDF
      'tagHeading',
      'validatePdfUa2',
      'autoTagPage',
    ],
  },
  { file: 'create.mjs', expect: ['createPdf'] },
  { file: 'parse.mjs', expect: ['loadPdf'] },
  { file: 'forms.mjs', expect: ['PdfForm'] },
  { file: 'browser.mjs', expect: ['createPdf'] },
];

/** CJS entries → require() must succeed and expose the same. */
const CJS_ENTRIES = [
  { file: 'index.cjs', expect: ['createPdf', 'loadPdf'] },
  { file: 'create.cjs', expect: ['createPdf'] },
  { file: 'parse.cjs', expect: ['loadPdf'] },
  { file: 'forms.cjs', expect: ['PdfForm'] },
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

for (const { file, expect } of ESM_ENTRIES) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    fail(`ESM ${file}: missing (did the build run?)`);
    continue;
  }
  try {
    const mod = await import(pathToFileURL(path).href);
    const missing = expect.filter((k) => typeof mod[k] === 'undefined');
    if (missing.length) fail(`ESM ${file}: linked but missing exports: ${missing.join(', ')}`);
    else ok(`ESM ${file}: links, ${Object.keys(mod).length} exports, [${expect.join(', ')}] present`);
  } catch (e) {
    fail(`ESM ${file}: ${e.message}`);
  }
}

for (const { file, expect } of CJS_ENTRIES) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    fail(`CJS ${file}: missing`);
    continue;
  }
  try {
    const mod = require(path);
    const missing = expect.filter((k) => typeof mod[k] === 'undefined');
    if (missing.length) fail(`CJS ${file}: loaded but missing exports: ${missing.join(', ')}`);
    else ok(`CJS ${file}: requires, [${expect.join(', ')}] present`);
  } catch (e) {
    fail(`CJS ${file}: ${e.message}`);
  }
}

if (failures > 0) {
  console.error(`\n✗ dist smoke FAILED: ${failures} entry/entries broken — the published package would be unimportable.`);
  process.exit(1);
}
console.log('\n✓ dist smoke passed: every built entry links and exposes its public API.');
