import { defineConfig } from 'vitest/config';

// GitHub ubuntu-latest (public repo): 4 vCPU, 16 GB RAM. With coverage on, the
// budget is 3 workers x 3 GB heap cap + 4 GB main process = 13 GB < 16 GB. The
// heaviest test file logs about 0.2 GB heap used (--logHeapUsage), so the cap
// is headroom, not a working-set need. Off CI, Vitest's default worker
// count applies (cores - 1 for `vitest run`, half the cores in watch mode).
const WORKER_HEAP_MB = 3072;

// The crypto suites generate random keypairs and sign/verify under heavy
// concurrent fork-pool load; a rare WebCrypto-under-load timing flake can
// make a freshly-signed signature momentarily fail to verify (observed only
// under full-suite concurrency, never in isolation). The unit and integration
// projects retry transient failures so the pipeline is reliable: a genuinely
// broken test fails all three attempts and still surfaces. The oracle and
// adversarial projects never retry: a failure there is a result, not a flake.
const FLAKE_RETRY = 2;

// `vitest bench` adds a "<name> (bench)" variant of every project, collecting
// that project's `benchmark.include` (Vitest's default matches every
// *.bench.ts). The unit project owns the bench files; the others list none,
// so each bench file runs once.
const NO_BENCHMARKS = { include: [] };

// Four projects, selected by include glob; no test file moves between
// directories. `node scripts/dev/test-projects.ts --check` fails when a
// tests/**/*.test.ts file matches no project or more than one.
// `extends: true` (the Vitest 5.1 default, written out) gives every project
// the root options below: pool, execArgv, the CI test timeout and the CI worker cap (which the
// adversarial project's `fileParallelism: false` replaces with one worker).
export default defineConfig({
  test: {
    pool: 'forks',
    // Tests pass options that have no effect and open legacy files on purpose, so the library's
    // runtime warnings (type ModernPdfLibWarning) would print on stderr. The flag stops Node from
    // printing that type only: `process.emitWarning` is still called, so a test asserts on a spy
    // of it (or on a `process.on('warning')` listener, which still fires).
    execArgv: [`--max-old-space-size=${WORKER_HEAP_MB}`, '--disable-warning=ModernPdfLibWarning'],
    // The hosted runners are slower than a developer machine, and coverage slows the heaviest
    // tests further: under CI a test may run 60 s (Vitest's default is 5 s).
    ...(process.env.CI ? { maxWorkers: 3, testTimeout: 60_000 } : {}),
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            'tests/unit/**/*.test.ts',
            'tests/barcode/**/*.test.ts',
            'tests/compliance/**/*.test.ts',
            'tests/image/**/*.test.ts',
            'tests/layout/**/*.test.ts',
            'tests/browser/**/*.test.ts',
          ],
          retry: FLAKE_RETRY,
          benchmark: {
            include: ['tests/benchmarks/**/*.bench.ts', 'tests/image/**/*.bench.ts'],
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          retry: FLAKE_RETRY,
          benchmark: NO_BENCHMARKS,
        },
      },
      {
        extends: true,
        test: {
          name: 'oracle',
          include: ['tests/oracle/**/*.test.ts'],
          retry: 0,
          // Fails a plain test whose written PDFs did not all go through qpdf.
          setupFiles: ['tests/helpers/oracle/setup.ts'],
          // Each case spawns qpdf and opens pdf.js.
          testTimeout: 30_000,
          benchmark: NO_BENCHMARKS,
        },
      },
      {
        extends: true,
        test: {
          name: 'adversarial',
          include: ['tests/adversarial/**/*.test.ts'],
          retry: 0,
          // One file at a time (Vitest sets this project's maxWorkers to 1, over the CI
          // cap): the budgeted runner (tests/helpers/budget.ts) measures time and resident
          // memory, so no other adversarial file may compete with it for the CPU.
          fileParallelism: false,
          benchmark: NO_BENCHMARKS,
        },
      },
    ],
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
