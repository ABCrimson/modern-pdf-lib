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
    benchmark: {
      include: ['tests/benchmarks/**/*.bench.ts', 'tests/image/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/wasm/*/pkg/**'],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 85,
      },
    },
  },
});
