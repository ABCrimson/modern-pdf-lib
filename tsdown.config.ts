import { defineConfig } from 'tsdown';

export default defineConfig([
  // Main ESM + CJS build
  {
    entry: ['src/index.ts', 'src/browser.ts', 'src/create.ts', 'src/parse.ts', 'src/forms.ts', 'src/cli/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'esnext',
    splitting: true,
    treeshake: true,
    sourcemap: true,
    deps: {
      neverBundle: ['node:fs/promises', 'node:path', 'node:worker_threads'],
    },
    esbuildOptions: {
      platform: 'neutral',
    },
  },
  // IIFE bundle for script-tag usage (window.ModernPdf)
  {
    entry: { 'modern-pdf-lib.iife': 'src/browser.ts' },
    format: ['iife'],
    globalName: 'ModernPdf',
    target: 'es2022',
    treeshake: true,
    sourcemap: false,
    minify: true,
    platform: 'browser',
  },
]);
