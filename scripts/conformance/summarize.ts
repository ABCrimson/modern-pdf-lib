/**
 * Turns the raw reports of one conformance oracle into a Markdown table and `summary.json`, and
 * classifies every row against scripts/conformance/expected.json.
 *
 *   node scripts/conformance/summarize.ts <verapdf|pyhanko> <reports-dir>
 *     [--manifest <manifest.json>] [--expected <expected.json>] [--json <summary.json>]
 *
 * Inputs: for `verapdf`, the `verapdf-<flavour>.json` files that scripts/verapdf-validate.ts writes
 * (veraPDF's own `--format json` output, one file per flavour group) and its optional `tools.json`;
 * for `pyhanko`, the per-file JSON reports of scripts/conformance/hanko-report.py. The manifest of
 * scripts/conformance/generate.ts, when given, supplies the writer call of each veraPDF row.
 *
 * Every row gets a verdict (veraPDF: compliant, non-compliant, parse-failure, or incomplete when
 * veraPDF ended the job early; pyHanko: valid, invalid, no-signature-found, parse-failure) and a
 * sorted list of failures: veraPDF's failed rules
 * as `<clause>-<test number>`, or the names of the pyHanko checks below that fail. Against its
 * expectation a row is "as expected" (same verdict, same failures), "better" (a higher verdict or
 * the same verdict, with no failure that the expectation does not list, and fewer failures when the
 * verdict is the same; after an expected parse failure any higher verdict is better), "worse"
 * (anything else), "no expectation" (expected.json has no entry) or "missing" (expected.json has an
 * entry and no report has the row). A pyHanko row whose CLI run did not exit 0 (a failure, a crash
 * or the timeout) carries `cli-not-valid` and is never "better": it reads "as expected" when the
 * expectation lists exactly its verdict and failures, "worse" otherwise, and "differs from expected"
 * when its expectation is withheld.
 *
 * A row that expected.json marks `"withheld": true` stands for a finding whose ledger id is not
 * public, so neither expected.json nor anything this script writes states its substance: such a
 * row has no verdict, failures or ids in expected.json, it reads "differs from expected" (or
 * "better" once it passes) with its verdict, failures and detail left out, and its raw report in
 * `<reports-dir>` is reduced before the workflow uploads the directory (the pyHanko JSON keeps file,
 * case and writer; the veraPDF job and the batch summary leave its flavour's JSON; the error file of a flavour that wrote
 * no JSON is replaced by one line). This runs also when no report could be read.
 *
 * expected.json cites ledger ids (audit/open-highs.json) or `unfiled:<slug>` keys for findings
 * that have no id yet (defined in its `unfiled` map). The summary lists the ids whose every row
 * now passes (the release checklist then removes the expectation), the ids on rows that got
 * better, and the unfiled keys in use. An id that is neither open in the ledger nor an unfiled key
 * is a warning, never a failure.
 *
 * Report-only: the verdicts never decide the exit code. Exit 0 when at least one report was read,
 * 1 when the directory holds no report of the tool (a broken harness must be noticed), 2 on bad
 * arguments. The table goes to stdout and is appended to `$GITHUB_STEP_SUMMARY` when that is set;
 * summary.json goes to `--json` or `<reports-dir>/summary.json`.
 *
 * Node builtins only, so `node` runs this file through its type stripping.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export type Tool = 'verapdf' | 'pyhanko';
export type Status =
  | 'as expected'
  | 'better'
  | 'worse'
  | 'differs from expected'
  | 'no expectation'
  | 'missing';

/** One validated file (pyHanko) or one file under one flavour (veraPDF). */
export interface Row {
  /** `<file>#<flavour>` (veraPDF) or `<file>` (pyHanko); the key of expected.json. */
  readonly key: string;
  readonly file: string;
  readonly writer: string;
  /** veraPDF flavour or pyHanko signature case. */
  readonly target: string;
  readonly verdict: string;
  /** Failed veraPDF rules (`<clause>-<test>`) or failed pyHanko checks, sorted. */
  readonly failed: readonly string[];
  /** Short human-readable detail: rule counts, a parse error or the field-scan bottom lines. */
  readonly detail: string;
  readonly ids: readonly string[];
  readonly status: Status;
}

export interface Summary {
  readonly tool: Tool;
  /** Tool versions read from the reports (veraPDF build and core, Java; Python, pyHanko). */
  readonly tools: Readonly<Record<string, string>>;
  readonly rows: readonly Row[];
  readonly counts: Readonly<Record<Status, number>>;
  /** Ids whose every row now passes (compliant or valid, no failure). */
  readonly idsNowPassing: readonly string[];
  /** Ids cited by at least one row whose status is "better". */
  readonly idsOnBetterRows: readonly string[];
  /** `unfiled:<slug>` keys cited by the rows, with their description from expected.json. */
  readonly unfiled: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
}

/** One expectation of expected.json. */
interface Expectation {
  readonly verdict: string;
  readonly failed: readonly string[];
  readonly ids: readonly string[];
  /** The finding's id is not public: the row is reduced to "differs from expected". */
  readonly withheld: boolean;
}

interface Expectations {
  readonly unfiled: Readonly<Record<string, string>>;
  readonly rows: ReadonlyMap<string, Expectation>;
}

/** A row before it is compared with its expectation. */
type Observed = Omit<Row, 'ids' | 'status'>;

const VERDICT_RANK: Readonly<Record<string, number>> = {
  'parse-failure': 0,
  'no-signature-found': 1,
  'non-compliant': 1,
  invalid: 2,
  compliant: 3,
  valid: 3,
};

const STATUSES: readonly Status[] = [
  'as expected',
  'better',
  'worse',
  'differs from expected',
  'no expectation',
  'missing',
];

/** The pyHanko check that a CLI run which did not exit 0 fails. */
const CLI_FAILURE = 'cli-not-valid';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readExpectations(path: string, tool: Tool): Expectations {
  const json = readJson(path);
  if (!isObject(json)) throw new Error(`${path}: not a JSON object`);
  const unfiled: Record<string, string> = {};
  if (isObject(json.unfiled)) {
    for (const [key, text] of Object.entries(json.unfiled)) unfiled[key] = asString(text);
  }
  const rows = new Map<string, Expectation>();
  const section = json[tool];
  if (isObject(section)) {
    for (const [key, value] of Object.entries(section)) {
      if (!isObject(value)) continue;
      rows.set(key, {
        verdict: asString(value.verdict),
        failed: asArray(value.failed).map((v) => asString(v)),
        ids: asArray(value.ids).map((v) => asString(v)),
        withheld: value.withheld === true,
      });
    }
  }
  return { unfiled, rows };
}

/** Writer call per file name, from generate.ts's manifest. */
function readWriters(manifestPath: string | undefined): Map<string, string> {
  const writers = new Map<string, string>();
  if (manifestPath === undefined) return writers;
  const manifest = readJson(manifestPath);
  if (!isObject(manifest)) return writers;
  for (const entry of asArray(manifest.files)) {
    if (isObject(entry)) writers.set(asString(entry.file), asString(entry.writer));
  }
  return writers;
}

function readVeraPdf(
  dir: string,
  writers: ReadonlyMap<string, string>,
): { rows: Observed[]; tools: Record<string, string> } {
  const rows: Observed[] = [];
  const tools: Record<string, string> = {};
  const toolsFile = join(dir, 'tools.json');
  if (existsSync(toolsFile)) {
    const json = readJson(toolsFile);
    if (isObject(json)) {
      for (const [name, value] of Object.entries(json)) tools[name] = asString(value);
    }
  }
  const reports = readdirSync(dir)
    .filter((name) => /^verapdf-.+\.json$/.test(name))
    .sort();
  for (const name of reports) {
    const flavour = name.slice('verapdf-'.length, -'.json'.length);
    const json = readJson(join(dir, name));
    const report = isObject(json) && isObject(json.report) ? json.report : undefined;
    if (report === undefined) continue;
    // veraPDF versions its components apart: `apps` is the build (what `--version` prints and
    // tools.json records), `core` the validation core inside it.
    if (isObject(report.buildInformation)) {
      for (const detail of asArray(report.buildInformation.releaseDetails)) {
        if (!isObject(detail)) continue;
        if (detail.id === 'apps') tools.verapdf ??= asString(detail.version);
        if (detail.id === 'core') tools.verapdfCore = asString(detail.version);
      }
    }
    for (const job of asArray(report.jobs)) {
      if (!isObject(job)) continue;
      const file = basename(asString(isObject(job.itemDetails) ? job.itemDetails.name : ''));
      const base = {
        key: `${file}#${flavour}`,
        file,
        writer: writers.get(file) ?? '',
        target: flavour,
      };
      // veraPDF writes one taskException object per failed job; an array is read the same way.
      const exceptions = Array.isArray(job.taskException) ? job.taskException : [job.taskException];
      const exception = exceptions.find(isObject);
      if (exception !== undefined) {
        const message = asString(exception.exceptionMessage, asString(exception.exception));
        rows.push({
          ...base,
          verdict: exception.type === 'PARSE' ? 'parse-failure' : 'exception',
          failed: [],
          detail: message.replace(/^Exception: /, ''),
        });
        continue;
      }
      const results = asArray(job.validationResult).filter(isObject);
      if (results.length === 0) {
        rows.push({ ...base, verdict: 'no-result', failed: [], detail: 'no validation result' });
        continue;
      }
      for (const result of results) {
        // veraPDF ends a job early (cancelled at a failure cap, or a timeout) with a partial rule list.
        const endStatus = asString(result.jobEndStatus, 'normal');
        if (endStatus !== 'normal') {
          rows.push({
            ...base,
            verdict: 'incomplete',
            failed: [],
            detail: `veraPDF job ended ${endStatus}`,
          });
          continue;
        }
        const details = isObject(result.details) ? result.details : {};
        const failed = asArray(details.ruleSummaries)
          .filter(isObject)
          .filter((rule) => rule.status === 'failed' || rule.ruleStatus === 'FAILED')
          .map((rule) => `${asString(rule.clause)}-${String(rule.testNumber)}`);
        rows.push({
          ...base,
          verdict: result.compliant === true ? 'compliant' : 'non-compliant',
          failed: [...new Set(failed)].sort(),
          detail: `${String(details.passedRules)} rules pass, ${String(details.failedRules)} fail`,
        });
      }
    }
  }
  return { rows, tools };
}

/** Field-scan record of hanko-report.py. */
interface ScannedField {
  readonly field: string;
  readonly linkedFromCatalog: boolean;
  readonly bottomLine: boolean;
  readonly widgetPages: readonly number[];
  readonly error: string;
  /** /Reason, /Location and /ContactInfo of the signature dictionary; undefined when absent. */
  readonly reason: string | undefined;
  readonly location: string | undefined;
  readonly contactInfo: string | undefined;
  /** Transform methods of the /Reference entries (`/DocMDP`, `/FieldMDP`). */
  readonly referenceMethods: readonly string[];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function scannedField(value: Json): ScannedField {
  return {
    field: asString(value.field),
    linkedFromCatalog: value.linkedFromCatalog === true,
    bottomLine: value.bottomLine === true,
    widgetPages: asArray(value.widgetPages).filter((n): n is number => typeof n === 'number'),
    error: asString(value.error),
    reason: optionalString(value.reason),
    location: optionalString(value.location),
    contactInfo: optionalString(value.contactInfo),
    referenceMethods: asArray(value.referenceMethods).map((m) => asString(m)),
  };
}

/**
 * The pyHanko checks of one report. Every signed file: the CLI run exits 0 (`cli-not-valid`; it
 * exits 0 also when its reader finds no signature, so a failure, a crash or the timeout fails the
 * check), each field the scan finds is reachable from the catalog's /AcroForm
 * (`field-not-in-acroform`), each has a VALID bottom line (`field-scan-invalid`), the scan finds a
 * field (`no-signature-field`) and finds no field beyond the ones the generator signed
 * (`extra-signature-field`). Per case: `visible-page<n>` needs the widget on page n
 * (`widget-not-on-page-<n>`); `certified-docmdp` needs a catalog /Perms /DocMDP entry and a /DocMDP
 * reference in a signature (`no-docmdp`); `field-lock` needs a /FieldMDP reference (`no-fieldmdp`);
 * `ltv` needs a catalog /DSS (`no-dss`); `reason-location-contact` needs a signature dictionary with
 * /Reason, /Location and /ContactInfo (`no-reason-location-contact`).
 */
function hankoChecks(report: Json, fields: readonly ScannedField[]): string[] {
  const failed: string[] = [];
  const signedFields = new Set(asArray(report.fields).map((f) => asString(f)));
  const signatureCase = asString(report.case);
  const cli = isObject(report.cli) ? report.cli : {};
  const catalog = isObject(report.catalog) ? report.catalog : {};
  const methods = new Set(fields.flatMap((f) => f.referenceMethods));
  if (cli.exitCode !== 0) failed.push(CLI_FAILURE);
  if (fields.length === 0) failed.push('no-signature-field');
  if (fields.some((f) => !f.linkedFromCatalog)) failed.push('field-not-in-acroform');
  if (fields.some((f) => !f.bottomLine)) failed.push('field-scan-invalid');
  if (fields.some((f) => !signedFields.has(f.field))) failed.push('extra-signature-field');
  const visible = /^visible-page(\d+)$/.exec(signatureCase);
  if (visible !== null) {
    const page = Number(visible[1]);
    if (!fields.some((f) => f.widgetPages.includes(page)))
      failed.push(`widget-not-on-page-${page}`);
  }
  if (signatureCase === 'certified-docmdp') {
    const perms = asArray(catalog.perms).map((p) => asString(p));
    if (!perms.includes('/DocMDP') || !methods.has('/DocMDP')) failed.push('no-docmdp');
  }
  if (signatureCase === 'field-lock' && !methods.has('/FieldMDP')) failed.push('no-fieldmdp');
  if (signatureCase === 'ltv' && catalog.dss !== true) failed.push('no-dss');
  if (
    signatureCase === 'reason-location-contact' &&
    !fields.some(
      (f) => f.reason !== undefined && f.location !== undefined && f.contactInfo !== undefined,
    )
  )
    failed.push('no-reason-location-contact');
  return failed.sort();
}

function readPyHanko(dir: string): { rows: Observed[]; tools: Record<string, string> } {
  const rows: Observed[] = [];
  const tools: Record<string, string> = {};
  const reports = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'summary.json')
    .sort();
  for (const name of reports) {
    const report = readJson(join(dir, name));
    if (!isObject(report) || typeof report.file !== 'string' || !('verdict' in report)) continue;
    if (isObject(report.tools)) {
      for (const [tool, value] of Object.entries(report.tools)) tools[tool] = asString(value);
    }
    const fields = asArray(report.fieldScan).filter(isObject).map(scannedField);
    const detail =
      fields.length === 0
        ? asString(report.error, 'no signature field')
        : fields
            .map(
              (f) =>
                `${f.field}: ${f.bottomLine ? 'VALID' : 'INVALID'}` +
                `${f.linkedFromCatalog ? '' : ', not linked'}${f.error === '' ? '' : ` (${f.error})`}`,
            )
            .join('; ');
    rows.push({
      key: report.file,
      file: report.file,
      writer: asString(report.writer),
      target: asString(report.case),
      verdict: asString(report.verdict),
      failed: hankoChecks(report, fields),
      detail,
    });
  }
  return { rows, tools };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function compare(observed: Observed, expected: Expectation | undefined): Status {
  if (expected === undefined) return 'no expectation';
  if (expected.withheld) return passes(observed) ? 'better' : 'differs from expected';
  // A parse failure has no failure list to compare with, so any failure after it is not 'new'.
  const comparable = expected.verdict !== 'parse-failure';
  const newFailure = comparable && observed.failed.some((f) => !expected.failed.includes(f));
  if (observed.verdict === expected.verdict && sameSet(observed.failed, expected.failed))
    return 'as expected';
  // A CLI run that failed or timed out is never an improvement, whatever else changed.
  if (observed.failed.includes(CLI_FAILURE)) return 'worse';
  if (observed.verdict === expected.verdict) return newFailure ? 'worse' : 'better';
  const rank = VERDICT_RANK[observed.verdict] ?? -1;
  const expectedRank = VERDICT_RANK[expected.verdict] ?? -1;
  return rank > expectedRank && !newFailure ? 'better' : 'worse';
}

/** The row of a withheld finding: whether it passes, and nothing of what it observed. */
function withheldRow(observed: Observed, status: Status): Row {
  if (passes(observed)) return { ...observed, ids: [], status };
  return { ...observed, verdict: 'withheld', failed: [], detail: '', ids: [], status };
}

/**
 * Reduces the raw reports of withheld rows in `dir`, so the uploaded directory states no more than
 * the summary: a pyHanko report keeps file, case and writer; a veraPDF job and the batch
 * summary leave its flavour's JSON; the error file of a flavour that wrote no JSON is replaced by one line when the flavour has
 * a withheld row.
 */
function reduceWithheld(tool: Tool, dir: string, keys: ReadonlySet<string>): void {
  if (keys.size === 0) return;
  for (const name of readdirSync(dir)) {
    const errorReport = tool === 'verapdf' ? /^verapdf-(.+)\.error\.txt$/.exec(name) : null;
    if (errorReport !== null) {
      if ([...keys].some((key) => key.endsWith(`#${errorReport[1]}`)))
        writeFileSync(join(dir, name), 'withheld: veraPDF wrote no JSON report for this flavour\n');
      continue;
    }
    if (!name.endsWith('.json') || name === 'summary.json' || name === 'tools.json') continue;
    const path = join(dir, name);
    const json = readJson(path);
    if (!isObject(json)) continue;
    if (tool === 'pyhanko') {
      if (typeof json.file === 'string' && keys.has(json.file)) {
        const { file, case: signatureCase, writer } = json;
        const reduced = { file, case: signatureCase, writer, verdict: 'withheld' };
        writeFileSync(path, `${JSON.stringify(reduced, null, 2)}\n`);
      }
      continue;
    }
    const match = /^verapdf-(.+)\.json$/.exec(name);
    if (match === null || !isObject(json.report)) continue;
    const flavour = match[1];
    const jobs = asArray(json.report.jobs);
    const kept = jobs.filter((job) => {
      const item = isObject(job) && isObject(job.itemDetails) ? job.itemDetails.name : '';
      return !keys.has(`${basename(asString(item))}#${flavour}`);
    });
    if (kept.length === jobs.length) continue;
    // batchSummary counts the jobs by outcome (compliant, non-compliant, failed to parse), so it
    // would state the verdict class of a withheld job; it leaves with the jobs.
    const report = { ...json.report, jobs: kept, batchSummary: undefined };
    writeFileSync(path, `${JSON.stringify({ ...json, report })}\n`);
  }
}

function passes(row: Observed): boolean {
  return (row.verdict === 'compliant' || row.verdict === 'valid') && row.failed.length === 0;
}

/** Open ids of audit/open-highs.json, or undefined when the ledger is not there. */
function readLedger(path: string): { open: Set<string>; closed: Set<string> } | undefined {
  if (!existsSync(path)) return undefined;
  const json = readJson(path);
  if (!isObject(json)) return undefined;
  const ids = (list: unknown) =>
    new Set(
      asArray(list)
        .filter(isObject)
        .map((e) => asString(e.id)),
    );
  return { open: ids(json.open), closed: ids(json.closed) };
}

export interface SummarizeOptions {
  readonly expectedPath?: string;
  readonly ledgerPath?: string;
  readonly manifestPath?: string;
}

/** Reads the reports of `tool` in `dir`; undefined when the directory holds none. */
export function summarize(
  tool: Tool,
  dir: string,
  options: SummarizeOptions = {},
): Summary | undefined {
  const expectedPath =
    options.expectedPath ?? fileURLToPath(new URL('expected.json', import.meta.url));
  const ledgerPath =
    options.ledgerPath ?? fileURLToPath(new URL('../../audit/open-highs.json', import.meta.url));
  const read =
    tool === 'verapdf' ? readVeraPdf(dir, readWriters(options.manifestPath)) : readPyHanko(dir);
  const expectations = readExpectations(expectedPath, tool);
  // Every withheld expectation, observed or not: a flavour that wrote no JSON has no row.
  const withheld = new Set(
    [...expectations.rows].filter(([, e]) => e.withheld).map(([key]) => key),
  );
  reduceWithheld(tool, dir, withheld);
  if (read.rows.length === 0) return undefined;

  const rows: Row[] = read.rows.map((observed) => {
    const expected = expectations.rows.get(observed.key);
    const status = compare(observed, expected);
    if (expected?.withheld === true) return withheldRow(observed, status);
    return { ...observed, ids: expected?.ids ?? [], status };
  });
  const seen = new Set(rows.map((r) => r.key));
  for (const [key, expected] of expectations.rows) {
    if (seen.has(key)) continue;
    const [file = key, target = ''] = key.split('#');
    rows.push({
      key,
      file,
      writer: '',
      target,
      verdict: 'no report',
      failed: [],
      detail: expected.withheld ? '' : `expected ${expected.verdict}`,
      ids: expected.ids,
      status: 'missing',
    });
  }

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const row of rows) counts[row.status] += 1;

  const byId = new Map<string, Row[]>();
  for (const row of rows) {
    for (const id of row.ids) byId.set(id, [...(byId.get(id) ?? []), row]);
  }
  const idsNowPassing = [...byId]
    .filter(([, cited]) => cited.every(passes))
    .map(([id]) => id)
    .sort();
  const idsOnBetterRows = [...byId]
    .filter(([, cited]) => cited.some((r) => r.status === 'better'))
    .map(([id]) => id)
    .sort();

  const warnings: string[] = [];
  const unfiled: Record<string, string> = {};
  const ledger = readLedger(ledgerPath);
  if (ledger === undefined) warnings.push('audit/open-highs.json not found: ids were not checked');
  for (const id of [...byId.keys()].sort()) {
    if (id.startsWith('unfiled:')) {
      const text = expectations.unfiled[id];
      if (text === undefined) warnings.push(`${id} is not defined in expected.json's unfiled map`);
      else unfiled[id] = text;
    } else if (ledger !== undefined && !ledger.open.has(id)) {
      warnings.push(
        ledger.closed.has(id) ? `${id} is closed in the ledger` : `${id} is not in the ledger`,
      );
    }
  }
  return {
    tool,
    tools: read.tools,
    rows,
    counts,
    idsNowPassing,
    idsOnBetterRows,
    unfiled,
    warnings,
  };
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderMarkdown(summary: Summary): string {
  const name = summary.tool === 'verapdf' ? 'veraPDF' : 'pyHanko';
  const versions = Object.entries(summary.tools)
    .map(([tool, version]) => `${tool} ${version}`)
    .join(', ');
  const counts = STATUSES.filter((s) => summary.counts[s] > 0)
    .map((s) => `${summary.counts[s]} ${s}`)
    .join(', ');
  const target = summary.tool === 'verapdf' ? 'Flavour' : 'Case';
  const failures = summary.tool === 'verapdf' ? 'Failed rules' : 'Failed checks';
  const lines = [
    `### ${name} conformance report (report-only)`,
    '',
    `${versions}. ${summary.rows.length} rows: ${counts}.`,
    '',
    `| File | Writer | ${target} | Verdict | ${failures} | Detail | Ids | Status |`,
    '|---|---|---|---|---|---|---|---|',
    ...summary.rows.map(
      (r) =>
        `| ${cell(r.file)} | ${cell(r.writer)} | ${cell(r.target)} | ${r.verdict} | ` +
        `${cell(r.failed.join(', '))} | ${cell(r.detail)} | ${cell(r.ids.join(', '))} | ${r.status} |`,
    ),
    '',
  ];
  if (summary.idsNowPassing.length > 0) {
    lines.push(
      `Ids whose every row now passes (remove their expectation): ${summary.idsNowPassing.join(', ')}`,
      '',
    );
  }
  if (summary.idsOnBetterRows.length > 0) {
    lines.push(`Ids on rows that got better: ${summary.idsOnBetterRows.join(', ')}`, '');
  }
  const unfiled = Object.entries(summary.unfiled);
  if (unfiled.length > 0) {
    lines.push('Unfiled findings (no ledger id yet):', '');
    for (const [key, text] of unfiled) lines.push(`- \`${key}\`: ${text}`);
    lines.push('');
  }
  for (const warning of summary.warnings) lines.push(`> warning: ${warning}`, '');
  return lines.join('\n');
}

function main(argv: readonly string[]): number {
  const usage =
    'usage: node scripts/conformance/summarize.ts <verapdf|pyhanko> <reports-dir> ' +
    '[--manifest <manifest.json>] [--expected <expected.json>] [--json <summary.json>]';
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        manifest: { type: 'string' },
        expected: { type: 'string' },
        json: { type: 'string' },
      },
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}\n`);
    return 2;
  }
  const [tool, dir] = parsed.positionals;
  if (
    (tool !== 'verapdf' && tool !== 'pyhanko') ||
    dir === undefined ||
    parsed.positionals.length > 2
  ) {
    process.stderr.write(`${usage}\n`);
    return 2;
  }
  if (!existsSync(dir)) {
    process.stderr.write(`${dir}: no such directory, so no ${tool} report\n`);
    return 1;
  }
  const summary = summarize(tool, dir, {
    ...(parsed.values.expected === undefined ? {} : { expectedPath: parsed.values.expected }),
    ...(parsed.values.manifest === undefined ? {} : { manifestPath: parsed.values.manifest }),
  });
  if (summary === undefined) {
    process.stderr.write(
      `${dir}: no ${tool} report found; the harness wrote nothing to summarize\n`,
    );
    return 1;
  }
  const markdown = renderMarkdown(summary);
  process.stdout.write(`${markdown}\n`);
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary !== undefined && stepSummary !== '') appendFileSync(stepSummary, `${markdown}\n`);
  writeFileSync(
    parsed.values.json ?? join(dir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
