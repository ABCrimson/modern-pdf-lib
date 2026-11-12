/**
 * G-CAP: every capability row of the docs is pinned to evidence in docs/capabilities.json.
 *
 *   node scripts/dev/capability-gate.ts                    static mode: row matching both ways,
 *                                                          the fields of every JSON row, every
 *                                                          `tests` tag has a `capability: [...]`
 *                                                          site in tests/ (text scan), counts per
 *                                                          grade; `not run: N rows` is a warning
 *   node scripts/dev/capability-gate.ts --report <json>    report mode: the static checks, then every
 *                                                          `tests` tag of an oracle or behaviour row
 *                                                          has at least one passed result in the
 *                                                          Vitest JSON report whose meta.capability
 *                                                          holds it and whose meta.ledger is unset
 *                                                          (a passing knownDefect() marker is
 *                                                          reported as passed and is not evidence);
 *                                                          a `pending` row fails here
 *   node scripts/dev/capability-gate.ts --census           prints the rows of every region as JSON
 *                                                          lines ({ region, doc, text }) and exits
 *
 * A region is the text between `<!-- capabilities:begin <region-id> -->` and
 * `<!-- capabilities:end -->` in README.md or a page under docs/. Its rows are the Markdown list
 * items (`- ...`), the Markdown table rows (the header row and the separator row excluded) and
 * the HTML `<tr>` rows with at least two `<td>` cells and no list inside them (of those, the
 * first two cells: the label and the modern-pdf-lib cell of the README comparison table; a
 * layout cell that holds a list contributes its items instead). A row's text is its visible text: HTML
 * tags removed, the entities used in the docs decoded, Markdown links reduced to their text,
 * emphasis and code marks removed, cells joined by ` | `, whitespace runs collapsed to one space.
 *
 * Grades (docs/capabilities.json `rows[].grade`):
 *   oracle     a passing plain test tagged with the row's `tests` judges the output with a tool
 *              outside the library (qpdf, pdf.js, node:crypto)
 *   behaviour  the claim is not about PDF bytes (packaging, CI, runtimes, browser helpers), or it is
 *              a row that names an API or a refusal rather than a property of written PDF bytes;
 *              a passing tagged test of any project
 *   qualified  `limits` names at least one id that is open in audit/open-highs.json; `stated` says
 *              whether the row's visible text already states the limit (false: the docs owe a
 *              wording change, printed as a warning)
 *   pending    not graded yet: a warning in static mode, a failure in report mode
 *
 * Exit 1 on any problem, each printed with the offending row. Node strips the types, so only
 * erasable syntax is used.
 *
 * In 0.40.6 the gate reports and does not block on the docs: a `qualified` row
 * whose text does not state its limit yet (`stated: false`) is counted in a warning, not a
 * problem. It becomes a problem after the docs pass that states the limits. A row is graded
 * `oracle` only when its test calls the row's API with the default options, exercises every item
 * the row names, and no open ledger entry of the same area names the same API or output.
 */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    report: { type: 'string' },
    census: { type: 'boolean', default: false },
    root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
  },
});

const ROOT = values.root;
const GRADES = new Set(['oracle', 'behaviour', 'qualified', 'pending']);
const ID = /^cap-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const problems: string[] = [];
const warnings: string[] = [];

/** One row found in a docs region. */
export interface DocRow {
  readonly region: string;
  readonly doc: string;
  readonly text: string;
}

const ENTITIES: Readonly<Record<string, string>> = {
  '&rarr;': '→',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** The visible text of a Markdown or HTML fragment (see the header). */
export function visibleText(fragment: string): string {
  // Odd parts are Markdown code spans: shown as written, so `Promise<Uint8Array>` keeps its <...>.
  return fragment
    .split('`')
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/<[^>]+>/g, '')
            .replace(/&[a-z#0-9]+;/g, (e) => ENTITIES[e] ?? e)
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\*\*|__/g, ''),
    )
    .join('')
    .replaceAll('\\|', '|')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEPARATOR = /^\|[\s:|-]+\|?\s*$/;

/** The cells of a Markdown table row, split on unescaped pipes. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map(visibleText);
}

/** The rows of one region body (see the header). */
export function regionRows(body: string): string[] {
  const rows: string[] = [];
  const lines = body.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (/^\s*- /.test(line)) rows.push(visibleText(line.replace(/^\s*- /, '')));
    else if (/^\s*\|/.test(line)) {
      if (SEPARATOR.test(line.trim())) continue;
      if (SEPARATOR.test((lines[i + 1] ?? '').trim())) continue;
      rows.push(cells(line).join(' | '));
    }
  }
  for (const tr of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const raw = [...(tr[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1] ?? '');
    // A layout cell that holds a Markdown list (README ## Features) is not a row: its items are.
    if (raw.length < 2 || raw.some((cell) => /^\s*- /m.test(cell))) continue;
    rows.push(`${visibleText(raw[0] ?? '')} | ${visibleText(raw[1] ?? '')}`);
  }
  return rows;
}

const BEGIN = /<!-- capabilities:begin ([a-z0-9-]+) -->/g;
const END = '<!-- capabilities:end -->';

/** Every row of every region in README.md and docs/**\/*.md. */
export function docRows(root: string): DocRow[] {
  const docs = [
    'README.md',
    ...globSync('docs/**/*.md', { cwd: root }).map((p) => p.replaceAll('\\', '/')),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const rows: DocRow[] = [];
  const regions = new Set<string>();
  for (const doc of docs) {
    const text = readFileSync(resolve(root, doc), 'utf8');
    for (const match of text.matchAll(BEGIN)) {
      const region = match[1] ?? '';
      if (regions.has(region)) problems.push(`${doc}: region ${region} is defined twice`);
      regions.add(region);
      const start = (match.index ?? 0) + match[0].length;
      const end = text.indexOf(END, start);
      const next = text.indexOf('<!-- capabilities:begin', start);
      if (end === -1 || (next !== -1 && next < end)) {
        problems.push(`${doc}: region ${region} has no ${END} before the next region`);
        continue;
      }
      for (const row of regionRows(text.slice(start, end))) rows.push({ region, doc, text: row });
    }
  }
  return rows;
}

if (values.census) {
  for (const row of docRows(ROOT)) console.log(JSON.stringify(row));
  process.exit(problems.length === 0 ? 0 : 1);
}

interface CapRow extends DocRow {
  readonly id: string;
  readonly grade: string;
  readonly tests: readonly string[];
  readonly limits: readonly string[];
  readonly stated?: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function readRows(): CapRow[] {
  const data: unknown = JSON.parse(readFileSync(resolve(ROOT, 'docs/capabilities.json'), 'utf8'));
  if (!isRecord(data) || data.format !== 1 || !Array.isArray(data.rows)) {
    problems.push('docs/capabilities.json: not { "format": 1, "rows": [...] }');
    return [];
  }
  const rows: CapRow[] = [];
  for (const [i, r] of data.rows.entries()) {
    const at = isRecord(r) && typeof r.id === 'string' ? r.id : `rows[${i}]`;
    if (
      !isRecord(r) ||
      typeof r.id !== 'string' ||
      typeof r.region !== 'string' ||
      typeof r.doc !== 'string' ||
      typeof r.text !== 'string' ||
      typeof r.grade !== 'string' ||
      !isStrings(r.tests) ||
      !isStrings(r.limits) ||
      (r.stated !== undefined && typeof r.stated !== 'boolean')
    ) {
      problems.push(
        `${at}: needs id, region, doc, text, grade (strings), tests, limits (string arrays)`,
      );
      continue;
    }
    rows.push(r as unknown as CapRow);
  }
  return rows;
}

/** The ids of `open` in the public ledger. */
function openIds(): Set<string> {
  const ledger: unknown = JSON.parse(readFileSync(resolve(ROOT, 'audit/open-highs.json'), 'utf8'));
  const open = isRecord(ledger) && Array.isArray(ledger.open) ? ledger.open : [];
  return new Set(open.filter(isRecord).map((e) => String(e.id)));
}

/** Every string literal inside a `capability: [...]` array in tests/**\/*.ts. */
function taggedInTests(): Set<string> {
  const tags = new Set<string>();
  for (const file of globSync('tests/**/*.ts', { cwd: ROOT })) {
    const text = readFileSync(resolve(ROOT, file), 'utf8');
    for (const list of text.matchAll(/capability:\s*\[([^\]]*)\]/g)) {
      for (const lit of (list[1] ?? '').matchAll(/'([^']+)'|"([^"]+)"/g)) {
        tags.add(lit[1] ?? lit[2] ?? '');
      }
    }
  }
  return tags;
}

interface ReportResult {
  readonly status: string;
  readonly meta?: { readonly capability?: readonly string[]; readonly ledger?: unknown };
}

/** The tags of the passed, non-marker results of a Vitest JSON report. */
function passedTags(file: string): Set<string> {
  const report: unknown = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const passed = new Set<string>();
  const suites = isRecord(report) && Array.isArray(report.testResults) ? report.testResults : [];
  for (const suite of suites.filter(isRecord)) {
    const results = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
    for (const r of results as ReportResult[]) {
      if (r.status !== 'passed' || r.meta?.ledger !== undefined) continue;
      for (const tag of r.meta?.capability ?? []) passed.add(tag);
    }
  }
  return passed;
}

const docs = docRows(ROOT);
const rows = readRows();
const open = openIds();
const tagged = taggedInTests();
const passed = values.report === undefined ? undefined : passedTags(values.report);

const key = (r: DocRow): string => `${r.doc}\u0000${r.region}\u0000${r.text}`;
const docCount = new Map<string, number>();
for (const d of docs) docCount.set(key(d), (docCount.get(key(d)) ?? 0) + 1);
const jsonCount = new Map<string, number>();
for (const r of rows) jsonCount.set(key(r), (jsonCount.get(key(r)) ?? 0) + 1);

for (const d of docs) {
  if ((jsonCount.get(key(d)) ?? 0) < (docCount.get(key(d)) ?? 0)) {
    problems.push(`${d.doc} [${d.region}] row without a JSON row: "${d.text}"`);
    jsonCount.set(key(d), (jsonCount.get(key(d)) ?? 0) + 1);
  }
}
const ids = new Set<string>();
let unstated = 0;
let notRun = 0;
const counts: Record<string, number> = { oracle: 0, behaviour: 0, qualified: 0, pending: 0 };
for (const r of rows) {
  if (!ID.test(r.id)) problems.push(`${r.id}: an id is cap-<kebab-case>`);
  if (ids.has(r.id)) problems.push(`${r.id}: id used twice`);
  ids.add(r.id);
  if ((docCount.get(key(r)) ?? 0) === 0) {
    problems.push(`${r.id}: text not found in ${r.doc} [${r.region}]: "${r.text}"`);
  }
  if (!GRADES.has(r.grade)) {
    problems.push(`${r.id}: grade "${r.grade}" is not oracle, behaviour, qualified or pending`);
    continue;
  }
  counts[r.grade] = (counts[r.grade] ?? 0) + 1;
  for (const tag of r.tests) {
    if (!tagged.has(tag)) problems.push(`${r.id}: no test in tests/ carries capability "${tag}"`);
  }
  if (r.grade === 'pending') {
    if (passed === undefined) warnings.push(`${r.id}: pending (not graded yet)`);
    else problems.push(`${r.id}: pending; a report run needs every row graded`);
  }
  if ((r.grade === 'oracle' || r.grade === 'behaviour') && r.tests.length === 0) {
    problems.push(`${r.id}: grade ${r.grade} needs at least one tests tag`);
  }
  if (r.grade === 'qualified') {
    if (r.limits.length === 0) problems.push(`${r.id}: grade qualified needs a limits id`);
    if (r.stated === false) unstated++;
  }
  for (const id of r.limits) {
    if (!open.has(id)) problems.push(`${r.id}: limit ${id} is not open in audit/open-highs.json`);
  }
  if (r.grade === 'oracle' || r.grade === 'behaviour') {
    if (passed === undefined) notRun++;
    else {
      for (const tag of r.tests) {
        if (!passed.has(tag))
          problems.push(`${r.id}: no passed test carries "${tag}" in the report`);
      }
    }
  }
}

console.log(
  `capability-gate: ${rows.length} rows, ${docs.length} doc rows; ` +
    `oracle ${counts.oracle}, behaviour ${counts.behaviour}, qualified ${counts.qualified}, pending ${counts.pending}`,
);
if (unstated > 0) {
  console.log(`warning: qualified but the text does not state the limit yet: ${unstated} rows`);
}
if (notRun > 0) console.log(`warning: not run: ${notRun} rows (pass --report <vitest-json>)`);
if (warnings.length > 0) console.log(`warning: pending: ${warnings.length} rows`);
for (const p of problems) console.error(p);
console.log(problems.length === 0 ? 'capability-gate: ok' : `${problems.length} problems`);
process.exit(problems.length === 0 ? 0 : 1);
