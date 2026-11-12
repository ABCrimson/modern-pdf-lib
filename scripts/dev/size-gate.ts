/**
 * Size gate: measures what a consumer's bundler ships from the BUILT package (dist/) and holds
 * each measurement to a ratchet budget in scripts/dev/size-budget.json.
 *
 *   node scripts/dev/size-gate.ts                 measure, check the budgets and the README badge,
 *                                                 print a Markdown table (CI appends it to
 *                                                 $GITHUB_STEP_SUMMARY)
 *   node scripts/dev/size-gate.ts --update        write the budgets from this measurement:
 *                                                 measured + 2%, rounded up to the next 1,024 B
 *   --budget <file>   another budget file (default: scripts/dev/size-budget.json)
 *
 * Measurements (gzip level 9 and brotli quality 11 through node:zlib):
 *   createPdf  esbuild bundle of `export { createPdf } from './dist/index.mjs'` (the create path;
 *              the README badge figure)
 *   loadPdf    `export { loadPdf } from './dist/index.mjs'` (the parse path)
 *   root       `export * from './dist/index.mjs'`
 *   create, parse, forms, browser
 *              `export * from './dist/<entry>.mjs'`
 *   iife       dist/modern-pdf-lib.iife.js as shipped (not rebundled)
 * Each bundle uses the installed esbuild with bundle, minify, format esm, platform neutral,
 * mainFields module then main, and `node:*` external.
 *
 * A measurement fails when it exceeds its budget, and when it is more than 10% under it while
 * `--update` would write a lower budget (lower it in the same change). The second condition
 * keeps a small bundle, whose 1,024 B rounding alone exceeds 10%, from failing on a fresh
 * budget. The README badge `createPdf_bundle-<n>_KiB_gzip`
 * must state Math.round(createPdf gzip / 1024). Exit 1 on any failure, each named. Run it after
 * `pnpm run build`; it does not build. Node strips the types, so only erasable syntax is used.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const ROOT = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({
  options: {
    update: { type: 'boolean', default: false },
    budget: { type: 'string', default: resolve(ROOT, 'scripts/dev/size-budget.json') },
  },
});
const BUDGET_FILE = resolve(values.budget);
/** Headroom of a new budget, and how far under it a measurement may fall before it must ratchet. */
const HEADROOM = 0.02;
const RATCHET = 0.1;

interface Sizes {
  readonly raw: number;
  readonly gzip: number;
  readonly brotli: number;
}

/** Bundle sources, in table order; `undefined` measures dist/modern-pdf-lib.iife.js as is. */
const MEASUREMENTS: ReadonlyArray<readonly [string, string | undefined]> = [
  ['createPdf', "export { createPdf } from './dist/index.mjs';"],
  ['loadPdf', "export { loadPdf } from './dist/index.mjs';"],
  ['root', "export * from './dist/index.mjs';"],
  ['create', "export * from './dist/create.mjs';"],
  ['parse', "export * from './dist/parse.mjs';"],
  ['forms', "export * from './dist/forms.mjs';"],
  ['browser', "export * from './dist/browser.mjs';"],
  ['iife', undefined],
];

function sizes(bytes: Uint8Array): Sizes {
  return {
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
      },
    }).length,
  };
}

async function bundle(contents: string): Promise<Uint8Array> {
  const result = await build({
    stdin: { contents, resolveDir: ROOT, sourcefile: 'size-gate-entry.js', loader: 'js' },
    absWorkingDir: ROOT,
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    external: ['node:*'],
    write: false,
    logLevel: 'error',
  });
  const [out] = result.outputFiles;
  if (out === undefined) throw new Error('esbuild wrote no output');
  return out.contents;
}

const budgetOf = (n: number): number => Math.ceil((n * (1 + HEADROOM)) / 1024) * 1024;
const fmt = (n: number): string => n.toLocaleString('en-US');

if (!existsSync(resolve(ROOT, 'dist/index.mjs'))) {
  console.error('size-gate: dist/index.mjs is absent; run `pnpm run build` first');
  process.exit(1);
}

const measured = new Map<string, Sizes>();
for (const [name, contents] of MEASUREMENTS) {
  const bytes =
    contents === undefined
      ? new Uint8Array(readFileSync(resolve(ROOT, 'dist/modern-pdf-lib.iife.js')))
      : await bundle(contents);
  measured.set(name, sizes(bytes));
}

if (values.update) {
  const budgets = Object.fromEntries(
    [...measured].map(([name, s]) => [
      name,
      { gzip: budgetOf(s.gzip), brotli: budgetOf(s.brotli) },
    ]),
  );
  writeFileSync(BUDGET_FILE, `${JSON.stringify(budgets, null, 2)}\n`);
  console.error(
    `size-gate: wrote ${measured.size} budgets to ${relative(ROOT, BUDGET_FILE).replaceAll('\\', '/')}`,
  );
}

type Budgets = Record<string, { readonly gzip: number; readonly brotli: number } | undefined>;
const budgets = (
  existsSync(BUDGET_FILE) ? JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) : {}
) as Budgets;
const problems: string[] = [];
const lines = [
  '| bundle | raw (B) | gzip (B) | gzip budget | brotli (B) | brotli budget |',
  '|---|---:|---:|---:|---:|---:|',
];
for (const [name, s] of measured) {
  const budget = budgets[name];
  if (budget === undefined) {
    problems.push(`${name}: no budget in ${relative(ROOT, BUDGET_FILE).replaceAll('\\', '/')}`);
    lines.push(`| ${name} | ${fmt(s.raw)} | ${fmt(s.gzip)} | none | ${fmt(s.brotli)} | none |`);
    continue;
  }
  for (const method of ['gzip', 'brotli'] as const) {
    const size = s[method];
    const limit = budget[method];
    if (size > limit)
      problems.push(`${name} ${method}: ${fmt(size)} B exceeds the budget ${fmt(limit)} B`);
    else if (size < limit * (1 - RATCHET) && budgetOf(size) < limit)
      problems.push(
        `${name} ${method}: ${fmt(size)} B is more than 10% under the budget ${fmt(limit)} B; lower it (--update)`,
      );
  }
  lines.push(
    `| ${name} | ${fmt(s.raw)} | ${fmt(s.gzip)} | ${fmt(budget.gzip)} | ${fmt(s.brotli)} | ${fmt(budget.brotli)} |`,
  );
}
for (const name of Object.keys(budgets)) {
  if (!measured.has(name)) problems.push(`${name}: budget without a measurement`);
}

const createPdf = measured.get('createPdf');
const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
const badge = /createPdf_bundle-(\d+)_KiB_gzip/.exec(readme);
if (createPdf !== undefined) {
  const kib = Math.round(createPdf.gzip / 1024);
  if (badge === null) problems.push('README.md: no createPdf_bundle-<n>_KiB_gzip badge');
  else if (Number(badge[1]) !== kib)
    problems.push(`README.md: the badge says ${badge[1]} KiB, createPdf gzip is ${kib} KiB`);
}

console.log(`### Bundle sizes\n\n${lines.join('\n')}\n`);
for (const p of problems) console.error(`size-gate: ${p}`);
console.error(problems.length === 0 ? 'size-gate: ok' : `size-gate: ${problems.length} problems`);
process.exit(problems.length === 0 ? 0 : 1);
