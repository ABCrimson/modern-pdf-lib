/**
 * Standalone benchmark runner — `pnpm run bench`.
 *
 * Imports the benchmark definitions (which register themselves via the
 * tinybench-backed harness) and executes them. Decoupled from Vitest so the
 * pdf-lib performance comparison runs reliably at every minor-version boundary.
 */

import './comparison.js';
import { runRegisteredBenchmarks } from './bench-harness.js';

await runRegisteredBenchmarks();
