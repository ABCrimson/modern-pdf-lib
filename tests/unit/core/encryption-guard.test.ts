/**
 * Encryption output guards and repeated encrypted saves (0.40.5).
 *
 * - `saveAsStream()` refuses a document with encryption configured.
 * - An encrypted save that asks for object streams is refused.
 * - Saving an encrypted document again encrypts nothing twice: the writer
 *   works on a private copy of the registry.
 * - `linearizePdf()` and `delinearizePdf()` refuse encrypted input bytes: it would write a file
 *   without /Encrypt whose objects are still ciphertext.
 * - The incremental writers and the signing functions do not encrypt what
 *   they append, so they refuse a document with encryption configured and
 *   input bytes that contain the name /Encrypt.
 *
 * Decrypted content is checked with an oracle written here from ISO 32000-1
 * Algorithms 1 and 2 on `node:crypto` (it imports nothing from src/). The
 * qpdf cross-check of repeated encrypted saves runs in the oracle project:
 * tests/oracle/encryption-qpdf.test.ts.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addCounterSignature,
  appendIncrementalUpdate,
  createPdf,
  delinearizePdf,
  embedLtvData,
  enforcePdfA,
  enforcePdfAFull,
  enforcePdfX,
  flattenTransparency,
  linearizePdf,
  optimizeIncrementalSave,
  PdfDict,
  PdfEncryptionHandler,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
  PdfStream,
  PdfString,
  PdfArray,
  PdfWriter,
  prepareForSigning,
  saveDocumentIncremental,
  saveIncremental,
  saveIncrementalWithSignaturePreservation,
  serializePdf,
  signPdf,
  stripProhibitedFeatures,
  UnsupportedEncryptionError,
} from '../../../src/index.js';
import type { EncryptOptions, PdfDocument, PdfObject } from '../../../src/index.js';
import { generateTestCert } from '../../helpers/signature-trust-fixtures.js';

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

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to throw');
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
    const infoRef = registry.register(new PdfDict([['/Title', PdfString.fromText('SecretTitle')]]));
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
    const arrayRef = registry.register(new PdfArray([PdfString.fromText('ArraySecret')]));
    const stringRef = registry.register(PdfString.fromText('LoneSecret'));
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
// 10-11. incremental updates and signing on encrypted input
// ---------------------------------------------------------------------------

/** A hand-written PDF whose trailer is a cross-reference stream carrying /Encrypt. */
function xrefStreamPdfWithEncrypt(): Uint8Array {
  const head =
    '%PDF-1.7\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  const xref =
    '3 0 obj\n<< /Type /XRef /Size 4 /Root 1 0 R /Encrypt 5 0 R /ID [<00> <00>]' +
    ' /W [1 2 1] /Index [0 4] /Length 0 >>\nstream\n\nendstream\nendobj\n';
  return new TextEncoder().encode(`${head}${xref}startxref\n${head.length}\n%%EOF\n`);
}

describe('incremental saves of an encrypted document', () => {
  it.for(['aes-128', 'rc4-128'] as const)(
    '%s: saveDocumentIncremental() rejects a document with encryption configured',
    async (algorithm) => {
      const doc = await buildRichDoc(algorithm);
      const first = await doc.save();
      doc.addPage().drawText('IncrementalSecret', { x: 50, y: 700, size: 12 });
      expectGuardError(
        await rejectionOf(saveDocumentIncremental(first, doc)),
        'saveDocumentIncremental()',
      );
    },
  );

  it('saveDocumentIncremental() rejects encrypted original bytes for a document without encryption', async () => {
    const encrypted = await (await buildRichDoc('aes-128')).save();
    const plain = createPdf();
    plain.addPage().drawText('IncrementalSecret', { x: 50, y: 700, size: 12 });
    expectGuardError(
      await rejectionOf(saveDocumentIncremental(encrypted, plain)),
      'saveDocumentIncremental()',
    );
  });

  it('saveIncremental() throws for encrypted original bytes', async () => {
    const encrypted = await (await buildRichDoc('rc4-128')).save();
    const registry = new PdfObjectRegistry();
    const ref = registry.register(PdfString.fromText('IncrementalSecret'));
    expectGuardError(
      thrownBy(() =>
        saveIncremental(
          encrypted,
          registry,
          { catalogRef: ref, infoRef: ref, pagesRef: ref },
          new Set([ref.objectNumber]),
        ),
      ),
      'saveIncremental()',
    );
  });

  it('an unencrypted document still saves incrementally', async () => {
    const doc = await buildRichDoc();
    const first = await doc.save();
    doc.addPage();
    const { bytes } = await saveDocumentIncremental(first, doc);
    expect(bytes.subarray(0, first.length)).toEqual(first);
    expect(latin1.decode(bytes)).not.toContain('/Encrypt');
  });
});

describe('signing and appending to an encrypted PDF', () => {
  let signer: { certificate: Uint8Array; privateKey: Uint8Array };
  let encrypted: Uint8Array;

  beforeAll(async () => {
    signer = await generateTestCert('Guard Signer');
    encrypted = await (await buildRichDoc('aes-128')).save();
  });

  it('prepareForSigning() throws', () => {
    expectGuardError(
      thrownBy(() => prepareForSigning(encrypted, 'Signature1')),
      'prepareForSigning()',
    );
  });

  it('signPdf() rejects', async () => {
    expectGuardError(await rejectionOf(signPdf(encrypted, 'Signature1', signer)), 'signPdf()');
  });

  it('PdfDocument.sign() rejects for a document with encryption configured', async () => {
    const doc = await buildRichDoc('rc4-128');
    expectGuardError(await rejectionOf(doc.sign('Signature1', signer)), 'signPdf()');
  });

  it('addCounterSignature() rejects', async () => {
    expectGuardError(
      await rejectionOf(addCounterSignature(encrypted, 0, signer)),
      'addCounterSignature()',
    );
  });

  it('embedLtvData() rejects', async () => {
    expectGuardError(
      await rejectionOf(embedLtvData(encrypted, { extraCertificates: [signer.certificate] })),
      'embedLtvData()',
    );
  });

  it('optimizeIncrementalSave() throws', () => {
    const change = {
      objectNumber: 999,
      generationNumber: 0,
      newContent: new TextEncoder().encode('(IncrementalSecret)'),
    };
    expectGuardError(
      thrownBy(() => optimizeIncrementalSave(encrypted, [change])),
      'optimizeIncrementalSave()',
    );
  });

  it('saveIncrementalWithSignaturePreservation() throws', async () => {
    const modified = await (await buildRichDoc()).save();
    expectGuardError(
      thrownBy(() => saveIncrementalWithSignaturePreservation(encrypted, modified)),
      'saveIncrementalWithSignaturePreservation()',
    );
  });

  it('appendIncrementalUpdate() throws', () => {
    const object = {
      objectNumber: 999,
      generationNumber: 0,
      data: new TextEncoder().encode('(IncrementalSecret)'),
    };
    expectGuardError(
      thrownBy(() => appendIncrementalUpdate(encrypted, [object])),
      'appendIncrementalUpdate()',
    );
  });

  it('finds /Encrypt in a cross-reference stream dictionary', () => {
    expectGuardError(
      thrownBy(() => prepareForSigning(xrefStreamPdfWithEncrypt(), 'Signature1')),
      'prepareForSigning()',
    );
  });

  const appendOne = (bytes: Uint8Array): Uint8Array =>
    appendIncrementalUpdate(bytes, [
      { objectNumber: 900, generationNumber: 0, data: new TextEncoder().encode('(x)') },
    ]);
  const toBytes = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

  it.for([
    ['a signed object number', '/Encrypt +$1 $2 R'],
    ['a signed generation number', '/Encrypt $1 +$2 R'],
    ['a real object number', '/Encrypt $1.0 $2 R'],
    ['a line break before the reference', '/Encrypt\n$1 $2 R'],
    ['an escaped letter with a lower-case hex digit', '/E#6ecrypt $1 $2 R'],
    ['an escaped letter with an upper-case hex digit', '/E#6Ecrypt $1 $2 R'],
    ['a vertical tab after the name', '/Encrypt\v$1 $2 R'],
    ['a comment before the reference', '/Encrypt%c\n$1 $2 R'],
    ['an escaped name', '/Encr#79pt $1 $2 R'],
    ['an escaped first letter', '/#45ncrypt $1 $2 R'],
    ['a dictionary with no space before it', '/Encrypt<</Filter/Standard/V 4>>'],
    ['a malformed value', '/Encrypt['],
  ] as const)(
    'appendIncrementalUpdate() finds /Encrypt written with %s',
    async ([, replacement]) => {
      const doc = await buildRichDoc('rc4-128');
      const text = latin1.decode(await doc.save()).replace(/\/Encrypt (\d+) (\d+) R/, replacement);
      expect(text).not.toMatch(/\/Encrypt \d+ \d+ R/);
      expectGuardError(
        thrownBy(() => appendOne(toBytes(text))),
        'appendIncrementalUpdate()',
      );
    },
  );

  it.for([
    ['/EncryptMetadata', 'the name /EncryptMetadata'],
    ['/Encrypt2', 'the name /Encrypt2'],
    ['/encrypt', 'the name /encrypt in lower case'],
    ['Encrypt', 'the text Encrypt without a solidus'],
  ] as const)(
    'appendIncrementalUpdate() does not refuse an unencrypted file that holds %s',
    async ([text]) => {
      const doc = createPdf();
      doc.setTitle(`title ${text} end`);
      doc.addPage();
      const bytes = await doc.save();
      expect(latin1.decode(bytes)).toContain(text);
      expect(() => appendOne(bytes)).not.toThrow();
    },
  );

  it('appendIncrementalUpdate() refuses an unencrypted file with the name /Encrypt in an uncompressed content stream', async () => {
    const doc = createPdf();
    doc.addPage().drawText('/Encrypt', { x: 50, y: 700, size: 12 });
    const bytes = await doc.save();
    expect(latin1.decode(bytes)).toContain('/Encrypt');
    expectGuardError(
      thrownBy(() => appendOne(bytes)),
      'appendIncrementalUpdate()',
    );
  });

  it('enforcePdfA(), enforcePdfAFull() and enforcePdfX() find /Encrypt written as an escaped name', async () => {
    const text = latin1
      .decode(await (await buildRichDoc('rc4-128')).save())
      .replace(/\/Encrypt (\d+ 0 R)/, '/Encr#79pt $1');
    expect(text).not.toContain('/Encrypt');
    const bytes = toBytes(text);
    const withJs = toBytes(
      text.replace('/Type /Catalog', '/Type /Catalog /OpenAction << /S /JavaScript /JS (x) >>'),
    );
    expectGuardError(await rejectionOf(enforcePdfA(withJs, '2b')), 'enforcePdfA()');
    expectGuardError(await rejectionOf(enforcePdfA(bytes, '2b')), 'enforcePdfA()');
    expectGuardError(await rejectionOf(enforcePdfAFull(bytes, '2b')), 'enforcePdfAFull()');
    expectGuardError(
      thrownBy(() => enforcePdfX(bytes, { level: 'X-4', outputIntent: { condition: 'FOGRA39' } })),
      'enforcePdfX()',
    );
  });

  it.for(['rc4-128', 'aes-128'] as const)(
    '%s: flattenTransparency() and stripProhibitedFeatures() throw',
    async (algorithm) => {
      const encrypted = await (await buildRichDoc(algorithm)).save();
      expectGuardError(
        thrownBy(() => flattenTransparency(encrypted)),
        'flattenTransparency()',
      );
      expectGuardError(
        thrownBy(() => stripProhibitedFeatures(encrypted)),
        'stripProhibitedFeatures()',
      );
    },
  );

  it.for(['rc4-128', 'aes-128'] as const)(
    '%s: enforcePdfA(), enforcePdfAFull() and enforcePdfX() throw UnsupportedEncryptionError',
    async (algorithm) => {
      const encrypted = await (await buildRichDoc(algorithm)).save();
      expectGuardError(await rejectionOf(enforcePdfA(encrypted, '2b')), 'enforcePdfA()');
      expectGuardError(
        await rejectionOf(enforcePdfAFull(encrypted, '2b')),
        'document is encrypted',
      );
      expectGuardError(
        thrownBy(() =>
          enforcePdfX(encrypted, {
            level: 'X-4',
            outputIntent: { condition: 'FOGRA39' },
          }),
        ),
        'document is encrypted',
      );
    },
  );

  it('the linearization message says the rewritten file would have no /Encrypt entry', async () => {
    const encrypted = await (await buildRichDoc('rc4-128')).save();
    expectGuardError(
      await rejectionOf(linearizePdf(encrypted)),
      'the rewritten file would have no /Encrypt entry',
    );
  });

  it('an unencrypted PDF is still signed', async () => {
    const plain = await (await buildRichDoc()).save();
    const signed = await signPdf(plain, 'Signature1', signer);
    expect(signed.subarray(0, plain.length)).toEqual(plain);
    expect(latin1.decode(signed)).toContain('/ByteRange');
  });
});

describe('linearizePdf() on an encrypted PDF', () => {
  it.for(['rc4-128', 'aes-128'] as const)('%s: rejects', async (algorithm) => {
    const encrypted = await (await buildRichDoc(algorithm)).save();
    expectGuardError(await rejectionOf(linearizePdf(encrypted)), 'linearizePdf()');
  });

  it('finds /Encrypt in a cross-reference stream dictionary', async () => {
    expectGuardError(await rejectionOf(linearizePdf(xrefStreamPdfWithEncrypt())), 'linearizePdf()');
  });

  it('delinearizePdf() rejects a linearized input that has /Encrypt', async () => {
    const linearized = await linearizePdf(await (await buildRichDoc()).save());
    const tampered = latin1.decode(linearized).replace('/Root', '/Encrypt 99 0 R /Root');
    expect(tampered).toContain('/Encrypt');
    const bytes = Uint8Array.from(tampered, (ch) => ch.charCodeAt(0));
    expectGuardError(await rejectionOf(delinearizePdf(bytes)), 'delinearizePdf()');
  });

  it('an unencrypted PDF is still linearized', async () => {
    const plain = await (await buildRichDoc()).save();
    const out = await linearizePdf(plain);
    expect(latin1.decode(out)).toContain('/Linearized');
    expect(latin1.decode(out)).not.toContain('/Encrypt');
  });
});
