import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
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
});
