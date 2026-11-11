/**
 * Standalone IIFE build using esbuild directly.
 *
 * Produces dist/modern-pdf-lib.iife.js with a global `ModernPdf` for
 * script-tag usage without a bundler. Runs under plain Node (type stripping),
 * so keep it self-contained: `esbuild` is its only import.
 *
 * Usage: `pnpm run build:iife` (part of `pnpm run build`, after tsdown).
 */

import { build } from 'esbuild';

await build({
  entryPoints: ['src/browser.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'ModernPdf',
  outfile: 'dist/modern-pdf-lib.iife.js',
  target: 'es2022',
  platform: 'browser',
  minify: true,
  treeShaking: true,
});
