/**
 * Opening an AES-256 (R6) file whose password matches only the legacy key derivation (as
 * modern-pdf-lib 0.26.0 to 0.40.8 wrote it) emits the warning MPL_LEGACY_R6_KEY once per realm;
 * a standard file, a failed open and the low-level checks emit none. Such a file is never
 * written back with the legacy derivation: encrypt() and save write the standard one.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadPdf } from '../../../src/index.js';
import { resetWarningsForTesting } from '../../../src/internal/warnings.js';
import { pdf20Hash } from '../../helpers/oracle/pdf20-hash.js';
import { QPDF_BIN, requireQpdf } from '../../helpers/oracle/qpdf.js';

const FIXTURES = join(import.meta.dirname, '../../fixtures');
const LEGACY = new Uint8Array(readFileSync(join(FIXTURES, 'legacy-0.40.3/encrypted-r6.pdf')));
const ISO = new Uint8Array(readFileSync(join(FIXTURES, 'encrypted/aes-256-r6.pdf')));
const LEGACY_USER = 'user-0403';
const LEGACY_OWNER = 'owner-0403';
const MESSAGE =
  'The AES-256 key of this document was derived the way modern-pdf-lib 0.26.0 to 0.40.8 wrote it, ' +
  'which other PDF software does not accept. Call encrypt() and save to write it with the ' +
  'standard derivation.';
const latin1 = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => String.fromCharCode(b)).join('');

let emitWarning: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetWarningsForTesting();
  emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

/** The calls of process.emitWarning that carry the legacy code. */
const legacyCalls = (): unknown[][] =>
  emitWarning.mock.calls.filter(
    (call: unknown[]) => (call[1] as { code?: string } | undefined)?.code === 'MPL_LEGACY_R6_KEY',
  );

describe('MPL_LEGACY_R6_KEY', () => {
  test('a legacy file opens with its user password and warns once', async () => {
    await loadPdf(LEGACY, { password: LEGACY_USER });
    expect(legacyCalls()).toEqual([
      [MESSAGE, { type: 'ModernPdfLibWarning', code: 'MPL_LEGACY_R6_KEY' }],
    ]);
  });

  test('a legacy file opens with its owner password and warns once', async () => {
    await loadPdf(LEGACY, { password: LEGACY_OWNER });
    expect(legacyCalls()).toHaveLength(1);
  });

  test('the warning goes out once per realm, not once per open', async () => {
    await loadPdf(LEGACY, { password: LEGACY_USER });
    await loadPdf(LEGACY, { password: LEGACY_OWNER });
    expect(legacyCalls()).toHaveLength(1);
  });

  test('a standard R6 file opens without the warning', async () => {
    await loadPdf(ISO, { password: 'user' });
    await loadPdf(ISO, { password: 'owner' });
    expect(legacyCalls()).toHaveLength(0);
  });

  test('a wrong password fails as before and warns nothing', async () => {
    await expect(loadPdf(LEGACY, { password: 'wrong' })).rejects.toThrow(
      /^Failed to decrypt PDF: the provided password is incorrect/,
    );
    expect(legacyCalls()).toHaveLength(0);
  });
});

/**
 * /U or /O of the Encrypt dictionary that the last trailer of a file this library wrote names
 * (hex strings; a loaded document can carry its old dictionary as an ordinary object too).
 */
function hexEntry(bytes: Uint8Array, key: 'U' | 'O'): Uint8Array {
  const text = latin1(bytes);
  const ref = [...text.matchAll(/\/Encrypt (\d+) (\d+) R/g)].at(-1);
  if (ref === undefined) throw new Error('no /Encrypt reference');
  const at = text.search(new RegExp(`(?:^|\\n)${ref[1]} ${ref[2]} obj`));
  const body = text.slice(at, text.indexOf('endobj', at));
  const hex = new RegExp(`/${key} <([0-9a-fA-F]+)>`).exec(body)?.[1];
  if (hex === undefined) throw new Error(`no /${key} hex string`);
  return Uint8Array.fromHex(hex);
}

/** The /U and /O strings of the legacy fixture, as the bytes they hold. */
function legacyHashes(): Uint8Array[] {
  const text = latin1(LEGACY);
  return ['U', 'O'].map((key) => {
    const hex = new RegExp(`/${key}\\s*<([0-9a-fA-F\\s]+)>`).exec(text)?.[1];
    if (hex === undefined) throw new Error(`no /${key} hex string in the legacy fixture`);
    return Uint8Array.fromHex(hex.replace(/\s+/g, ''));
  });
}

describe('a legacy file is never written back with the legacy derivation', () => {
  test('save() without encrypt() refuses or writes neither the old /U nor the old /O', async () => {
    const doc = await loadPdf(LEGACY, { password: LEGACY_USER });
    const saved = await doc.save().then(
      (bytes) => bytes,
      (error: unknown) => error,
    );
    if (saved instanceof Uint8Array) {
      const text = latin1(saved).toLowerCase();
      for (const hash of legacyHashes()) {
        expect(text).not.toContain(hash.toHex());
        expect(latin1(saved)).not.toContain(latin1(hash));
      }
    } else {
      expect((saved as Error).name).toBe('UnsupportedEncryptionError');
    }
  });

  test('encrypt() and save write the standard derivation, which qpdf accepts', async (ctx) => {
    requireQpdf(ctx);
    const doc = await loadPdf(LEGACY, { password: LEGACY_USER });
    await doc.encrypt({
      userPassword: LEGACY_USER,
      ownerPassword: LEGACY_OWNER,
      algorithm: 'aes-256',
    });
    const saved = await doc.save({ compress: false });
    const u = hexEntry(saved, 'U');
    const o = hexEntry(saved, 'O');
    const utf8 = new TextEncoder();
    expect(pdf20Hash(utf8.encode(LEGACY_USER), u.subarray(32, 40)).toHex()).toBe(
      u.subarray(0, 32).toHex(),
    );
    expect(pdf20Hash(utf8.encode(LEGACY_OWNER), o.subarray(32, 40), u).toHex()).toBe(
      o.subarray(0, 32).toHex(),
    );
    const dir = mkdtempSync(join(tmpdir(), 'mpl-legacy-r6-'));
    try {
      const file = join(dir, 'resaved.pdf');
      writeFileSync(file, saved);
      for (const password of [LEGACY_USER, LEGACY_OWNER]) {
        const run = spawnSync(QPDF_BIN, [`--password=${password}`, '--show-encryption', file], {
          encoding: 'utf8',
        });
        expect(run.status, `${password}: ${run.stdout}${run.stderr}`).toBe(0);
        expect(run.stdout).toMatch(/^R = 6$/m);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
