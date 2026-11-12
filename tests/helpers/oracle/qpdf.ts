/**
 * qpdf as an outside oracle for the oracle project.
 *
 * The binary is `QPDF` when that variable is set, else `qpdf` on `PATH`, and its version must
 * start with `qpdf version 12.`. requireQpdf() skips the test with a reason when qpdf is absent
 * locally and throws when `CI` is set. Every call writes its input to a fresh temp directory
 * outside the repository and removes the directory afterwards.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'vitest';
import { markChecked } from './outputs.js';

export const QPDF_BIN = process.env['QPDF'] ?? 'qpdf';
export const QPDF_SKIP =
  'qpdf not found: set QPDF=<path> or put qpdf 12.4.2 on PATH; required in CI';

/** Thrown when qpdf exits non-zero or reports a warning or an error. */
export class QpdfError extends Error {
  override readonly name = 'QpdfError';
}

let probed: { readonly version: string | undefined } | undefined;

/** The first line of `qpdf --version`, or undefined when qpdf cannot be run. */
export function qpdfVersion(): string | undefined {
  if (probed === undefined) {
    const result = spawnSync(QPDF_BIN, ['--version'], { encoding: 'utf8' });
    probed = {
      version: result.status === 0 ? result.stdout.split(/\r?\n/)[0]?.trim() : undefined,
    };
  }
  return probed.version;
}

/** Skips the test where qpdf is absent locally; throws in CI and for a version other than 12.x. */
export function requireQpdf(ctx: TestContext): void {
  const version = qpdfVersion();
  if (version === undefined) {
    if (process.env['CI']) {
      throw new Error(
        'qpdf 12.4.2 is required in CI (set QPDF or install it; see the ci.yml step)',
      );
    }
    ctx.skip(QPDF_SKIP);
  }
  if (!version.startsWith('qpdf version 12.')) {
    throw new Error(`qpdf 12.x is required, found "${version}" at ${QPDF_BIN}`);
  }
}

/** Runs qpdf on `bytes` written to `in.pdf`; `args` name the input as `{in}` and an output as `{out}`. */
function runQpdf(
  bytes: Uint8Array,
  args: readonly string[],
): {
  readonly status: number | null;
  readonly lines: string[];
  readonly out: Uint8Array | undefined;
} {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-qpdf-'));
  try {
    const input = join(dir, 'in.pdf');
    const output = join(dir, 'out.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(
      QPDF_BIN,
      args.map((a) => (a === '{in}' ? input : a === '{out}' ? output : a)),
      { encoding: 'utf8' },
    );
    if (result.error !== undefined) throw result.error;
    const lines = `${result.stdout}\n${result.stderr}`
      .split(/\r?\n/)
      .map((l) => l.replaceAll(input, 'in.pdf').trim())
      .filter((l) => l !== '');
    const out = args.includes('{out}') && result.status === 0 ? readFileSync(output) : undefined;
    return {
      status: result.status,
      lines,
      out: out === undefined ? undefined : new Uint8Array(out),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const passwordArgs = (password: string | undefined): string[] =>
  password === undefined ? [] : [`--password=${password}`];

/**
 * Asserts that `qpdf --check` exits 0 and prints no WARNING or ERROR line (exit 3, warnings
 * only, is a failure too). Throws a QpdfError whose message is
 * `qpdf --check exit <code>: <output lines joined by " | ">`. Marks the bytes as checked for
 * the setup guard either way.
 */
export function expectQpdfClean(
  bytes: Uint8Array,
  options: { readonly password?: string } = {},
): void {
  markChecked(bytes);
  const { status, lines } = runQpdf(bytes, [...passwordArgs(options.password), '--check', '{in}']);
  if (status !== 0 || lines.some((l) => /WARNING|ERROR/.test(l))) {
    throw new QpdfError(`qpdf --check exit ${status}: ${lines.join(' | ')}`);
  }
}

/**
 * `qpdf --password=<password> --decrypt --qdf --no-original-object-ids --static-id` of `bytes`:
 * the decrypted file in QDF form. Throws a QpdfError
 * (`qpdf --decrypt exit <code>: <output lines>`) on any non-zero exit, warnings included.
 */
export function qpdfDecryptQdf(bytes: Uint8Array, password: string): Uint8Array {
  const { status, lines, out } = runQpdf(bytes, [
    `--password=${password}`,
    '--decrypt',
    '--qdf',
    '--no-original-object-ids',
    '--static-id',
    '{in}',
    '{out}',
  ]);
  if (status !== 0 || out === undefined) {
    throw new QpdfError(`qpdf --decrypt exit ${status}: ${lines.join(' | ')}`);
  }
  return out;
}
