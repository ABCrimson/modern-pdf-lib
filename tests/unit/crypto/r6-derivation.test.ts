/**
 * AES-256 key derivation (security handler revisions 5 and 6).
 *
 * - src algorithm2B is ISO 32000-2 Algorithm 2.B: it equals the oracle port on three known
 *   answers and on the 512 hashes qpdf 12.4.2 wrote (tests/fixtures/pdf20-hash).
 * - The writer uses only that derivation: qpdf accepts both passwords of a file this library
 *   writes, decrypts it, and pdf.js opens it.
 * - The reader tries the standard derivation first and the legacy one (as modern-pdf-lib 0.26.0
 *   to 0.40.8 wrote it) only after every standard attempt fails; the owner hash takes the first
 *   48 bytes of /U as its udata.
 *
 * The Encrypt dictionaries are read from the file bytes by a small reader in this file, not by
 * the library's parser, and the /Perms check runs on node:crypto.
 */
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  algorithm2B,
  computeFileEncryptionKey,
  deriveFileKeyV5,
  verifyOwnerPassword,
  verifyUserPassword,
} from '../../../src/crypto/keyDerivation.js';
import type { EncryptDictValues } from '../../../src/crypto/keyDerivation.js';
import { createPdf, loadPdf } from '../../../src/index.js';
import { pdf20Hash, pdf20HashLegacy } from '../../helpers/oracle/pdf20-hash.js';
import { expectPdfjsText } from '../../helpers/oracle/pdfjs.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../../helpers/oracle/qpdf.js';

const FIXTURES = join(import.meta.dirname, '../../fixtures');
const utf8 = new TextEncoder();
const latin1 = new TextDecoder('latin1');
const fixture = (path: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, path)));

// ---------------------------------------------------------------------------
// A minimal Encrypt dictionary reader (strings, numbers, booleans of the /Encrypt object)
// ---------------------------------------------------------------------------

type Entry = Uint8Array | number | boolean;

/** The entries of the indirect /Encrypt dictionary of `bytes` (the last trailer's reference). */
function readEncryptDict(bytes: Uint8Array): Map<string, Entry> {
  // One char per byte (TextDecoder's 'latin1' is windows-1252 and remaps 0x80-0x9f).
  const s = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const ref = [...s.matchAll(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/g)].at(-1);
  if (ref === undefined) throw new Error('no /Encrypt reference');
  const at = s.search(new RegExp(`(?:^|[^0-9])${ref[1]}\\s+${ref[2]}\\s+obj`));
  const end = s.indexOf('endobj', at);
  let i = s.indexOf('<<', at) + 2;
  const out = new Map<string, Entry>();
  const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41 };
  escapes['\\'] = 92;
  while (i < end) {
    const m = /^\s*\/([A-Za-z]+)\s*/.exec(s.slice(i, i + 64));
    if (m === null) {
      i++;
      continue;
    }
    const key = m[1]!;
    i += m[0].length;
    if (s[i] === '(') {
      const b: number[] = [];
      let depth = 1;
      i++;
      while (depth > 0) {
        const ch = s.charCodeAt(i);
        if (ch === 0x5c) {
          const next = s[i + 1]!;
          const octal = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))?.[0];
          if (escapes[next] !== undefined) {
            b.push(escapes[next]);
            i += 2;
          } else if (octal !== undefined) {
            b.push(Number.parseInt(octal, 8) & 0xff);
            i += 1 + octal.length;
          } else if (next === '\r') {
            i += s[i + 2] === '\n' ? 3 : 2;
          } else if (next === '\n') {
            i += 2;
          } else {
            b.push(next.charCodeAt(0));
            i += 2;
          }
          continue;
        }
        if (ch === 0x28) depth++;
        if (ch === 0x29 && --depth === 0) {
          i++;
          break;
        }
        b.push(ch);
        i++;
      }
      out.set(key, Uint8Array.from(b));
    } else if (s[i] === '<' && s[i + 1] !== '<') {
      const j = s.indexOf('>', i);
      out.set(key, Uint8Array.fromHex(s.slice(i + 1, j).replace(/\s+/g, '')));
      i = j + 1;
    } else if (/[-0-9]/.test(s[i]!)) {
      const n = /^-?\d+/.exec(s.slice(i))![0];
      out.set(key, Number(n));
      i += n.length;
    } else if (s.startsWith('true', i) || s.startsWith('false', i)) {
      out.set(key, s.startsWith('true', i));
      i += s.startsWith('true', i) ? 4 : 5;
    }
  }
  return out;
}

/** The EncryptDictValues of the file at `path` under tests/fixtures. */
function dictOf(path: string): EncryptDictValues {
  const d = readEncryptDict(fixture(path));
  const bytes = (k: string): Uint8Array | undefined => {
    const v = d.get(k);
    return v instanceof Uint8Array ? v : undefined;
  };
  const num = (k: string): number | undefined => {
    const v = d.get(k);
    return typeof v === 'number' ? v : undefined;
  };
  return {
    version: num('V') ?? 0,
    revision: num('R') ?? 0,
    keyLength: num('Length') ?? 40,
    ownerKey: bytes('O') ?? new Uint8Array(0),
    userKey: bytes('U') ?? new Uint8Array(0),
    permissions: num('P') ?? 0,
    ownerEncryptionKey: bytes('OE'),
    userEncryptionKey: bytes('UE'),
    perms: bytes('Perms'),
    encryptMetadata: d.get('EncryptMetadata') !== false,
  };
}

/** /Perms decrypted with `fileKey` on node:crypto (AES-256, one block). */
function permsOf(dict: EncryptDictValues, fileKey: Uint8Array): { adb: string; p: number } {
  const decipher = createDecipheriv('aes-256-ecb', fileKey, null);
  decipher.setAutoPadding(false);
  const block = new Uint8Array(decipher.update(dict.perms ?? new Uint8Array(16)));
  decipher.final();
  return {
    adb: String.fromCharCode(...block.subarray(9, 12)),
    p: new DataView(block.buffer, block.byteOffset, 16).getInt32(0, true),
  };
}

// ---------------------------------------------------------------------------
// Algorithm 2.B
// ---------------------------------------------------------------------------

const SALT = Uint8Array.fromHex('0102030405060708');
/** The known answers of tests/oracle/aes.test.ts (password, salt 01..08). */
const KNOWN_ANSWERS = [
  { password: 'test', hash: '06dfe27c8839ef281cfc27eb79646cf211f0e59b683491153b770ea2b94efe6d' },
  { password: '', hash: '8d1efb4f1bdbb651341704c2139de4f6be05d6d4609af56916b21646ed74825c' },
  { password: 'test1', hash: '40f4847a2f9b0f2d12735645834a317b1e8b5250102f99448c430b35c21f7dec' },
] as const;

interface CaseFile {
  readonly user: string;
  readonly owner: string;
  readonly U: string;
  readonly O: string;
}
const QPDF_CASES = (
  JSON.parse(readFileSync(join(FIXTURES, 'pdf20-hash/cases.json'), 'utf8')) as {
    readonly files: readonly CaseFile[];
  }
).files.flatMap((f, i) => {
  const u = Uint8Array.fromHex(f.U);
  const o = Uint8Array.fromHex(f.O);
  return [
    {
      name: `file ${i} user`,
      password: f.user,
      salt: u.subarray(32, 40),
      udata: undefined,
      hash: u.subarray(0, 32).toHex(),
    },
    {
      name: `file ${i} owner`,
      password: f.owner,
      salt: o.subarray(32, 40),
      udata: u,
      hash: o.subarray(0, 32).toHex(),
    },
  ];
});

describe('src algorithm2B is ISO 32000-2 Algorithm 2.B', () => {
  test.for(KNOWN_ANSWERS)(
    'password "$password", salt 0102030405060708',
    async ({ password, hash }) => {
      expect((await algorithm2B(utf8.encode(password), SALT)).toHex()).toBe(hash);
    },
  );

  test(`equals the hashes qpdf wrote on all ${QPDF_CASES.length} cases of tests/fixtures/pdf20-hash`, async () => {
    expect(QPDF_CASES.length).toBe(512);
    const wrong: string[] = [];
    for (const c of QPDF_CASES) {
      const got = (await algorithm2B(utf8.encode(c.password), c.salt, c.udata)).toHex();
      if (got !== c.hash) wrong.push(c.name);
    }
    expect(wrong).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The legacy oracle port is pinned by the published 0.40.3 fixture
// ---------------------------------------------------------------------------

const LEGACY = 'legacy-0.40.3/encrypted-r6.pdf';
const LEGACY_USER = 'user-0403';
const LEGACY_OWNER = 'owner-0403';

describe('the legacy oracle port', () => {
  test('reproduces the /U and /O hashes of the 0.40.3 fixture and the standard port does not', () => {
    const { userKey: u, ownerKey: o } = dictOf(LEGACY);
    const user = utf8.encode(LEGACY_USER);
    const owner = utf8.encode(LEGACY_OWNER);
    const u48 = u.subarray(0, 48);
    expect(pdf20HashLegacy(user, u.subarray(32, 40)).toHex()).toBe(u.subarray(0, 32).toHex());
    expect(pdf20HashLegacy(owner, o.subarray(32, 40), u48).toHex()).toBe(o.subarray(0, 32).toHex());
    expect(pdf20Hash(user, u.subarray(32, 40)).toHex()).not.toBe(u.subarray(0, 32).toHex());
    expect(pdf20Hash(owner, o.subarray(32, 40), u48).toHex()).not.toBe(o.subarray(0, 32).toHex());
  });
});

// ---------------------------------------------------------------------------
// Write direction: only the standard derivation
// ---------------------------------------------------------------------------

const TEXT = 'Derivation text';

async function libraryAes256(): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage().drawText(TEXT, { x: 72, y: 720, size: 24 });
  await doc.encrypt({ userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' });
  return doc.save({ compress: false });
}

/** The hex string of `/U` or `/O` in a file this library wrote. */
function hexEntry(bytes: Uint8Array, key: 'U' | 'O'): Uint8Array {
  const hex = new RegExp(`/${key} <([0-9a-fA-F]+)>`).exec(latin1.decode(bytes))?.[1];
  if (hex === undefined) throw new Error(`no /${key} hex string`);
  return Uint8Array.fromHex(hex);
}

describe('write direction', () => {
  test('a written R6 file carries standard /U and /O hashes, not legacy ones', async () => {
    const bytes = await libraryAes256();
    const u = hexEntry(bytes, 'U');
    const o = hexEntry(bytes, 'O');
    expect(u).toHaveLength(48);
    expect(o).toHaveLength(48);
    const user = utf8.encode('user');
    const owner = utf8.encode('owner');
    expect(pdf20Hash(user, u.subarray(32, 40)).toHex()).toBe(u.subarray(0, 32).toHex());
    expect(pdf20Hash(owner, o.subarray(32, 40), u).toHex()).toBe(o.subarray(0, 32).toHex());
    expect(pdf20HashLegacy(user, u.subarray(32, 40)).toHex()).not.toBe(u.subarray(0, 32).toHex());
  });

  test.for(['user', 'owner'])(
    'qpdf --check accepts the %s password, qpdf --decrypt and pdf.js show the text',
    async (password, ctx) => {
      requireQpdf(ctx);
      const bytes = await libraryAes256();
      expectQpdfClean(bytes, { password });
      expect(latin1.decode(qpdfDecryptQdf(bytes, password))).toContain(`(${TEXT})`);
      await expectPdfjsText(bytes, [TEXT], { password });
    },
  );
});

describe('write direction: a password that SASLprep changes', () => {
  test('qpdf opens the file with the prepared form only; pdf.js and the library with either', async (ctx) => {
    requireQpdf(ctx);
    const typed = '\u{FB01}x\u{AD}A\u{FF21}';
    const doc = createPdf();
    doc.addPage().drawText(TEXT, { x: 72, y: 720, size: 24 });
    await doc.encrypt({ userPassword: typed, ownerPassword: 'owner', algorithm: 'aes-256' });
    const bytes = await doc.save({ compress: false });
    expectQpdfClean(bytes, { password: 'fixAA' });
    await expectPdfjsText(bytes, [TEXT], { password: 'fixAA' });
    expect(() => expectQpdfClean(bytes, { password: typed })).toThrow(/invalid password/);
    // pdf.js prepares an R6 password with SASLprep first, then tries the raw bytes.
    await expectPdfjsText(bytes, [TEXT], { password: typed });
    // The library opens it with either form: SASLprep maps the typed one to the prepared one.
    await expect(loadPdf(bytes, { password: typed })).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Read direction: standard first, legacy last
// ---------------------------------------------------------------------------

/** qpdf 12.4.2 copies of tests/fixtures/encrypted/source.pdf (scripts/oracle/encrypted-fixtures.ts). */
const R5 = 'encrypted/extra/aes-256-r5.pdf';
const NFKC = 'encrypted/extra/aes-256-r6-nfkc.pdf';
/** The user password of NFKC as typed: U+FB01 x U+00AD A U+FF21. qpdf hashed its raw UTF-8. */
const NFKC_TYPED = '\u{FB01}x\u{AD}A\u{FF21}';

interface ReadCase {
  readonly file: string;
  readonly password: string;
  readonly derivation: 'iso' | 'legacy';
}

const READ_CASES: readonly ReadCase[] = [
  { file: 'encrypted/aes-256-r6.pdf', password: 'user', derivation: 'iso' },
  { file: 'encrypted/aes-256-r6.pdf', password: 'owner', derivation: 'iso' },
  { file: 'corpus/pyhanko-aes256.pdf', password: 'usersecret', derivation: 'iso' },
  { file: 'corpus/qpdf-r6-acrobat-xi.pdf', password: 'view', derivation: 'iso' },
  { file: 'corpus/qpdf-r6-acrobat-xi.pdf', password: 'master', derivation: 'iso' },
  { file: 'corpus/qpdf-r6-attachments.pdf', password: 'view', derivation: 'iso' },
  { file: LEGACY, password: LEGACY_USER, derivation: 'legacy' },
  { file: LEGACY, password: LEGACY_OWNER, derivation: 'legacy' },
  { file: R5, password: 'user', derivation: 'iso' },
  { file: R5, password: 'owner', derivation: 'iso' },
  { file: NFKC, password: NFKC_TYPED, derivation: 'iso' },
  { file: NFKC, password: 'owner', derivation: 'iso' },
];

describe('deriveFileKeyV5', () => {
  test.for(READ_CASES)(
    '$file with "$password": $derivation derivation, /Perms checks out',
    async ({ file, password, derivation }) => {
      const dict = dictOf(file);
      const result = await deriveFileKeyV5(password, dict);
      expect(result?.derivation).toBe(derivation);
      expect(result?.fileKey).toHaveLength(32);
      const perms = permsOf(dict, result!.fileKey);
      expect(perms.adb).toBe('adb');
      expect(perms.p).toBe(dict.permissions);
    },
  );

  test.for([
    ['encrypted/aes-256-r6.pdf', 'wrong'],
    ['encrypted/aes-256-r6.pdf', ''],
    [LEGACY, 'wrong'],
    [LEGACY, 'user'],
    [R5, 'wrong'],
    // The SASLprep form of the typed password: not what qpdf hashed.
    [NFKC, 'fixAA'],
  ] as const)('%s with "%s": null', async ([file, password]) => {
    expect(await deriveFileKeyV5(password, dictOf(file))).toBeNull();
  });

  test('the owner path of the Acrobat XI file (127-byte /U) yields the user key', async () => {
    const dict = dictOf('corpus/qpdf-r6-acrobat-xi.pdf');
    expect(dict.userKey).toHaveLength(127);
    expect(await verifyOwnerPassword('master', dict, new Uint8Array(0))).toBe(true);
    const owner = await deriveFileKeyV5('master', dict);
    const user = await deriveFileKeyV5('view', dict);
    expect(owner?.fileKey.toHex()).toBe(user?.fileKey.toHex());
  });

  test('a prohibited code point skips the SASLprep attempt and throws nothing', async () => {
    expect(
      await deriveFileKeyV5('bad\u0000password', dictOf('encrypted/aes-256-r6.pdf')),
    ).toBeNull();
  });
});

describe('the R5 and SASLprep-sensitive fixtures', () => {
  test.for([
    [R5, 'user'],
    [R5, 'owner'],
    [NFKC, NFKC_TYPED],
  ] as const)('%s opens in the library, qpdf and pdf.js', async ([file, password], ctx) => {
    const bytes = fixture(file);
    await expect(loadPdf(bytes, { password })).resolves.toBeDefined();
    requireQpdf(ctx);
    expectQpdfClean(bytes, { password });
    await expectPdfjsText(bytes, ['Oracle text'], { password });
  });
});

describe('the exported checks accept both derivations', () => {
  const NO_ID = new Uint8Array(0);

  test.for([
    ['encrypted/aes-256-r6.pdf', 'user', 'owner'],
    [LEGACY, LEGACY_USER, LEGACY_OWNER],
  ] as const)('%s', async ([file, user, owner]) => {
    const dict = dictOf(file);
    expect(await verifyUserPassword(user, dict, NO_ID)).toBe(true);
    expect(await verifyUserPassword(owner, dict, NO_ID)).toBe(false);
    expect(await verifyOwnerPassword(owner, dict, NO_ID)).toBe(true);
    expect(await verifyOwnerPassword(user, dict, NO_ID)).toBe(false);
    const viaUser = await computeFileEncryptionKey(user, dict, NO_ID);
    const viaOwner = await computeFileEncryptionKey(owner, dict, NO_ID);
    expect(viaUser.toHex()).toBe(viaOwner.toHex());
    expect(permsOf(dict, viaUser).adb).toBe('adb');
    await expect(computeFileEncryptionKey('wrong', dict, NO_ID)).rejects.toThrow(
      /Incorrect password for R=6 encryption/,
    );
  });
});
