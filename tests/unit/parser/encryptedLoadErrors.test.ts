/**
 * loadPdf of an encrypted file without the right password throws EncryptedPdfError, whose `reason`
 * tells the two cases apart, and whose `cause` is the last derivation error.
 *
 * The oracle is qpdf 12.4.2 (tests/fixtures/encrypted): `qpdf --requires-password` exits 0 when a
 * password other than the one given is required (all four encrypted fixtures, with no password and
 * with "nope"), 3 when the given password opens the file ("user" and "owner"), and 2 for a file
 * that is not encrypted (source.pdf). `qpdf --password=nope --check` exits 2. Each fixture's
 * verdict from the library is compared with qpdf's for the same file and password.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TestContext } from 'vitest';
import { loadPdf } from '../../../src/parser/documentParser.js';
import {
  EncryptedPdfError,
  MalformedInputError,
  PdfError,
  PdfParseError,
} from '../../../src/errors.js';
import { QPDF_BIN, requireQpdf } from '../../helpers/oracle/qpdf.js';

const DIR = join(import.meta.dirname, '../../fixtures/encrypted');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(DIR, name)));

/** The exit status of `qpdf [--password=<password>] --requires-password <fixture>`. */
function requiresPassword(file: string, password: string | undefined): number | null {
  const args = [
    ...(password === undefined ? [] : [`--password=${password}`]),
    '--requires-password',
    join(DIR, file),
  ];
  return spawnSync(QPDF_BIN, args, { encoding: 'utf8' }).status;
}

/** The error `loadPdf` rejects with; fails when it resolves. */
async function loadError(file: string, password?: string): Promise<unknown> {
  try {
    await loadPdf(fixture(file), password === undefined ? {} : { password });
  } catch (error) {
    return error;
  }
  throw new Error(`loadPdf(${file}) resolved`);
}

const ENCRYPTED = ['rc4-40-r2.pdf', 'rc4-128-r3.pdf', 'aes-128-r4.pdf', 'aes-256-r6.pdf'] as const;

describe.each(ENCRYPTED)('%s', (file) => {
  it('throws EncryptedPdfError "password-required" without a password; qpdf requires one', async (ctx: TestContext) => {
    requireQpdf(ctx);
    expect(requiresPassword(file, undefined)).toBe(0);

    const error = await loadError(file);
    expect(error).toBeInstanceOf(EncryptedPdfError);
    expect(PdfError.is(error, 'encrypted-pdf')).toBe(true);
    const { reason, code, name, message } = error as EncryptedPdfError;
    expect({ reason, code, name }).toEqual({
      reason: 'password-required',
      code: 'encrypted-pdf',
      name: 'EncryptedPdfError',
    });
    expect(message).toBe(
      'This PDF is encrypted and requires a password. ' +
        'Pass { password: "..." } in the options to decrypt it.',
    );
  });

  it('throws EncryptedPdfError "incorrect-password" with "nope"; qpdf rejects it', async (ctx: TestContext) => {
    requireQpdf(ctx);
    expect(requiresPassword(file, 'nope')).toBe(0);

    const error = await loadError(file, 'nope');
    expect(error).toBeInstanceOf(EncryptedPdfError);
    const { reason, code, message } = error as EncryptedPdfError;
    expect({ reason, code }).toEqual({ reason: 'incorrect-password', code: 'encrypted-pdf' });
    expect(message).toMatch(/^Failed to decrypt PDF: the provided password is incorrect\. /);
  });

  it('keeps the last derivation error as the cause, in both cases', async () => {
    for (const password of [undefined, 'nope']) {
      const error = (await loadError(file, password)) as EncryptedPdfError;
      expect(error.cause).toBeInstanceOf(EncryptedPdfError);
      expect((error.cause as EncryptedPdfError).reason).toBe('incorrect-password');
      expect((error.cause as Error).message).toMatch(/^Incorrect password/);
    }
  });

  it('is neither a PdfParseError nor a MalformedInputError: a locked file is not malformed', async () => {
    for (const password of [undefined, 'nope']) {
      const error = await loadError(file, password);
      expect(error).not.toBeInstanceOf(PdfParseError);
      expect(error).not.toBeInstanceOf(MalformedInputError);
    }
  });

  it.for(['user', 'owner'])('loads with "%s"; qpdf opens it', async (password, ctx) => {
    requireQpdf(ctx);
    expect(requiresPassword(file, password)).toBe(3);

    const doc = await loadPdf(fixture(file), { password });
    expect(doc.getPageCount()).toBe(1);
  });
});

describe('source.pdf (not encrypted)', () => {
  it('loads with no password and with "nope"; qpdf reports it is not encrypted', async (ctx: TestContext) => {
    requireQpdf(ctx);
    expect(requiresPassword('source.pdf', undefined)).toBe(2);

    expect((await loadPdf(fixture('source.pdf'))).getPageCount()).toBe(1);
    expect((await loadPdf(fixture('source.pdf'), { password: 'nope' })).getPageCount()).toBe(1);
  });
});

describe('the empty password', () => {
  it('is tried first: a file that opens with it never throws', async () => {
    const doc = await loadPdf(fixture('load/aes-128-r4.empty.pdf'));
    expect(doc.getPageCount()).toBe(1);
  });
});
