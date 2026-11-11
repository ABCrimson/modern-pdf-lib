/**
 * Encryption output guards and repeated encrypted saves (0.40.5).
 *
 * - `saveAsStream()` refuses a document with encryption configured.
 * - An encrypted save that asks for object streams is refused.
 * - Saving an encrypted document again encrypts nothing twice: the writer
 *   works on a private copy of the registry.
 *
 * Decrypted content is checked with an oracle written here from ISO 32000-1
 * Algorithms 1 and 2 on `node:crypto` (it imports nothing from src/), and,
 * where qpdf 12.4.2 is available (`QPDF` env var, then `PATH`), with
 * `qpdf --decrypt --qdf`. qpdf cases skip locally with a reason when qpdf is
 * absent and fail when `CI` is set.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPdf,
  PdfDict,
  PdfEncryptionHandler,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
  PdfStream,
  PdfString,
  PdfArray,
  PdfWriter,
  serializePdf,
  UnsupportedEncryptionError,
} from '../../../src/index.js';
import type { EncryptOptions, PdfDocument, PdfObject } from '../../../src/index.js';

type Algorithm = NonNullable<EncryptOptions['algorithm']>;

const SAMPLE_PNG = join(import.meta.dirname, '../../fixtures/images/sample.png');
const SECRETS = ['AttachmentSecret', 'DescSecret', 'HelloSecret', 'SecretTitle'] as const;
const latin1 = new TextDecoder('latin1');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function buildRichDoc(algorithm?: Algorithm): Promise<PdfDocument> {
  const doc = createPdf();
  doc.setTitle('SecretTitle');
  const page = doc.addPage();
  page.drawText('HelloSecret', { x: 50, y: 700, size: 12 });
  const image = await doc.embedPng(new Uint8Array(readFileSync(SAMPLE_PNG)));
  page.drawImage(image, { x: 50, y: 500, width: 50, height: 50 });
  doc.attachFile('note.txt', new TextEncoder().encode('AttachmentSecret'), 'text/plain', {
    description: 'DescSecret',
  });
  if (algorithm !== undefined) {
    await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm });
  }
  return doc;
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the promise to reject');
}

function expectGuardError(err: unknown, fragment: string): void {
  expect(err).toBeInstanceOf(UnsupportedEncryptionError);
  if (!(err instanceof UnsupportedEncryptionError)) return;
  expect(err.name).toBe('UnsupportedEncryptionError');
  expect(err.code).toBe('unsupported-encryption-path');
  expect(err.message).toContain(fragment);
}

// ---------------------------------------------------------------------------
// Independent decryption oracle (R 2-4 only; imports nothing from src/)
// ---------------------------------------------------------------------------

const PASSWORD_PAD = Uint8Array.fromHex(
  '28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a',
);

function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`oracle: ${what} not found`);
  return value;
}

function md5(...parts: Uint8Array[]): Uint8Array {
  const hash = createHash('md5');
  for (const part of parts) hash.update(part);
  return new Uint8Array(hash.digest());
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  const at = (i: number): number => s[i] ?? 0;
  const swap = (i: number, j: number): void => {
    const t = at(i);
    s[i] = at(j);
    s[j] = t;
  };
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + at(i) + (key[i % key.length] ?? 0)) & 255;
    swap(i, j);
  }
  const out = new Uint8Array(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + at(i)) & 255;
    swap(i, j);
    out[n] = (data[n] ?? 0) ^ at((at(i) + at(j)) & 255);
  }
  return out;
}

interface RawObject {
  readonly dict: string;
  readonly stream: Uint8Array | undefined;
}

/** Reads `N 0 obj ... endobj` bodies; the last definition of a number wins, as in the xref. */
function readObjects(bytes: Uint8Array): Map<number, RawObject> {
  const text = latin1.decode(bytes);
  const objects = new Map<number, RawObject>();
  for (const match of text.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj\n/g)) {
    const body = need(match[2], 'object body');
    const streamAt = body.indexOf('\nstream\n');
    if (streamAt < 0) {
      objects.set(Number(match[1]), { dict: body, stream: undefined });
      continue;
    }
    const dict = body.slice(0, streamAt);
    const length = Number(need(/\/Length (\d+)/.exec(dict)?.[1], 'stream /Length'));
    const start = match.index + match[0].indexOf('\nstream\n') + 8;
    objects.set(Number(match[1]), { dict, stream: bytes.slice(start, start + length) });
  }
  return objects;
}

/** Decrypts the /EmbeddedFile stream and the Filespec /Desc string exactly once. */
function decryptOnce(
  bytes: Uint8Array,
  password: string,
): { embeddedFile: string; description: string } {
  const text = latin1.decode(bytes);
  const trailer = text.slice(text.lastIndexOf('trailer'));
  const encryptNum = Number(need(/\/Encrypt (\d+) 0 R/.exec(trailer)?.[1], 'trailer /Encrypt'));
  const id0 = Uint8Array.fromHex(need(/\/ID \[<([0-9a-f]+)>/i.exec(trailer)?.[1], 'trailer /ID'));
  const objects = readObjects(bytes);
  const enc = need(objects.get(encryptNum), 'Encrypt dict').dict;
  const revision = Number(need(/\/R (\d+)/.exec(enc)?.[1], '/R'));
  if (revision < 2 || revision > 4) throw new Error(`oracle: unsupported /R ${revision}`);
  const keyBytes = Number(/\/Length (\d+)/.exec(enc)?.[1] ?? '40') / 8;
  const aes = /\/CFM \/AESV2/.test(enc);
  const owner = Uint8Array.fromHex(need(/\/O <([0-9a-f]+)>/i.exec(enc)?.[1], '/O'));
  const permissions = Number(need(/\/P (-?\d+)/.exec(enc)?.[1], '/P'));

  // Algorithm 2: file key.
  const padded = new Uint8Array(32);
  const pw = new TextEncoder().encode(password).slice(0, 32);
  padded.set(pw);
  padded.set(PASSWORD_PAD.subarray(0, 32 - pw.length), pw.length);
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, permissions, true);
  let fileKey = md5(padded, owner, p, id0).subarray(0, keyBytes);
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) fileKey = md5(fileKey).subarray(0, keyBytes);
  }

  // Algorithm 1: per-object key, then RC4 or AES-128-CBC.
  const decrypt = (num: number, data: Uint8Array): Uint8Array => {
    const salt = aes ? new TextEncoder().encode('sAlT') : new Uint8Array(0);
    const objKey = md5(
      fileKey,
      Uint8Array.of(num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0),
      salt,
    ).subarray(0, Math.min(keyBytes + 5, 16));
    if (!aes) return rc4(objKey, data);
    const decipher = createDecipheriv('aes-128-cbc', objKey, data.subarray(0, 16));
    const head = decipher.update(data.subarray(16));
    const tail = decipher.final();
    const plain = new Uint8Array(head.length + tail.length);
    plain.set(head);
    plain.set(tail, head.length);
    return plain;
  };

  const entries = [...objects];
  const [fileNum, file] = need(
    entries.find(([, o]) => /\/Type \/EmbeddedFile\b/.test(o.dict)),
    '/EmbeddedFile stream',
  );
  const [specNum, spec] = need(
    entries.find(([, o]) => /\/Type \/Filespec\b/.test(o.dict)),
    '/Filespec dict',
  );
  const descHex = need(/\/Desc <([0-9a-f]+)>/i.exec(spec.dict)?.[1], 'Filespec /Desc');
  return {
    embeddedFile: latin1.decode(decrypt(fileNum, need(file.stream, 'embedded file data'))),
    description: latin1.decode(decrypt(specNum, Uint8Array.fromHex(descHex))),
  };
}

// ---------------------------------------------------------------------------
// qpdf (QPDF env var, then PATH)
// ---------------------------------------------------------------------------

const QPDF_BIN = process.env['QPDF'] ?? 'qpdf';
const QPDF_SKIP = 'qpdf not found: set QPDF=<path> or put qpdf 12.4.2 on PATH; required in CI';
let qpdfVersion: string | undefined;
let workDir: string | undefined;

beforeAll(() => {
  try {
    qpdfVersion = execFileSync(QPDF_BIN, ['--version'], { encoding: 'utf8' }).split('\n')[0];
  } catch {
    qpdfVersion = undefined;
  }
});

afterAll(() => {
  if (workDir !== undefined) rmSync(workDir, { recursive: true, force: true });
});

function qdfOf(bytes: Uint8Array, name: string): Uint8Array {
  workDir ??= mkdtempSync(join(tmpdir(), 'encryption-guard-'));
  const input = join(workDir, `${name}.pdf`);
  const output = join(workDir, `${name}.qdf`);
  writeFileSync(input, bytes);
  // execFileSync throws on any non-zero exit (qpdf exits 3 on warnings), with stderr attached.
  execFileSync(
    QPDF_BIN,
    [
      '--password=u',
      '--decrypt',
      '--qdf',
      '--no-original-object-ids',
      '--static-id',
      input,
      output,
    ],
    { stdio: 'pipe' },
  );
  return new Uint8Array(readFileSync(output));
}

async function twoSavesDecryptIdentically(algorithm: Algorithm): Promise<void> {
  const doc = await buildRichDoc(algorithm);
  const s1 = await doc.save({ compress: false });
  const s2 = await doc.save({ compress: false });
  const q1 = qdfOf(s1, `${algorithm}-1`);
  const q2 = qdfOf(s2, `${algorithm}-2`);
  expect(q2).toEqual(q1);
  for (const qdf of [q1, q2]) {
    const text = latin1.decode(qdf);
    expect(text).toContain('AttachmentSecret');
    expect(text).toContain('DescSecret');
  }
}

// ---------------------------------------------------------------------------
// 1. saveAsStream guard
// ---------------------------------------------------------------------------

describe('saveAsStream() on an encrypted document', () => {
  it.for(['aes-128', 'rc4-128'] as const)(
    '%s: throws UnsupportedEncryptionError before touching the document',
    async (algorithm) => {
      const doc = createPdf();
      await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm });
      expect(() => doc.saveAsStream()).toThrow(UnsupportedEncryptionError);
      let caught: unknown;
      try {
        doc.saveAsStream();
      } catch (err) {
        caught = err;
      }
      expectGuardError(caught, 'saveAsStream()');
      expect(doc.getPageCount()).toBe(0);
    },
  );
});

// ---------------------------------------------------------------------------
// 2. object-stream guard
// ---------------------------------------------------------------------------

describe('objectStreamThreshold with encryption', () => {
  it('save({ objectStreamThreshold: 1 }) rejects', async () => {
    const doc = await buildRichDoc('aes-128');
    expectGuardError(
      await rejectionOf(doc.save({ objectStreamThreshold: 1 })),
      'objectStreamThreshold',
    );
  });

  it('rejects even when the threshold would never be met', async () => {
    const doc = await buildRichDoc('aes-128');
    expectGuardError(
      await rejectionOf(doc.save({ objectStreamThreshold: 100_000 })),
      'objectStreamThreshold',
    );
  });

  it('saveAsBase64({ objectStreamThreshold: 1 }) rejects (guard is in the writer path)', async () => {
    const doc = await buildRichDoc('aes-128');
    expectGuardError(
      await rejectionOf(doc.saveAsBase64({ objectStreamThreshold: 1 })),
      'objectStreamThreshold',
    );
  });

  it('serializePdf with a handler and a threshold rejects', async () => {
    const registry = new PdfObjectRegistry();
    const pagesRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Pages')],
        ['/Kids', new PdfArray()],
        ['/Count', PdfNumber.of(0)],
      ]),
    );
    const catalogRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Catalog')],
        ['/Pages', pagesRef],
      ]),
    );
    const infoRef = registry.register(new PdfDict());
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'rc4-128',
    });
    const sizeBefore = registry.size;
    expectGuardError(
      await rejectionOf(
        serializePdf(
          registry,
          { catalogRef, infoRef, pagesRef },
          { objectStreamThreshold: 5 },
          handler,
        ),
      ),
      'objectStreamThreshold',
    );
    expect(registry.size).toBe(sizeBefore);
  });

  it('objectStreamThreshold: Infinity and no threshold both save encrypted', async () => {
    const doc = await buildRichDoc('aes-128');
    for (const bytes of [await doc.save({ objectStreamThreshold: Infinity }), await doc.save()]) {
      expect(latin1.decode(bytes)).toContain('/Encrypt');
    }
  });

  it('an unencrypted document still writes object streams', async () => {
    const doc = await buildRichDoc();
    const bytes = await doc.save({ objectStreamThreshold: 1 });
    expect(latin1.decode(bytes)).toContain('/ObjStm');
  });
});

// ---------------------------------------------------------------------------
// 3-5. repeated encrypted saves
// ---------------------------------------------------------------------------

describe('repeated saves of an encrypted document', () => {
  it('RC4: no save writes any secret in plaintext', async () => {
    const doc = await buildRichDoc('rc4-128');
    for (let n = 1; n <= 3; n++) {
      const text = latin1.decode(await doc.save({ compress: false }));
      for (const secret of SECRETS) {
        expect(text.includes(secret), `save ${n} contains ${secret}`).toBe(false);
      }
    }
  });

  it('the writer leaves the registry untouched and writes identical RC4 (R3) bytes twice', async () => {
    const registry = new PdfObjectRegistry();
    const pagesRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Pages')],
        ['/Kids', new PdfArray()],
        ['/Count', PdfNumber.of(0)],
      ]),
    );
    const catalogRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Catalog')],
        ['/Pages', pagesRef],
      ]),
    );
    const infoRef = registry.register(new PdfDict([['/Title', PdfString.literal('SecretTitle')]]));
    registry.register(PdfStream.fromString('AttachmentSecret'));
    const structure = { catalogRef, infoRef, pagesRef };
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'rc4-128',
    });

    const snapshot = (): {
      size: number;
      nextNumber: number;
      objects: { num: number; kind: PdfObject['kind']; bytes: string; filter: boolean }[];
    } => ({
      size: registry.size,
      nextNumber: registry.nextNumber,
      objects: [...registry].map((entry) => {
        const chunks: string[] = [];
        entry.object.serialize({
          write: (data: Uint8Array) => chunks.push(latin1.decode(data)),
          writeString: (str: string) => chunks.push(str),
        });
        return {
          num: entry.ref.objectNumber,
          kind: entry.object.kind,
          bytes: chunks.join(''),
          filter: entry.object.kind === 'stream' && entry.object.dict.has('/Filter'),
        };
      }),
    });

    const before = snapshot();
    const w1 = await serializePdf(registry, structure, { compress: true }, handler);
    const w2 = await serializePdf(registry, structure, { compress: true }, handler);
    expect(w2).toEqual(w1);
    expect(snapshot()).toEqual(before);
  });

  it('the writer encrypts strings in an indirect array and an indirect string (RC4)', async () => {
    const registry = new PdfObjectRegistry();
    const pagesRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Pages')],
        ['/Kids', new PdfArray()],
        ['/Count', PdfNumber.of(0)],
      ]),
    );
    const arrayRef = registry.register(new PdfArray([PdfString.literal('ArraySecret')]));
    const stringRef = registry.register(PdfString.literal('LoneSecret'));
    const catalogRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Catalog')],
        ['/Pages', pagesRef],
        ['/Secrets', arrayRef],
        ['/Lone', stringRef],
      ]),
    );
    const infoRef = registry.register(new PdfDict());
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'rc4-128',
    });
    const entries = (): string[] =>
      [...registry].map((entry) => {
        const chunks: string[] = [];
        entry.object.serialize({
          write: (data: Uint8Array) => chunks.push(latin1.decode(data)),
          writeString: (str: string) => chunks.push(str),
        });
        return `${entry.ref.objectNumber}:${chunks.join('')}`;
      });

    const before = entries();
    const text = latin1.decode(
      await serializePdf(registry, { catalogRef, infoRef, pagesRef }, { compress: false }, handler),
    );
    expect(text).toContain('/Encrypt');
    expect(text.includes('ArraySecret'), 'ArraySecret in plaintext').toBe(false);
    expect(text.includes('LoneSecret'), 'LoneSecret in plaintext').toBe(false);
    expect(entries()).toEqual(before);
  });

  it('an encrypted PdfWriter writes an object assigned after construction', async () => {
    const registry = new PdfObjectRegistry();
    const pagesRef = registry.allocate();
    const catalogRef = registry.register(
      new PdfDict([
        ['/Type', PdfName.of('Catalog')],
        ['/Pages', pagesRef],
      ]),
    );
    const infoRef = registry.register(new PdfDict());
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'rc4-128',
    });
    const writer = new PdfWriter(
      registry,
      { catalogRef, infoRef, pagesRef },
      { compress: false },
      handler,
    );
    registry.assign(
      pagesRef,
      new PdfDict([
        ['/Type', PdfName.of('Pages')],
        ['/Kids', new PdfArray()],
        ['/Count', PdfNumber.of(0)],
      ]),
    );
    const text = latin1.decode(await writer.write());
    expect(text).toContain(`\n${pagesRef.objectNumber} 0 obj\n`);
  });

  it.for(['rc4-128', 'aes-128'] as const)(
    '%s: each save decrypts once to the original content (node:crypto oracle)',
    async (algorithm) => {
      const doc = await buildRichDoc(algorithm);
      const s1 = await doc.save({ compress: false });
      const s2 = await doc.save({ compress: false });
      for (const bytes of [s1, s2]) {
        expect(decryptOnce(bytes, 'u')).toEqual({
          embeddedFile: 'AttachmentSecret',
          description: 'DescSecret',
        });
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 6-9. qpdf and the release-gate wording
// ---------------------------------------------------------------------------

describe('qpdf cross-check', () => {
  it('qpdf is available', (ctx) => {
    if (qpdfVersion === undefined) {
      if (process.env['CI']) {
        throw new Error(
          'qpdf 12.4.2 is required in CI (set QPDF or install it; see the ci.yml step)',
        );
      }
      ctx.skip(QPDF_SKIP);
    }
    expect(qpdfVersion).toMatch(/^qpdf version 12\./);
  });

  it.for(['aes-128', 'rc4-128'] as const)(
    '%s: two saves give identical qpdf --decrypt --qdf output',
    async (algorithm, ctx) => {
      if (qpdfVersion === undefined) ctx.skip(QPDF_SKIP);
      await twoSavesDecryptIdentically(algorithm);
    },
  );

  it.fails('two saves of one AES-256 (R6) document give identical qpdf --decrypt --qdf output (crypto-security-01 until 0.40.9)', async (ctx) => {
    if (qpdfVersion === undefined) ctx.skip(QPDF_SKIP);
    await twoSavesDecryptIdentically('aes-256');
  });

  it.fails('two doc.save() calls of one RC4 (R3) document give identical bytes (core-document-08 until 0.41.2)', async () => {
    const doc = await buildRichDoc('rc4-128');
    const s1 = await doc.save({ compress: false });
    const s2 = await doc.save({ compress: false });
    expect(s2).toEqual(s1);
  });
});
