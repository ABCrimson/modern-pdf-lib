/**
 * G-AES: the standard security handler against outside tools.
 *
 * - Write direction: a document the library encrypts (R2 rc4-40, R3 rc4-128, R4 aes-128, R6
 *   aes-256) and saves with `compress: false` must pass `qpdf --check` with the user password,
 *   decrypt with `qpdf --decrypt --qdf` to a file that shows the drawn text, and give pdf.js the
 *   same text. The library's AES output differs per save (random IVs), so every assertion here
 *   is semantic, never byte equality.
 * - Read direction: tests/fixtures/encrypted holds a plain source, five copies encrypted by qpdf
 *   12.4.2 and, under extra/ and load/, further copies (R5, an R6 password that SASLprep changes,
 *   object streams, RC4 under V4, an empty user password) and built files
 *   (scripts/oracle/encrypted-fixtures.ts; each user password is in manifest.json). qpdf and
 *   pdf.js read each copy of the source with its user password (which pins the fixture), then the
 *   library must read the same text. A document decrypted on load is not saved without encrypt():
 *   a bare save() throws UnsupportedEncryptionError.
 * - Algorithm 2.B (ISO 32000-2 7.6.4.3.4): tests/helpers/oracle/pdf20-hash.ts is an independent
 *   port. It must agree with qpdf on all 512 cases of tests/fixtures/pdf20-hash/cases.json: the
 *   /U and /O hashes (user password with the /U salt; owner password with the /O salt and /U)
 *   of 256 empty documents qpdf 12.4.2 encrypted with `qpdf --empty --encrypt
 *   --user-password=<user> --owner-password=<owner> --bits=256 -- <out>` under seeded varied
 *   passwords (scripts/oracle/pdf20-hash-cases.ts; its --check has qpdf accept every committed
 *   case again). It must also reproduce the /U and /O of the R6 fixture and three known answers
 *   with salt 0102030405060708, which are its own output, not published values. The library's
 *   algorithm2B is then held to the known answers.
 *
 * A path that fails because of an open defect is a knownDefect() marker keyed to its ledger id.
 * qpdf comes from
 * `QPDF`, then `PATH`; a test that runs qpdf skips with a reason where qpdf is absent locally and
 * fails when `CI` is set.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { algorithm2B } from '../../src/crypto/keyDerivation.js';
import {
  createPdf,
  extractText,
  loadPdf,
  parseContentStream,
  UnsupportedEncryptionError,
} from '../../src/index.js';
import type { EncryptOptions } from '../../src/index.js';
import { fromHex, pdf20Hash, toHex } from '../helpers/oracle/pdf20-hash.js';
import { expectPdfjsText } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../helpers/oracle/qpdf.js';

type Algorithm = NonNullable<EncryptOptions['algorithm']>;

const FIXTURES = join(import.meta.dirname, '../fixtures/encrypted');
const TEXT = 'Oracle text';
const USER = 'user';
const OWNER = 'owner';
const latin1 = new TextDecoder('latin1');
const utf8 = new TextEncoder();

interface FixtureEntry {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly made: string;
  /** The user password as code points (`U+FB01 U+0078 ...`, or empty) when it is not USER. */
  readonly userPasswordCodePoints?: string;
  readonly encryption?: Readonly<Record<string, string>>;
}
const manifest = JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8')) as {
  readonly files: readonly FixtureEntry[];
  readonly extra: readonly FixtureEntry[];
  readonly load: readonly FixtureEntry[];
};

/** The user password of `entry`: its code points when listed, else USER. */
function userPasswordOf(entry: FixtureEntry): string {
  const points = entry.userPasswordCodePoints;
  if (points === undefined) return USER;
  if (points === '') return '';
  return String.fromCodePoint(...points.split(' ').map((u) => Number.parseInt(u.slice(2), 16)));
}
const fixture = (file: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, file)));

/** The text the library extracts from page 1 of `bytes`, opened with `password` when given. */
async function libraryText(bytes: Uint8Array, password?: string): Promise<string> {
  const doc = await (password === undefined ? loadPdf(bytes) : loadPdf(bytes, { password }));
  return extractText(parseContentStream(doc.getPage(0).getContentStream())).trim();
}

/** One page showing TEXT, encrypted by the library with `algorithm`, saved with `compress: false`. */
async function libraryEncrypted(algorithm: Algorithm): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage().drawText(TEXT, { x: 72, y: 720, size: 24 });
  await doc.encrypt({ userPassword: USER, ownerPassword: OWNER, algorithm });
  return doc.save({ compress: false });
}

/** The hex string of `key` (`/U`, `/O`) in the Encrypt dictionary of a qpdf-written file. */
function encryptString(bytes: Uint8Array, key: 'U' | 'O'): Uint8Array {
  const hex = new RegExp(`/${key} <([0-9a-fA-F]+)>`).exec(latin1.decode(bytes))?.[1];
  if (hex === undefined) throw new Error(`no /${key} hex string in the file`);
  return fromHex(hex);
}

const SALT = fromHex('0102030405060708');
/**
 * Known answers of Algorithm 2.B: password, salt 01..08. They are not published values: the port
 * in tests/helpers/oracle/pdf20-hash.ts computed them after it agreed with qpdf on every case of
 * tests/fixtures/pdf20-hash, and a separate port on `node:crypto` of pdf.js's PDF20._hash gives
 * the same three. "test1" reaches the stopping boundary of step 3: a port that stops one round
 * late gives a different hash for it.
 */
const KNOWN_ANSWERS = [
  { password: 'test', hash: '06dfe27c8839ef281cfc27eb79646cf211f0e59b683491153b770ea2b94efe6d' },
  { password: '', hash: '8d1efb4f1bdbb651341704c2139de4f6be05d6d4609af56916b21646ed74825c' },
  { password: 'test1', hash: '40f4847a2f9b0f2d12735645834a317b1e8b5250102f99448c430b35c21f7dec' },
] as const;

/** One R6 Encrypt dictionary of tests/fixtures/pdf20-hash/cases.json (strings as hex). */
interface CaseFile {
  readonly user: string;
  readonly owner: string;
  readonly U: string;
  readonly O: string;
}
/**
 * The Algorithm 2.B cases qpdf 12.4.2 wrote (scripts/oracle/pdf20-hash-cases.ts): from each file
 * the user password with the /U salt, and the owner password with the /O salt and /U as udata.
 */
const QPDF_CASES = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../fixtures/pdf20-hash/cases.json'), 'utf8'),
  ) as { readonly files: readonly CaseFile[] }
).files.flatMap((f, i) => {
  const u = fromHex(f.U);
  const o = fromHex(f.O);
  return [
    {
      name: `file ${i} user`,
      password: f.user,
      salt: u.subarray(32, 40),
      udata: new Uint8Array(0),
      hash: toHex(u.subarray(0, 32)),
    },
    {
      name: `file ${i} owner`,
      password: f.owner,
      salt: o.subarray(32, 40),
      udata: u,
      hash: toHex(o.subarray(0, 32)),
    },
  ];
});

describe('write direction: library encryption read by qpdf and pdf.js', () => {
  test.for([
    ['rc4-40', 2],
    ['rc4-128', 3],
    ['aes-128', 4],
  ] as const)(
    '%s (R%d): qpdf clean, qpdf decrypts the drawn text, pdf.js text equal',
    async ([algorithm, revision], ctx) => {
      requireQpdf(ctx);
      const bytes = await libraryEncrypted(algorithm);
      expect(latin1.decode(bytes)).toContain(`/R ${revision}`);
      expect(latin1.decode(bytes)).not.toContain(TEXT);
      expectQpdfClean(bytes, { password: USER });
      expect(latin1.decode(qpdfDecryptQdf(bytes, USER))).toContain(`(${TEXT})`);
      await expectPdfjsText(bytes, [TEXT], { password: USER });
    },
  );

  test('aes-256 (R6): qpdf --check accepts the user password', async (ctx) => {
    requireQpdf(ctx);
    expectQpdfClean(await libraryEncrypted('aes-256'), { password: USER });
  });

  test('aes-256 (R6): qpdf --decrypt shows the drawn text', async (ctx) => {
    requireQpdf(ctx);
    const bytes = await libraryEncrypted('aes-256');
    expectQpdfClean(bytes, { password: USER });
    const qdf = qpdfDecryptQdf(bytes, USER);
    expect(latin1.decode(qdf)).toContain(`(${TEXT})`);
  });

  test('aes-256 (R6): pdf.js reads the text with the user password', async (ctx) => {
    requireQpdf(ctx);
    const bytes = await libraryEncrypted('aes-256');
    expectQpdfClean(bytes, { password: USER });
    await expectPdfjsText(bytes, [TEXT], { password: USER });
  });
});

describe('read direction: qpdf-encrypted fixtures read by the library', () => {
  test('the manifest matches the directories and every file hash', () => {
    const pdfsIn = (dir: string, prefix: string): string[] =>
      readdirSync(join(FIXTURES, dir))
        .filter((n) => n.endsWith('.pdf'))
        .map((n) => `${prefix}${n}`)
        .sort();
    const sets = [
      { entries: manifest.files, onDisk: pdfsIn('.', ''), count: 6 },
      { entries: manifest.extra, onDisk: pdfsIn('extra', 'extra/'), count: 2 },
      { entries: manifest.load, onDisk: pdfsIn('load', 'load/'), count: 20 },
    ];
    for (const { entries, onDisk, count } of sets) {
      expect(entries.map((f) => f.file).sort()).toEqual(onDisk);
      expect(onDisk).toHaveLength(count);
    }
    for (const entry of [...manifest.files, ...manifest.extra, ...manifest.load]) {
      const bytes = fixture(entry.file);
      expect(bytes.length, `${entry.file} size`).toBe(entry.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), `${entry.file} sha256`).toBe(
        entry.sha256,
      );
    }
  });

  test('source.pdf: qpdf clean, pdf.js and the library read the text', async (ctx) => {
    requireQpdf(ctx);
    const bytes = fixture('source.pdf');
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, [TEXT]);
    expect(await libraryText(bytes)).toBe(TEXT);
  });

  // The encrypted copies of source.pdf (the built and signed files of load/ have other content).
  const copies = [...manifest.files, ...manifest.extra, ...manifest.load].filter(
    (f) => f.encryption !== undefined && f.made.includes('source.pdf'),
  );

  test('the copies of source.pdf: five in the top directory, two in extra/, eight in load/', () => {
    expect(copies.map((f) => f.file.split('/').at(-2) ?? '.').sort()).toEqual([
      ...Array<string>(5).fill('.'),
      ...Array<string>(2).fill('extra'),
      ...Array<string>(8).fill('load'),
    ]);
  });

  test.for(copies)(
    '$file: qpdf accepts the user password and pdf.js reads the text',
    async (entry, ctx) => {
      requireQpdf(ctx);
      const bytes = fixture(entry.file);
      const password = userPasswordOf(entry);
      expectQpdfClean(bytes, { password });
      await expectPdfjsText(bytes, [TEXT], { password });
    },
  );

  test.for(copies)('$file: the library reads the text with the user password', async (entry) => {
    expect(await libraryText(fixture(entry.file), userPasswordOf(entry))).toBe(TEXT);
  });

  test.for(copies)(
    '$file: a bare save() of the decrypted document throws UnsupportedEncryptionError',
    async (entry) => {
      const doc = await loadPdf(fixture(entry.file), { password: userPasswordOf(entry) });
      await expect(doc.save()).rejects.toThrow(UnsupportedEncryptionError);
    },
  );
});

describe('Algorithm 2.B known answers', () => {
  test.for(KNOWN_ANSWERS)(
    'oracle port: password "$password", salt 0102030405060708',
    ({ password, hash }) => {
      expect(toHex(pdf20Hash(utf8.encode(password), SALT))).toBe(hash);
    },
  );

  test(`oracle port agrees with qpdf on all ${QPDF_CASES.length} cases of tests/fixtures/pdf20-hash`, () => {
    expect(QPDF_CASES.length).toBeGreaterThanOrEqual(400);
    const wrong = QPDF_CASES.filter(
      (c) => toHex(pdf20Hash(utf8.encode(c.password), c.salt, c.udata)) !== c.hash,
    ).map((c) => c.name);
    expect(wrong).toEqual([]);
  });

  test('oracle port reproduces the /U and /O hashes qpdf wrote into aes-256-r6.pdf', () => {
    const bytes = fixture('aes-256-r6.pdf');
    const u = encryptString(bytes, 'U');
    const o = encryptString(bytes, 'O');
    expect(u).toHaveLength(48);
    expect(o).toHaveLength(48);
    expect(toHex(pdf20Hash(utf8.encode(USER), u.subarray(32, 40)))).toBe(toHex(u.subarray(0, 32)));
    expect(toHex(pdf20Hash(utf8.encode(OWNER), o.subarray(32, 40), u))).toBe(
      toHex(o.subarray(0, 32)),
    );
  });

  // The known-answer conformance tests of src algorithm2B.
  test.for(KNOWN_ANSWERS)(
    'src algorithm2B: password "$password", salt 0102030405060708 gives the known answer',
    async ({ password, hash }) => {
      expect(toHex(await algorithm2B(utf8.encode(password), SALT))).toBe(hash);
    },
  );
});
