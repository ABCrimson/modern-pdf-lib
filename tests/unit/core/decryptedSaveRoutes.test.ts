/**
 * Every route that writes a document, or moves objects into another document, refuses a
 * document whose objects were decrypted on load until `encrypt()` is called on the document
 * being written.
 *
 * The refusal lives where bytes are produced: `serializePdf()`, `PdfWriter.write()` and the
 * `PdfStreamWriter` constructor refuse a registry that holds decrypted content unless they are
 * given an encryption handler, and `saveIncremental()` and `saveDocumentIncremental()` refuse it
 * always. `save()` and `saveAsStream()` check first, before they change the document or run a
 * plugin hook; `sanitizePdf()` inherits the writer's refusal, and the copy that `copy()` returns
 * refuses to save.
 * Pages, embedded pages and metadata carry the record into the document they are brought into.
 * After `encrypt()`, the `/Contents` of a signature dictionary is written unencrypted (ISO
 * 32000-2:2020, 7.6.1); its bytes equal the source's only once hex strings are written back
 * byte for byte, which the marker below tracks.
 *
 * Sources: tests/fixtures/encrypted/aes-128-r4.pdf (user password `user`),
 * load/aes-128-r4.empty.pdf (empty user password, opened without one), load/signed-aes-128.pdf
 * (qpdf's AESV2 copy of the signed corpus file, user password `user`) and source.pdf (the
 * unencrypted plaintext of the first two).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TestContext } from 'vitest';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type { PdfDocument } from '../../../src/core/pdfDocument.js';
import { copyPages, mergePdfs, splitPdf } from '../../../src/core/documentMerge.js';
import { embedPageAsFormXObject } from '../../../src/core/pdfEmbed.js';
import { PdfWriter, serializePdf } from '../../../src/core/io/pdfWriter.js';
import { PdfStreamWriter } from '../../../src/core/io/pdfStream.js';
import {
  saveDocumentIncremental,
  saveIncremental,
} from '../../../src/core/io/incrementalWriter.js';
import type { DocumentStructure } from '../../../src/core/pdfCatalog.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  type PdfObject,
  PdfObjectRegistry,
  PdfRef,
  PdfStream,
  PdfString,
} from '../../../src/core/pdfObjects.js';
import { isDecryptedFromEncryptedFile } from '../../../src/core/internal/flateStream.js';
import { sanitizePdf } from '../../../src/security/sanitize.js';
import type { EncryptAlgorithm } from '../../../src/crypto/encryptionHandler.js';
import { UnsupportedEncryptionError } from '../../../src/errors.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../../helpers/oracle/qpdf.js';

const DIR = join(import.meta.dirname, '../../fixtures/encrypted');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(DIR, name)));
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

/** aes-128-r4.pdf opened with its user password: every object decrypted. */
const decrypted = (): Promise<PdfDocument> =>
  loadPdf(fixture('aes-128-r4.pdf'), { password: 'user' });
/** The unencrypted plaintext of the encrypted fixtures. */
const plain = (): Promise<PdfDocument> => loadPdf(fixture('source.pdf'));

const NEW_PASSWORDS = { userPassword: 'u2', ownerPassword: 'o2' } as const;

/** The catalog, page tree and Info references of a loaded registry, for the low-level writers. */
function structureOf(registry: PdfObjectRegistry): DocumentStructure {
  let catalogRef: PdfRef | undefined;
  let pagesRef: PdfRef | undefined;
  let infoRef: PdfRef | undefined;
  for (const { ref, object } of registry) {
    if (object.kind !== 'dict') continue;
    const type = object.get('/Type');
    if (type?.kind === 'name' && type.value === '/Catalog') {
      catalogRef = ref;
      pagesRef = object.get('/Pages') as PdfRef;
    }
    if (object.has('/Title') && object.has('/Producer')) infoRef ??= ref;
  }
  if (catalogRef === undefined || pagesRef === undefined) throw new Error('no catalog');
  return { catalogRef, pagesRef, infoRef: infoRef ?? catalogRef };
}

/** Reads a stream to its end. */
const drain = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> =>
  new Uint8Array(await new Response(stream).arrayBuffer());

const refused = (promise: Promise<unknown>) =>
  expect(promise).rejects.toBeInstanceOf(UnsupportedEncryptionError);

describe('the low-level writers refuse a decrypted registry', () => {
  it('serializePdf() without an encryption handler', async () => {
    const doc = await decrypted();
    const registry = doc.getRegistry();
    await refused(serializePdf(registry, structureOf(registry), { compress: false }));
  });

  it('new PdfWriter(...).write() without an encryption handler', async () => {
    const doc = await decrypted();
    const registry = doc.getRegistry();
    await refused(new PdfWriter(registry, structureOf(registry), { compress: false }).write());
  });

  it('new PdfStreamWriter(...) (the stream writer never encrypts)', async () => {
    const doc = await decrypted();
    const registry = doc.getRegistry();
    expect(() => new PdfStreamWriter(registry, structureOf(registry))).toThrow(
      UnsupportedEncryptionError,
    );
  });

  it('a fresh document and an unencrypted load go through all three', async () => {
    for (const doc of [createPdf(), await plain()]) {
      if (doc.getPageCount() === 0) doc.addPage();
      const bytes = await doc.save();
      const registry = (await loadPdf(bytes)).getRegistry();
      const structure = structureOf(registry);
      expect(latin1(await serializePdf(registry, structure))).toContain('%%EOF');
      expect(latin1(await new PdfWriter(registry, structure).write())).toContain('%%EOF');
      expect(
        latin1(await drain(new PdfStreamWriter(registry, structure).toReadableStream())),
      ).toContain('%%EOF');
    }
  });
});

describe('the incremental writers refuse a decrypted registry', () => {
  it('saveIncremental() with the registry of a decrypted document', async () => {
    const base = await createPdf().save();
    const registry = (await decrypted()).getRegistry();
    const all = new Set<number>();
    for (const { ref } of registry) all.add(ref.objectNumber);
    expect(() => saveIncremental(base, registry, structureOf(registry), all)).toThrow(
      UnsupportedEncryptionError,
    );
  });

  it('saveDocumentIncremental() with a decrypted document', async () => {
    const base = await createPdf().save();
    await refused(saveDocumentIncremental(base, await decrypted()));
  });

  it('an unencrypted document still saves incrementally', async () => {
    const base = await createPdf().save();
    const doc = await loadPdf(base);
    const { bytes } = await saveDocumentIncremental(base, doc);
    expect(latin1(bytes)).not.toContain('/Encrypt');
  });
});

describe('the save family and copy() of a decrypted document', () => {
  it('a refused save changes nothing and runs no plugin hook', async () => {
    const doc = await decrypted();
    const pages = doc.getPageCount();
    let calls = 0;
    doc.use({
      name: 'spy',
      onBeforeSave() {
        calls++;
      },
      onAfterSave(bytes) {
        calls++;
        return bytes;
      },
    });
    const zero = await loadPdf(
      await (async () => {
        const z = createPdf();
        await z.encrypt({ userPassword: 'u', ownerPassword: 'o' });
        return z.save({ addDefaultPage: false });
      })(),
      { password: 'u' },
    );
    expect(zero.getPageCount()).toBe(0);
    for (const run of [
      () => doc.save(),
      () => doc.saveAsBlob(),
      () => doc.saveAsBase64(),
      () => zero.save(),
      () => zero.saveAsBlob(),
      () => zero.saveAsBase64(),
      async () => zero.saveAsStream(),
    ]) {
      await refused(run());
    }
    expect(doc.getPageCount()).toBe(pages);
    expect(zero.getPageCount()).toBe(0);
    expect(calls).toBe(0);
  });

  it('save, saveAsStream, saveAsBlob and saveAsBase64 refuse before encrypt()', async () => {
    const doc = await decrypted();
    await refused(doc.save());
    await refused(doc.save({ compress: false }));
    expect(() => doc.saveAsStream()).toThrow(UnsupportedEncryptionError);
    await refused(doc.saveAsBlob());
    await refused(doc.saveAsBase64());
  });

  it('copy() resolves; the copy refuses to save', async () => {
    const doc = await decrypted();
    const clone = await doc.copy();
    await refused(clone.save());
    expect(() => clone.saveAsStream()).toThrow(UnsupportedEncryptionError);
    await refused((await clone.copy()).save());
  });

  it('a write of the same registry while copy() runs is still refused', async () => {
    const doc = await decrypted();
    const registry = doc.getRegistry();
    const copying = doc.copy();
    const writing = serializePdf(registry, structureOf(registry));
    await refused(writing);
    await expect(copying).resolves.toBeDefined();
  });

  it('after encrypt() save writes ciphertext that opens with the new password only', async () => {
    const doc = await decrypted();
    await doc.encrypt(NEW_PASSWORDS);
    const bytes = await doc.save();
    expect(latin1(bytes)).toContain('/Encrypt');
    expect(latin1(bytes)).not.toContain('Oracle');
    expect((await loadPdf(bytes, { password: 'u2' })).getTitle()).toBe('Oracle fixture');
  });
});

describe('sanitizePdf()', () => {
  it('refuses a file that opens with the empty user password', async () => {
    await refused(sanitizePdf(fixture('load/aes-128-r4.empty.pdf')));
    await refused(sanitizePdf(fixture('load/aes-128-r4.empty.pdf'), { metadata: false }));
  });

  it('cleans an unencrypted file', async () => {
    const { pdf } = await sanitizePdf(fixture('source.pdf'));
    expect(latin1(pdf)).not.toContain('/Encrypt');
    expect((await loadPdf(pdf)).getPageCount()).toBe(1);
  });
});

describe('routes into another document carry the refusal', () => {
  it('copyPages() (method and function)', async () => {
    const a = createPdf();
    await a.copyPages(await decrypted(), [0]);
    await refused(a.save());
    const b = createPdf();
    copyPages(await decrypted(), b, [0]);
    await refused(b.save());
  });

  it('splitPdf()', async () => {
    const [part] = await splitPdf(await decrypted(), [[0, 0]]);
    await refused(part!.save());
  });

  it('mergePdfs() with the decrypted document first, last, alone', async () => {
    await refused((await mergePdfs([await decrypted()])).save());
    await refused((await mergePdfs([await decrypted(), createPdf()])).save());
    await refused((await mergePdfs([await plain(), await decrypted()])).save());
  });

  it('mergePdfs() with a zero-page decrypted source that contributes only its metadata', async () => {
    const z = createPdf();
    z.setTitle('Zero secret title');
    z.setAuthor('Zero secret author');
    await z.encrypt({ userPassword: 'u', ownerPassword: 'o' });
    const bytes = await z.save({ addDefaultPage: false });
    const loaded = await loadPdf(bytes, { password: 'u' });
    expect(loaded.getPageCount()).toBe(0);
    expect(loaded.getTitle()).toBe('Zero secret title');
    const merged = await mergePdfs([loaded, createPdf()]);
    await refused(merged.save());
    expect(() => merged.saveAsStream()).toThrow(UnsupportedEncryptionError);
    await merged.encrypt(NEW_PASSWORDS);
    const out = await merged.save();
    expect(latin1(out)).not.toContain('Zero secret');
  });

  it('embedPage() and embedPages()', async () => {
    const a = createPdf();
    const one = a.embedPage((await decrypted()).getPage(0));
    a.addPage().drawPage(one, { x: 0, y: 0 });
    await refused(a.save());
    const b = createPdf();
    const [two] = b.embedPages([(await decrypted()).getPage(0)]);
    b.addPage().drawPage(two!, { x: 0, y: 0 });
    await refused(b.save());
  });

  it('embedPdf() of a file that opens with the empty user password', async () => {
    const t = createPdf();
    const [page] = await t.embedPdf(fixture('load/aes-128-r4.empty.pdf'));
    t.addPage().drawPage(page!, { x: 0, y: 0 });
    await refused(t.save());
  });

  it('the embedPageAsFormXObject() export, whichever source registry it is given', async () => {
    const s = await decrypted();
    const t = createPdf();
    embedPageAsFormXObject(s.getPage(0), s.getRegistry(), t.getRegistry(), 'X1');
    await refused(t.save());
    const u = createPdf();
    embedPageAsFormXObject(s.getPage(0), createPdf().getRegistry(), u.getRegistry(), 'X1');
    await refused(u.save());
  });

  it('after encrypt() on the target the moved content saves encrypted', async () => {
    const t = createPdf();
    await t.copyPages(await decrypted(), [0]);
    await t.encrypt(NEW_PASSWORDS);
    const bytes = await t.save();
    expect(latin1(bytes)).not.toContain('Oracle text');
    expect((await loadPdf(bytes, { password: 'u2' })).getPageCount()).toBe(1);
  });

  it('the same routes from an unencrypted load and a fresh document save in clear', async () => {
    const merged = await mergePdfs([await plain(), createPdf()]);
    expect(latin1(await merged.save())).not.toContain('/Encrypt');
    const [part] = await splitPdf(await plain(), [[0, 0]]);
    expect(latin1(await part!.save())).not.toContain('/Encrypt');
    const t = createPdf();
    t.addPage().drawPage(t.embedPage((await plain()).getPage(0)), { x: 0, y: 0 });
    copyPages(await plain(), t, [0]);
    expect(latin1(await t.save())).not.toContain('/Encrypt');
    expect(latin1(await (await (await plain()).copy()).save())).not.toContain('/Encrypt');
  });
});

/** Strings that the page /Resources of {@link resourceStringsPdf} hold directly. */
const RESOURCE_SECRETS = ['SECRETPROPSTRING', 'SECRETLOOKUPXX'] as const;

/** Whether `bytes` hold one of {@link RESOURCE_SECRETS}, as a literal or as a hex string. */
const holdsResourceSecret = (bytes: Uint8Array): boolean => {
  const text = latin1(bytes).toLowerCase();
  return RESOURCE_SECRETS.some(
    (s) => text.includes(s.toLowerCase()) || text.includes(new TextEncoder().encode(s).toHex()),
  );
};

/** An unencrypted one-page file whose page /Resources hold {@link RESOURCE_SECRETS} directly. */
function resourceStringsPdf(): Uint8Array {
  const content = 'BT /F1 12 Tf 10 10 Td (VISIBLE) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> /Properties << /MC0 << /Type /OCMD /Title (SECRETPROPSTRING) >> >> /ColorSpace << /CS0 [/Indexed /DeviceRGB 1 (SECRETLOOKUPXX)] >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/** {@link resourceStringsPdf} encrypted by this library (`user`, `owner`) and opened with `user`. */
async function decryptedWithResourceStrings(): Promise<PdfDocument> {
  const doc = await loadPdf(resourceStringsPdf());
  await doc.encrypt({ userPassword: 'user', ownerPassword: 'owner' });
  const bytes = await doc.save();
  expect(holdsResourceSecret(bytes)).toBe(false);
  return loadPdf(bytes, { password: 'user' });
}

/** Any structure: the writers refuse a decrypted registry before they read it. */
const ANY_STRUCTURE: DocumentStructure = {
  catalogRef: PdfRef.of(1, 0),
  pagesRef: PdfRef.of(2, 0),
  infoRef: PdfRef.of(1, 0),
};

describe('addPage() with a page of a decrypted document', () => {
  it('the target refuses save(), saveAsStream() and serializePdf() until encrypt()', async () => {
    const src = await decryptedWithResourceStrings();
    const t = createPdf();
    t.addPage(src.getPage(0));
    await refused(t.save());
    expect(() => t.saveAsStream()).toThrow(UnsupportedEncryptionError);
    await refused(serializePdf(t.getRegistry(), ANY_STRUCTURE));
    await t.encrypt(NEW_PASSWORDS);
    const bytes = await t.save();
    expect(holdsResourceSecret(bytes)).toBe(false);
    expect(latin1(bytes)).toContain('/Encrypt');
  });

  it('after encrypt() on the target qpdf opens the result', async (ctx: TestContext) => {
    requireQpdf(ctx);
    const t = createPdf();
    t.addPage((await decryptedWithResourceStrings()).getPage(0));
    await t.encrypt(NEW_PASSWORDS);
    expectQpdfClean(await t.save(), { password: 'u2' });
  });

  it('_addLoadedPage() carries the refusal too', async () => {
    const t = createPdf();
    t._addLoadedPage((await decryptedWithResourceStrings()).getPage(0));
    await refused(t.save());
    expect(() => t.saveAsStream()).toThrow(UnsupportedEncryptionError);
  });

  it('a page of an unencrypted document still moves and saves in clear', async () => {
    const t = createPdf();
    t.addPage((await loadPdf(resourceStringsPdf())).getPage(0));
    expect(latin1(await t.save())).not.toContain('/Encrypt');
  });
});

describe('copy() of a decrypted document and plugin hooks', () => {
  it('a save() that onBeforeSave starts during copy() rejects', async () => {
    const doc = await decrypted();
    let inner: Promise<Uint8Array> | undefined;
    let started = false;
    doc.use({
      name: 'nested-save',
      onBeforeSave(d) {
        if (started) return;
        started = true;
        inner = (d as unknown as PdfDocument).save();
        inner.catch(() => undefined);
      },
    });
    await doc.copy();
    expect(inner).toBeDefined();
    await refused(inner!);
  });

  it('onAfterSave is not called during copy() of a decrypted document; the copy refuses to save', async () => {
    const doc = await decrypted();
    const seen: Uint8Array[] = [];
    doc.use({
      name: 'after',
      onAfterSave(bytes) {
        seen.push(bytes);
        return bytes;
      },
    });
    const clone = await doc.copy();
    expect(seen).toEqual([]);
    await refused(clone.save());
  });

  it('copy() of an unencrypted document still runs onBeforeSave and onAfterSave once each', async () => {
    const doc = await plain();
    let before = 0;
    const seen: Uint8Array[] = [];
    doc.use({
      name: 'both',
      onBeforeSave() {
        before++;
      },
      onAfterSave(bytes) {
        seen.push(bytes);
        return bytes;
      },
    });
    const clone = await doc.copy();
    expect(before).toBe(1);
    expect(seen).toHaveLength(1);
    expect(latin1(await clone.save())).not.toContain('/Encrypt');
  });
});

describe('the records of decrypted content are shared by every loaded copy of the module', () => {
  it('a registry and an object recorded by one copy are seen by another', async () => {
    const first = await import('../../../src/core/internal/flateStream.js');
    vi.resetModules();
    const second = await import('../../../src/core/internal/flateStream.js');
    expect(second).not.toBe(first);
    const registry = new PdfObjectRegistry();
    first.markDecryptedFromEncryptedFile(registry);
    expect(second.isDecryptedFromEncryptedFile(registry)).toBe(true);
    const str = PdfString.literal('recorded');
    first.recordDecryptedObject(str);
    expect(second.holdsDecryptedObject(str)).toBe(true);
  });

  for (const lock of ['preventExtensions', 'freeze'] as const) {
    it(`a globalThis made ${lock === 'freeze' ? 'frozen' : 'non-extensible'} before the module loads: a module-level set, no throw`, () => {
      const moduleUrl = new URL('../../../src/core/internal/flateStream.ts', import.meta.url).href;
      const objectsUrl = new URL('../../../src/core/pdfObjects.ts', import.meta.url).href;
      const script = `
        Object.${lock}(globalThis);
        const m = await import(${JSON.stringify(moduleUrl)});
        const { PdfObjectRegistry, PdfString } = await import(${JSON.stringify(objectsUrl)});
        const registry = new PdfObjectRegistry();
        m.markDecryptedFromEncryptedFile(registry);
        const str = PdfString.literal('x');
        m.recordDecryptedObject(str);
        console.log(m.isDecryptedFromEncryptedFile(registry) + ' ' + m.holdsDecryptedObject(str) + ' ' + (Symbol.for('modern-pdf-lib.decryptedSources') in globalThis));
      `;
      const run = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', script],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      expect(run.stdout.trim()).toBe('true true false');
    });
  }
});

/** The content stream and the Info /Title string of aes-128-r4.pdf, as the decrypt pass left them. */
async function decryptedObjects(): Promise<{ stream: PdfStream; title: PdfString }> {
  const doc = await decrypted();
  const registry = doc.getRegistry();
  const stream = registry.resolve(doc.getPage(0).getOriginalContentRefs()[0]!) as PdfStream;
  let title: PdfString | undefined;
  for (const { object } of registry) {
    const value = object.kind === 'dict' ? object.get('/Title') : undefined;
    if (value?.kind === 'string') title = value;
  }
  expect(stream.kind).toBe('stream');
  expect(title?.value).toBe('Oracle fixture');
  return { stream, title: title! };
}

/** A dictionary that holds `title` in a nested array, as a widget would. */
const holding = (title: PdfString): PdfDict =>
  new PdfDict([
    ['/Type', PdfName.of('Annot')],
    ['/Subtype', PdfName.of('Widget')],
    ['/Rect', PdfArray.of([PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(1), PdfNumber.of(1)])],
    ['/Kids', PdfArray.of([new PdfDict([['/T', title]])])],
  ]);

/** The dictionaries of `doc` with the /Title string 'Oracle fixture' that are not in `before`. */
function titleDictsNotIn(doc: PdfDocument, before: ReadonlySet<PdfObject>): PdfDict[] {
  const out: PdfDict[] = [];
  for (const { object } of doc.getRegistry()) {
    if (before.has(object) || object.kind !== 'dict') continue;
    const title = object.get('/Title');
    if (title?.kind === 'string' && title.value === 'Oracle fixture') out.push(object);
  }
  return out;
}

/** Every writer of `doc`, each expected to refuse. */
async function expectEveryWriterRefuses(doc: PdfDocument, base: Uint8Array): Promise<void> {
  await refused(doc.save());
  await refused(doc.save({ compress: false }));
  await refused(doc.save({ objectStreamThreshold: 0 }));
  await refused(doc.saveAsBlob());
  await refused(doc.saveAsBase64());
  await refused(drain(doc.saveAsStream()));
  await refused(saveDocumentIncremental(base, doc));
  const registry = doc.getRegistry();
  const structure = structureOf(registry);
  await refused(serializePdf(registry, structure));
  await refused(new PdfWriter(registry, structure, { objectStreamThreshold: 0 }).write());
  await refused(drain(new PdfStreamWriter(registry, structure).toReadableStream()));
  const all = new Set<number>();
  for (const { ref } of registry) all.add(ref.objectNumber);
  expect(() => saveIncremental(base, registry, structure, all)).toThrow(UnsupportedEncryptionError);
}

/** A fresh one-page document saved once (nothing recorded), and the bytes of that save. */
async function freshSaved(): Promise<{ doc: PdfDocument; base: Uint8Array }> {
  const doc = createPdf();
  doc.addPage();
  return { doc, base: await doc.save() };
}

describe('a string or stream decrypted on load is refused by every writer, in any document', () => {
  it('a decrypted stream registered in a fresh document', async () => {
    const { stream } = await decryptedObjects();
    const { doc, base } = await freshSaved();
    doc.getRegistry().register(stream);
    expect(isDecryptedFromEncryptedFile(doc.getRegistry())).toBe(false);
    await expectEveryWriterRefuses(doc, base);
  });

  it('a dictionary that holds a decrypted string, registered in a fresh document', async () => {
    const { title } = await decryptedObjects();
    const { doc, base } = await freshSaved();
    doc.getRegistry().register(holding(title));
    await expectEveryWriterRefuses(doc, base);
  });

  it('a decrypted string as a whole indirect object, through assign()', async () => {
    const { title } = await decryptedObjects();
    const { doc, base } = await freshSaved();
    const registry = doc.getRegistry();
    registry.assign(registry.allocate(), title);
    await expectEveryWriterRefuses(doc, base);
  });

  it('a decrypted stream named as a page XObject', async () => {
    const { stream } = await decryptedObjects();
    const a = createPdf();
    a.addPage().registerXObject('X9', a.getRegistry().register(stream));
    await refused(a.save());
    await refused(drain(a.saveAsStream()));
  });

  it('addPage() of a page whose loaded /Resources hold a decrypted string, in a document not marked', async () => {
    const { title } = await decryptedObjects();
    const a = await loadPdf(resourceStringsPdf());
    const properties = a.getPage(0).getOriginalResources()!.get('/Properties') as PdfDict;
    (properties.get('/MC0') as PdfDict).set('/Title', title);
    expect(isDecryptedFromEncryptedFile(a.getRegistry())).toBe(false);
    await refused(a.save());
    const t = createPdf();
    t.addPage(a.getPage(0));
    await refused(t.save());
    await refused(drain(t.saveAsStream()));
  });

  it('the object copiers record their copies: copyPages, mergePdfs, splitPdf, embedPage, embedPageAsFormXObject', async () => {
    const { stream } = await decryptedObjects();
    const a = createPdf();
    a.addPage().registerXObject('X9', a.getRegistry().register(stream));
    expect(isDecryptedFromEncryptedFile(a.getRegistry())).toBe(false);
    const t1 = createPdf();
    await t1.copyPages(a, [0]);
    const t2 = createPdf();
    copyPages(a, t2, [0]);
    const merged = await mergePdfs([a, createPdf()]);
    const [part] = await splitPdf(a, [[0, 0]]);
    const t3 = createPdf();
    t3.addPage().drawPage(t3.embedPage(a.getPage(0)), { x: 0, y: 0 });
    const t4 = createPdf();
    embedPageAsFormXObject(a.getPage(0), a.getRegistry(), t4.getRegistry(), 'X1');
    for (const target of [t1, t2, merged, part!, t3, t4]) {
      expect(isDecryptedFromEncryptedFile(target.getRegistry())).toBe(false);
      await refused(target.save());
    }
  });

  it('copy() of such a document resolves; the copy refuses to save', async () => {
    const { stream } = await decryptedObjects();
    const a = createPdf();
    a.addPage().registerXObject('X9', a.getRegistry().register(stream));
    const clone = await a.copy();
    expect(isDecryptedFromEncryptedFile(clone.getRegistry())).toBe(false);
    await refused(clone.save());
  });

  /**
   * The Info dictionary that buildStructure() registers holds copies of the decrypted strings that
   * loadPdf passed to the setters; every dictionary the registry gains from a save, moved into a
   * fresh document, is refused by every writer.
   */
  it('the Info dictionary that copy() registers in the source, moved into a fresh document', async () => {
    const src = await decrypted();
    const before = new Set<PdfObject>();
    for (const { object } of src.getRegistry()) before.add(object);
    await src.copy();
    const gained = titleDictsNotIn(src, before);
    expect(gained.length).toBeGreaterThan(0);
    for (const dict of gained) {
      const { doc, base } = await freshSaved();
      doc.getRegistry().register(dict);
      await expectEveryWriterRefuses(doc, base);
    }
  });

  it('the Info dictionary that encrypt() and save() register in a splitPdf() part, moved into a fresh document', async () => {
    const [part] = await splitPdf(await decrypted(), [[0, 0]]);
    const before = new Set<PdfObject>();
    for (const { object } of part!.getRegistry()) before.add(object);
    await part!.encrypt(NEW_PASSWORDS);
    await part!.save();
    const gained = titleDictsNotIn(part!, before);
    expect(gained.length).toBeGreaterThan(0);
    for (const dict of gained) {
      const { doc, base } = await freshSaved();
      doc.getRegistry().register(dict);
      await expectEveryWriterRefuses(doc, base);
    }
  });

  it('after encrypt() the document that holds them saves encrypted', async () => {
    const { stream, title } = await decryptedObjects();
    const { doc } = await freshSaved();
    doc.getRegistry().register(stream);
    doc.getRegistry().register(holding(title));
    await doc.encrypt(NEW_PASSWORDS);
    const bytes = await doc.save();
    expect(latin1(bytes)).not.toContain('Oracle');
    expect(latin1(bytes)).toContain('/Encrypt');
  });

  it('a document that holds equal strings and streams not produced by a decryption writes as before', async () => {
    const { stream, title } = await decryptedObjects();
    const { doc, base } = await freshSaved();
    doc.getRegistry().register(new PdfStream(new PdfDict(), new Uint8Array(stream.data)));
    doc.getRegistry().register(holding(PdfString.literal(title.value)));
    const bytes = await doc.save({ compress: false });
    expect(latin1(bytes)).toContain('Oracle fixture');
    expect(latin1(await drain(doc.saveAsStream()))).toContain('%%EOF');
    expect(latin1((await saveDocumentIncremental(base, doc)).bytes)).toContain('%%EOF');
  });
});

/** The /Contents of the first /Type /Sig dictionary of an unencrypted file, as bytes. */
async function signatureContents(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  for (const { object } of doc.getRegistry()) {
    if (object.kind !== 'dict') continue;
    const type = object.get('/Type');
    if (type?.kind === 'name' && type.value === '/Sig') {
      const contents = (object as PdfDict).get('/Contents') as PdfString;
      return Uint8Array.from(contents.value, (c) => c.charCodeAt(0));
    }
  }
  throw new Error('no /Type /Sig dictionary');
}

/** load/signed-aes-128.pdf opened with `user`, encrypted again with `algorithm` and saved. */
async function reEncryptedSigned(algorithm: EncryptAlgorithm): Promise<Uint8Array> {
  const doc = await loadPdf(fixture('load/signed-aes-128.pdf'), { password: 'user' });
  await doc.encrypt({ ...NEW_PASSWORDS, algorithm });
  return doc.save();
}

const ALGORITHMS = ['rc4-40', 'rc4-128', 'aes-128', 'aes-256'] as const;

describe('re-encrypting a decrypted signed document', () => {
  for (const algorithm of ALGORITHMS) {
    it(`writes the signature /Contents unencrypted, as an unencrypted save writes it (${algorithm})`, async (ctx: TestContext) => {
      requireQpdf(ctx);
      const out = await reEncryptedSigned(algorithm);
      // The unencrypted corpus file that load/signed-aes-128.pdf encrypts, loaded and saved.
      const plainSave = await (
        await loadPdf(new Uint8Array(readFileSync(join(DIR, '../corpus/qpdf-signed.pdf'))))
      ).save();
      expect(await signatureContents(qpdfDecryptQdf(out, 'u2'))).toEqual(
        await signatureContents(plainSave),
      );
    });

    knownDefect(
      defectKey('core-document-02', '0.41.0'),
      `the signature /Contents bytes are unchanged after encrypt() and save (${algorithm})`,
      { failsWith: /expected .* to deeply equal/ },
      async (ctx) => {
        requireQpdf(ctx);
        const out = await reEncryptedSigned(algorithm);
        const before = await signatureContents(
          qpdfDecryptQdf(fixture('load/signed-aes-128.pdf'), 'user'),
        );
        expect([...before.subarray(0, 4)]).toEqual([0x30, 0x82, 0x05, 0x3e]);
        expect(await signatureContents(qpdfDecryptQdf(out, 'u2'))).toEqual(before);
      },
    );
  }
});
