/**
 * The error census gate. Two walks over `src` (see tests/helpers/errorCensus.ts) are compared with
 * the allowlists in `errorCensus.allow/`:
 *
 * 1. Every `throw` that builds a native error (`new Error(...)`, `new RangeError(...)`, ...) is
 *    one row of an allowlist, keyed by file, constructor and message (never by line), with the
 *    typed class that should replace it. A new generic throw fails the test, and so does a row
 *    whose throw is gone: whoever converts a throw deletes its row, so the lists only shrink.
 * 2. Every exported error class (a class with a super class, in `src/errors.ts`,
 *    `src/parser/parseError.ts` and `src/runtime/memoryBudget.ts`) has a `throw` that names it,
 *    or a row in `classes.json` saying why it has none yet. The work that gives a class a throw
 *    site deletes its row.
 *
 * The files of `errorCensus.allow/` are named after the source folders whose throws they hold,
 * so one person converting one group of folders edits one file:
 *
 * | file                       | rows for                                                          |
 * | -------------------------- | ----------------------------------------------------------------- |
 * | core-doc.json              | the document and page classes, `core/operators`, `fontEmbed.ts`,  |
 * |                            | `incrementalWriter.ts`, `streamingParser.ts`, `pdfObjects.ts`     |
 * | core-rest.json             | the rest of `src/core`                                            |
 * | parser-crypto-security.json| `src/parser`, `src/crypto`, `src/security`                        |
 * | form.json                  | `src/form`                                                        |
 * | annotation.json            | `src/annotation`                                                  |
 * | structure.json             | `src/accessibility`, `outline`, `layers`, `graphics`              |
 * | signature.json             | `src/signature`                                                   |
 * | compliance-metadata.json   | `src/compliance`, `src/metadata`                                  |
 * | leaves.json                | `src/layout`, `barcode`, `render`, `assets/svg`                   |
 * | assets.json                | the rest of `src/assets`                                          |
 * | runtime-misc.json          | every other folder (codecs, color, runtime, wasm, ...)           |
 * | limits.json                | rows of any file the limits work takes over; empty today          |
 * | classes.json               | the classes with no throw site (check 2)                          |
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCensus } from '../../helpers/errorCensus.js';
import type { ErrorCensus, GenericThrow } from '../../helpers/errorCensus.js';

const ALLOW_DIR = fileURLToPath(new URL('./errorCensus.allow/', import.meta.url));

/** The typed classes a row may name as the replacement of its generic throw. */
const TARGET_CLASSES: ReadonlySet<string> = new Set([
  'InvalidArgumentError',
  'InvalidStateError',
  'MalformedInputError',
  'UnsupportedFeatureError',
  'EnvironmentError',
  'EncryptedPdfError',
  'NoSuchFieldError',
  'UnexpectedFieldTypeError',
  'PdfParseError',
  'UnsupportedFilterError',
  'BatchProcessingError',
]);

/** The group a source file belongs to: the basename (without `.json`) of its allowlist file. */
function groupOf(file: string): string {
  if (
    [
      'src/core/pdfDocument.ts',
      'src/core/pdfPage.ts',
      'src/core/pdfCatalog.ts',
      'src/core/internal/pdfPageText.ts',
      'src/assets/font/fontEmbed.ts',
      'src/core/io/incrementalWriter.ts',
      'src/parser/streamingParser.ts',
      'src/core/pdfObjects.ts',
    ].includes(file) ||
    file.startsWith('src/core/operators/')
  ) {
    return 'core-doc';
  }
  if (file.startsWith('src/core/')) return 'core-rest';
  if (/^src\/(parser|crypto|security)\//.test(file)) return 'parser-crypto-security';
  if (file.startsWith('src/form/')) return 'form';
  if (file.startsWith('src/annotation/')) return 'annotation';
  if (/^src\/(accessibility|outline|layers|graphics)\//.test(file)) return 'structure';
  if (file.startsWith('src/signature/')) return 'signature';
  if (/^src\/(compliance|metadata)\//.test(file)) return 'compliance-metadata';
  if (/^src\/(layout|barcode|render)\//.test(file) || file.startsWith('src/assets/svg/')) {
    return 'leaves';
  }
  if (file.startsWith('src/assets/')) return 'assets';
  return 'runtime-misc';
}

/** A row of a generic-throw allowlist. */
interface ThrowRow {
  readonly file: string;
  readonly kind: string;
  readonly message: string;
  readonly target: string;
  /** How many throws share this file, constructor and message; 1 when absent. */
  readonly count?: number;
}

/** A row of `classes.json`. */
interface ClassRow {
  readonly name: string;
  /** `throw`: gets a throw site; `remove`: the class is removed from the library. */
  readonly decision: 'throw' | 'remove';
  readonly where: string;
}

interface AllowFile<Row> {
  /** Basename without `.json`. */
  readonly group: string;
  readonly rows: readonly Row[];
}

function readAllowFile<Row>(name: string): AllowFile<Row> {
  const parsed: unknown = JSON.parse(readFileSync(`${ALLOW_DIR}${name}`, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${name}: expected a JSON array`);
  return { group: name.replace(/\.json$/, ''), rows: parsed as Row[] };
}

const allowFileNames = readdirSync(ALLOW_DIR)
  .filter((n) => n.endsWith('.json'))
  .sort();
const throwFiles = allowFileNames
  .filter((n) => n !== 'classes.json')
  .map((n) => readAllowFile<ThrowRow>(n));
const classRows = readAllowFile<ClassRow>('classes.json').rows;
const throwRows = throwFiles.flatMap((f) => f.rows);

const siteKey = (s: { file: string; kind: string; message: string }): string =>
  JSON.stringify([s.file, s.kind, s.message]);

/** The offences of `sites` against `rows`: a site no row covers, a row no site backs. */
function compareThrows(sites: readonly GenericThrow[], rows: readonly ThrowRow[]): string[] {
  const found = new Map<string, GenericThrow[]>();
  for (const site of sites) found.set(siteKey(site), [...(found.get(siteKey(site)) ?? []), site]);
  const allowed = new Map<string, number>();
  for (const row of rows)
    allowed.set(siteKey(row), (allowed.get(siteKey(row)) ?? 0) + (row.count ?? 1));

  const problems: string[] = [];
  for (const [key, list] of found) {
    const extra = list.slice(allowed.get(key) ?? 0);
    for (const site of extra) {
      problems.push(
        `generic throw with no allowlist row: ${site.file}:${site.line} new ${site.kind}(${JSON.stringify(site.message)})`,
      );
    }
  }
  for (const [key, count] of allowed) {
    const have = found.get(key)?.length ?? 0;
    if (have < count) {
      const [file, kind, message] = JSON.parse(key) as [string, string, string];
      problems.push(
        `allowlist row with ${count - have} throw(s) missing: ${file} new ${kind}(${JSON.stringify(message)}); delete the row (lower its count)`,
      );
    }
  }
  return problems;
}

/** The offences of the exported error classes against the `throw` statements and `rows`. */
function compareClasses(census: ErrorCensus, rows: readonly ClassRow[]): string[] {
  const problems: string[] = [];
  const declared = new Set(census.errorClasses.map((c) => c.name));
  const listed = new Set(rows.map((r) => r.name));
  for (const { name, file } of census.errorClasses) {
    const thrown = census.thrownClasses.has(name);
    if (!thrown && !listed.has(name)) {
      problems.push(
        `${name} (${file}) is exported but no throw names it and classes.json has no row`,
      );
    }
    if (thrown && listed.has(name)) {
      problems.push(`classes.json has a row for ${name}, which src now throws; delete the row`);
    }
  }
  for (const row of rows) {
    if (!declared.has(row.name))
      problems.push(`classes.json row ${row.name} names no exported error class`);
  }
  return problems;
}

describe('error census', () => {
  let census: ErrorCensus;
  beforeAll(() => {
    census = runCensus();
  });

  describe('generic throws', () => {
    it('every generic throw has an allowlist row and every row has its throw', () => {
      expect(compareThrows(census.genericThrows, throwRows)).toEqual([]);
    });

    it('a row sits in the allowlist file of its source folder, once', () => {
      const problems: string[] = [];
      const seen = new Set<string>();
      for (const { group, rows } of throwFiles) {
        for (const row of rows) {
          // limits.json takes rows of any file.
          if (group !== 'limits' && groupOf(row.file) !== group) {
            problems.push(`${row.file} belongs in ${groupOf(row.file)}.json, not ${group}.json`);
          }
          if (seen.has(siteKey(row))) problems.push(`duplicate row: ${siteKey(row)}`);
          seen.add(siteKey(row));
        }
      }
      expect(problems).toEqual([]);
    });

    it('every row names a typed target class and a sane count', () => {
      const problems: string[] = [];
      for (const row of throwRows) {
        if (!TARGET_CLASSES.has(row.target)) {
          problems.push(`${row.file} ${JSON.stringify(row.message)}: unknown target ${row.target}`);
        }
        if (row.count !== undefined && !(Number.isInteger(row.count) && row.count >= 2)) {
          problems.push(
            `${row.file} ${JSON.stringify(row.message)}: count ${row.count} (omit it for 1)`,
          );
        }
      }
      expect(problems).toEqual([]);
    });
  });

  describe('exported error classes', () => {
    it('every exported error class has a throw site or a row', () => {
      expect(compareClasses(census, classRows)).toEqual([]);
    });

    it('every row names a decision and where', () => {
      const problems: string[] = [];
      for (const row of classRows) {
        if (row.decision !== 'throw' && row.decision !== 'remove') {
          problems.push(`${row.name}: decision ${String(row.decision)}`);
        }
        if (row.where.trim() === '') problems.push(`${row.name}: empty where`);
      }
      expect(problems).toEqual([]);
    });
  });
});

/** The gate's own checks, on small inputs, so they hold whatever the allowlists contain. */
describe('error census comparison', () => {
  const site = (message: string, line = 1): GenericThrow => ({
    file: 'src/core/pdfPage.ts',
    kind: 'Error',
    message,
    line,
  });
  const row = (message: string, count?: number): ThrowRow => ({
    file: 'src/core/pdfPage.ts',
    kind: 'Error',
    message,
    target: 'InvalidArgumentError',
    ...(count === undefined ? {} : { count }),
  });

  it('accepts sites that match the rows one for one', () => {
    expect(compareThrows([site('a'), site('b'), site('b', 2)], [row('a'), row('b', 2)])).toEqual(
      [],
    );
  });

  it('fails when a row is deleted', () => {
    expect(compareThrows([site('a'), site('b')], [row('a')])).toHaveLength(1);
  });

  it('fails when src gains a generic throw, also one with the message of a listed throw', () => {
    expect(compareThrows([site('a'), site('b')], [row('a')])).toHaveLength(1);
    expect(compareThrows([site('a'), site('a', 2)], [row('a')])).toHaveLength(1);
  });

  it('fails when a row names a throw that no longer exists, or counts one too many', () => {
    expect(compareThrows([site('a')], [row('a'), row('gone')])).toHaveLength(1);
    expect(compareThrows([site('a')], [row('a', 2)])).toHaveLength(1);
  });

  const census = (declared: string[], thrown: string[]): ErrorCensus => ({
    genericThrows: [],
    errorClasses: declared.map((name) => ({ name, file: 'src/errors.ts' })),
    thrownClasses: new Map(thrown.map((name) => [name, ['src/core/pdfPage.ts']])),
  });
  const classRow = (name: string): ClassRow => ({ name, decision: 'throw', where: 'somewhere' });

  it('accepts a class that is thrown or listed', () => {
    expect(compareClasses(census(['A', 'B'], ['A']), [classRow('B')])).toEqual([]);
  });

  it('fails when a class row is deleted, or lists a class src now throws, or a class that is gone', () => {
    expect(compareClasses(census(['A', 'B'], ['A']), [])).toHaveLength(1);
    expect(compareClasses(census(['A'], ['A']), [classRow('A')])).toHaveLength(1);
    expect(compareClasses(census(['A'], ['A']), [classRow('Z')])).toHaveLength(1);
  });
});
