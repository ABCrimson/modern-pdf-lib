import { defineConfig } from 'tsdown';

/**
 * Single-pass build: the value bundle (.mjs/.cjs) and the declarations
 * (.d.mts/.d.cts) come out of one tsdown run into `dist/`.
 *
 * Invariant: verified on tsdown 0.23.7 + rolldown-plugin-dts 0.30.1 (whose
 * typescript peer accepts 7.1 dev builds) on 2026-11-10 that `dts: true` in the
 * same pass does not leak type-only re-exports into the runtime graph (the
 * v0.28.0 `Export 'X' is not defined in module` link failure).
 * `scripts/smoke-dist.mjs` (part of `pnpm run build`) links every built entry and
 * guards that class of bug; if it ever fails again, split the declarations into
 * a second config rather than ship it.
 *
 * Do not set `platform: 'neutral'`: it switches the emitted extensions to
 * `.js`, which the package.json `exports` map does not point at. On the default
 * `node` platform tsdown externalizes Node built-ins: the static `node:fs/promises`
 * import in src/cli and the dynamic `import('node:fs/promises')` in
 * src/wasm/loader.ts stay external in dist/. src/runtime/node.ts and
 * src/parser/streamingParser.ts load `node:fs`, `node:fs/promises` and
 * `node:worker_threads` through `Function`-built dynamic imports that the
 * bundler never sees.
 */
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/browser.ts',
    'src/create.ts',
    'src/parse.ts',
    'src/forms.ts',
    'src/cli/index.ts',
  ],
  format: ['esm', 'cjs'],
  target: 'esnext',
  treeshake: true,
  // 'hidden' writes the maps but leaves the `//# sourceMappingURL=` comment out of every
  // output, and package.json `files` does not ship the .mjs/.cjs maps (the output is
  // unminified and readable; shipping them doubled the tarball). `false` is not an option:
  // tsdown and rolldown-plugin-dts force source maps on while tsconfig.json sets
  // `declarationMap: true`, and then every bundle would carry a comment pointing at an
  // unshipped map. `scripts/check-pack.mjs` fails on any dangling map URL.
  sourcemap: 'hidden',
  // `isolatedDeclarations` is on in tsconfig.json, so rolldown-plugin-dts would
  // pick oxc anyway. The explicit pin keeps the generator from silently switching
  // to the experimental tsgo backend (TypeScript 7.1) if that flag is ever turned off.
  dts: { generator: 'oxc' },
  clean: true,
  outDir: 'dist',
});
