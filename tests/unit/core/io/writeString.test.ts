/**
 * The library's writers write a string handed to `writeString` as a PDF byte string: each code
 * unit 0x00-0xFF is one byte, and a code unit above 0xFF throws UnencodableTextError. The Info
 * /Title is a literal string whose characters reach the writer as they were set, so a title
 * of "é" shows which bytes each writer emits for U+00E9.
 *
 * The document-level writes of `saveAsStream()` (header, object headers, xref table, trailer) and
 * of `appendIncrementalUpdate()` hold only ASCII, so no public call hands those two writers a
 * character above U+007F; the files they write are covered by tests/oracle/writer-matrix.test.ts.
 */
import { describe, expect, test } from 'vitest';
import { createPdf, loadPdf, UnencodableTextError } from '../../../../src/index.js';
import type { PdfDocument } from '../../../../src/index.js';
import { saveDocumentIncremental } from '../../../../src/core/io/incrementalWriter.js';

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
    const bytes = await titled('é').save({ compress: false, objectStreamThreshold: 1 });
    expect(indexOfBytes(bytes, new TextEncoder().encode('/Type /ObjStm'))).not.toBe(-1);
    expectLatin1Title(bytes);
  });

  test('saveAsStream(): the object writer of the stream writer', async () => {
    expectLatin1Title(await readAll(titled('é').saveAsStream({ compress: false })));
  });

  test('saveDocumentIncremental(): the incremental writer', async () => {
    expectLatin1Title(await incrementalOf('é'));
  });
});

describe('the writers refuse a code unit above 0xFF', () => {
  const unencodable = { character: '日', codePoint: 0x65e5, encoding: 'PDF byte string' };

  test('save()', async () => {
    const saving = titled('日').save({ compress: false });
    await expect(saving).rejects.toBeInstanceOf(UnencodableTextError);
    await expect(saving).rejects.toMatchObject(unencodable);
  });

  test('save() with object streams', async () => {
    await expect(
      titled('日').save({ compress: false, objectStreamThreshold: 1 }),
    ).rejects.toMatchObject(unencodable);
  });

  test('saveAsStream()', async () => {
    await expect(readAll(titled('日').saveAsStream({ compress: false }))).rejects.toMatchObject(
      unencodable,
    );
  });

  test('saveDocumentIncremental()', async () => {
    await expect(incrementalOf('日')).rejects.toMatchObject(unencodable);
  });
});
