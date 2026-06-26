/**
 * Standalone benchmark runner — `npm run bench`.
 *
 * Imports the benchmark definitions (which register themselves via the
 * tinybench-backed harness) and executes them. Decoupled from Vitest so the
 * pdf-lib performance comparison runs reliably at every minor-version boundary.
 */

import './comparison.bench.js';
import { runRegisteredBenchmarks } from './benchHarness.js';

await runRegisteredBenchmarks();
