import { defineConfig } from 'tsdown';

const entry = [
  'src/index.ts',
  'src/browser.ts',
  'src/create.ts',
  'src/parse.ts',
  'src/forms.ts',
  'src/cli/index.ts',
];

const shared = {
  entry,
  format: ['esm', 'cjs'] as const,
  target: 'esnext' as const,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: ['node:fs/promises', 'node:path', 'node:worker_threads'],
  },
  esbuildOptions: {
    platform: 'neutral' as const,
  },
};

// Two-pass build to work around a rolldown-plugin-dts contamination bug
// (tsdown 0.22 / rolldown-plugin-dts 0.26): when `dts: true` runs in the same
// pass as the value bundle, the dts plugin leaks type-only re-exports
// (e.g. `export type { AFRelationship }`) into the runtime value graph as
// unbound `export { … }` statements. That makes every ESM entry throw
// `SyntaxError: Export 'X' is not defined in module` at link time — shipped
// broken in v0.28.0. Separating the passes keeps the value graph pristine.
//
//   Pass 1 (dist/)        — value bundle only, `dts: false`  → clean .mjs/.cjs
//   Pass 2 (dist-types/)  — declarations only-ish, `dts: true`
// `scripts/finalize-dts.mjs` then copies the .d.mts/.d.cts (+ maps) from
// dist-types/ into dist/ and removes the temp dir. A post-build
// `scripts/smoke-dist.mjs` import gate guarantees the artifact is importable.
export default defineConfig([
  { ...shared, dts: false, clean: true, outDir: 'dist' },
  { ...shared, dts: true, clean: true, outDir: 'dist-types' },
]);
