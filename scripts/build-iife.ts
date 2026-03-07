/**
 * Standalone IIFE build script using esbuild directly.
 *
 * Produces dist/modern-pdf-lib.iife.js with a global `window.ModernPdf`
 * for legacy script-tag usage without a bundler.
 *
 * Usage: npx tsx scripts/build-iife.ts
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

console.log('Built dist/modern-pdf-lib.iife.js');
