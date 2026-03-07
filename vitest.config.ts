import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/image/**/*.test.ts'],
    benchmark: {
      include: ['tests/benchmarks/**/*.bench.ts', 'tests/image/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/wasm/*/pkg/**'],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 85,
      },
    },
  },
});
