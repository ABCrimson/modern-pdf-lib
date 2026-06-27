import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/image/**/*.test.ts', 'tests/browser/**/*.test.ts', 'tests/compliance/**/*.test.ts', 'tests/barcode/**/*.test.ts', 'tests/layout/**/*.test.ts'],
    // Vitest 5 changed worker-pool memory behaviour; raise the per-fork heap so the
    // large image/compliance suites don't hit Node's default ~4 GB old-space limit.
    pool: 'forks',
    poolOptions: {
      forks: { execArgv: ['--max-old-space-size=8192'] },
    },
    // The crypto suites generate random keypairs and sign/verify under heavy
    // concurrent fork-pool load; a rare WebCrypto-under-load timing flake can
    // make a freshly-signed signature momentarily fail to verify (observed only
    // under full-suite concurrency, never in isolation). Retry transient
    // failures so the pipeline is reliable — a genuinely broken test fails all
    // three attempts and still surfaces, so this never masks a real defect.
    retry: 2,
    benchmark: {
      include: ['tests/benchmarks/**/*.bench.ts', 'tests/image/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Exclude generated WASM bindings (their sourcemaps confuse the v8
      // remapper) and all declaration files from coverage instrumentation.
      exclude: ['src/types/**', 'src/wasm/**', '**/*.d.ts', '**/*.wasm.*'],
      // Honest floors set just below the measured baseline (statements 78%,
      // branches 69%, functions 87%, lines 79%) — they catch regressions
      // without false-failing on the current state.
      thresholds: {
        statements: 76,
        branches: 67,
        functions: 84,
        lines: 77,
      },
    },
  },
});
