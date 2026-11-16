/**
 * The library's writers write a string handed to `writeString` as a PDF byte string: each code
 * unit 0x00-0xFF is one byte, and a code unit above 0xFF throws UnencodableTextError. A title of
 * "é" shows which bytes each writer emits for U+00E9. No library object hands a writer a code unit
 * above 0xFF (a PdfString refuses one when it is built), so the refusal of every writer is shown
 * with a stand-in object that calls `writeString` itself. A title above U+00FF is a PDF text
 * string, which the writers get as the bytes of UTF-16BE; qpdf reads it back. The Info dictionary
 * is never packed into an object stream, so the object stream writer is shown by a registered
 * dictionary holding /T (é).
 *
 * The document-level writes of `saveAsStream()` (header, object headers, xref table, trailer) and
 * of `appendIncrementalUpdate()` hold only ASCII, so no public call hands those two writers a
 * character above U+007F; the files they write are covered by tests/oracle/writer-matrix.test.ts.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import {
  createPdf,
  loadPdf,
  PdfDict,
  PdfString,
  saveDocumentIncremental,
  UnencodableTextError,
} from '../../../../src/index.js';
import type { ByteWriter, PdfDocument } from '../../../../src/index.js';
import { withPdfjs } from '../../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../../helpers/oracle/qpdf.js';
import { qpdfObjects } from '../../../oracle/text-set/setup.js';

/** `/Title (é)` with é as the one Latin-1 byte 0xE9. */
const TITLE_LATIN1 = Uint8Array.of(...new TextEncoder().encode('/Title ('), 0xe9, 0x29);
/** The UTF-8 bytes of é, which the writers wrote before 0.41.0. */
const E_ACUTE_UTF8 = Uint8Array.of(0xc3, 0xa9);

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function expectLatin1Title(bytes: Uint8Array): void {
  expect(indexOfBytes(bytes, TITLE_LATIN1), 'the title is written as Latin-1').not.toBe(-1);
  expect(indexOfBytes(bytes, E_ACUTE_UTF8), 'no UTF-8 é is written').toBe(-1);
}

function titled(title: string): PdfDocument {
  const doc = createPdf();
  doc.addPage();
  doc.setTitle(title);
  return doc;
}

/**
 * Registers a stand-in object whose serialize() hands the writer `(日)` through writeString; the
 * writers call nothing else on an object, so the cast to PdfString is safe here.
 */
function withRawText(doc: PdfDocument): PdfDocument {
  const raw = { kind: 'string', serialize: (writer: ByteWriter) => writer.writeString('(日)') };
  doc.getRegistry().register(raw as unknown as PdfString);
  return doc;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The bytes `saveDocumentIncremental()` appends after the title of a saved document is set. */
async function incrementalOf(title: string): Promise<Uint8Array> {
  const original = await createPdf().save();
  const doc = await loadPdf(original);
  doc.setTitle(title);
  const { bytes } = await saveDocumentIncremental(original, doc, { compress: false });
  return bytes.subarray(original.length);
}

describe('the writers write writeString("é") as the byte 0xE9', () => {
  test('save(): the document writer', async () => {
    expectLatin1Title(await titled('é').save({ compress: false }));
  });

  test('save() with object streams: the object stream writer', async () => {
    const doc = titled('é');
    // The Info dictionary is never packed into an object stream; this dictionary is.
    doc.getRegistry().register(new PdfDict([['T', PdfString.fromText('é')]]));
    const bytes = await doc.save({ compress: false, objectStreamThreshold: 1 });
    expect(indexOfBytes(bytes, new TextEncoder().encode('/Type /ObjStm'))).not.toBe(-1);
    expect(
      indexOfBytes(bytes, Uint8Array.of(...new TextEncoder().encode('/T ('), 0xe9, 0x29)),
    ).not.toBe(-1);
    expect(indexOfBytes(bytes, E_ACUTE_UTF8)).toBe(-1);
  });

  test('saveAsStream(): the object writer of the stream writer', async () => {
    expectLatin1Title(await readAll(titled('é').saveAsStream({ compress: false })));
  });

  test('saveDocumentIncremental(): the incremental writer', async () => {
    expectLatin1Title(await incrementalOf('é'));
  });
});

describe('a title above U+00FF is a text string, not a byte string handed to writeString', () => {
  beforeEach((ctx) => {
    requireQpdf(ctx);
  });

  /** The /Title of the trailer's /Info as qpdf `--json=2` prints it. */
  const qpdfTitle = (bytes: Uint8Array): unknown => {
    const objects = qpdfObjects(bytes);
    return objects.get(`obj:${String(objects.get('trailer')?.['/Info'])}`)?.['/Title'];
  };

  test('save() writes it as UTF-16BE, which qpdf and pdf.js read back', async () => {
    const bytes = await titled('日').save({ compress: false });
    expect(qpdfTitle(bytes)).toBe('u:日');
    const info = await withPdfjs(bytes, async (pdf) => (await pdf.getMetadata()).info);
    expect(info).toMatchObject({ Title: '日' });
  });

  test('saveDocumentIncremental() writes it as UTF-16BE, which qpdf reads back', async () => {
    const original = await createPdf().save();
    const doc = await loadPdf(original);
    doc.setTitle('日');
    const { bytes } = await saveDocumentIncremental(original, doc, { compress: false });
    expect(qpdfTitle(bytes)).toBe('u:日');
  });
});

describe('the writers refuse a code unit above 0xFF', () => {
  const unencodable = { character: '日', codePoint: 0x65e5, encoding: 'PDF byte string' };

  test('save()', async () => {
    const doc = createPdf();
    doc.addPage();
    const saving = withRawText(doc).save({ compress: false });
    await expect(saving).rejects.toBeInstanceOf(UnencodableTextError);
    await expect(saving).rejects.toMatchObject(unencodable);
  });

  test('save() with object streams', async () => {
    const doc = createPdf();
    doc.addPage();
    await expect(
      withRawText(doc).save({ compress: false, objectStreamThreshold: 1 }),
    ).rejects.toMatchObject(unencodable);
  });

  test('saveAsStream()', async () => {
    const doc = createPdf();
    doc.addPage();
    await expect(readAll(withRawText(doc).saveAsStream({ compress: false }))).rejects.toMatchObject(
      unencodable,
    );
  });

  test('saveDocumentIncremental()', async () => {
    const original = await createPdf().save();
    const doc = withRawText(await loadPdf(original));
    await expect(saveDocumentIncremental(original, doc, { compress: false })).rejects.toMatchObject(
      unencodable,
    );
  });
});
