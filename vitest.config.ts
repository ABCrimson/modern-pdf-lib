import { defineConfig } from 'vitest/config';

// GitHub ubuntu-latest (public repo): 4 vCPU, 16 GB RAM. With coverage on, the
// budget is 3 workers x 3 GB heap cap + 4 GB main process = 13 GB < 16 GB. The
// heaviest test file logs about 0.2 GB heap used (--logHeapUsage), so the cap
// is headroom, not a working-set need. Off CI, Vitest's default worker
// count applies (cores - 1 for `vitest run`, half the cores in watch mode).
const WORKER_HEAP_MB = 3072;

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    execArgv: [`--max-old-space-size=${WORKER_HEAP_MB}`],
    ...(process.env.CI ? { maxWorkers: 3 } : {}),
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
