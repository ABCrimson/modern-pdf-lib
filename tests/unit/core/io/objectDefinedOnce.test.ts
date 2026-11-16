/**
 * Each writer defines an object number once, for a loaded document and for a second save.
 *
 * A registry can hold more than one entry for an object number: loading a file registers each
 * object it parses twice, and each save registers the page dictionaries again under their
 * numbers. Up to 0.40.9 every writer wrote each entry, so a re-saved file carried a dead copy of
 * most of its objects before the copy its cross-reference data names (qpdf-form-acrobat.pdf:
 * 176 object definitions for 91 object numbers). An object packed into an object stream counts
 * as defined by its container's header.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPdf, PageSizes } from '../../../../src/index.js';
import { loadPdf } from '../../../../src/parser/documentParser.js';
import { saveIncremental } from '../../../../src/core/io/incrementalWriter.js';
import { PdfRef } from '../../../../src/core/pdfObjects.js';
import type { PdfDocument } from '../../../../src/core/pdfDocument.js';
import { objectStreamMembers, repeatedDefinitions } from '../../../helpers/objectDefinitions.js';

const CORPUS = join(import.meta.dirname, '../../../fixtures/corpus');

/** A two-page document with text, saved with a classic cross-reference table. */
async function createdBytes(): Promise<Uint8Array> {
  const doc = createPdf();
  doc.setTitle('Defined once');
  for (const text of ['First page', 'Second page']) {
    doc.addPage(PageSizes.A4).drawText(text, { x: 72, y: 720, size: 18 });
  }
  return doc.save({ compress: false });
}

const SOURCES: Readonly<Record<string, () => Promise<Uint8Array>>> = {
  'a file this library wrote': createdBytes,
  'qpdf-form-acrobat.pdf': async () =>
    new Uint8Array(readFileSync(join(CORPUS, 'qpdf-form-acrobat.pdf'))),
};

async function streamBytes(doc: PdfDocument): Promise<Uint8Array> {
  return new Uint8Array(await new Response(doc.saveAsStream()).arrayBuffer());
}

/** The object `/<key>` of the last trailer of a file with classic trailers names. */
function trailerRef(bytes: Uint8Array, key: string): PdfRef {
  const text = new TextDecoder('latin1').decode(bytes);
  const trailer = text.slice(text.lastIndexOf('trailer'));
  return PdfRef.of(Number(new RegExp(`/${key} (\\d+) 0 R`).exec(trailer)![1]));
}

describe.each(Object.entries(SOURCES))('a loaded document (%s)', (_name, source) => {
  it('save() defines each object number once', async () => {
    const doc = await loadPdf(await source());
    expect(repeatedDefinitions(await doc.save())).toEqual([]);
  });

  it('save({ compress: false }) defines each object number once', async () => {
    const doc = await loadPdf(await source());
    expect(repeatedDefinitions(await doc.save({ compress: false }))).toEqual([]);
  });

  it('saveAsStream() defines each object number once', async () => {
    const doc = await loadPdf(await source());
    expect(repeatedDefinitions(await streamBytes(doc))).toEqual([]);
  });

  it('save({ objectStreamThreshold: 1 }) defines each object number once, object streams included', async () => {
    const doc = await loadPdf(await source());
    const bytes = await doc.save({ objectStreamThreshold: 1 });
    expect(objectStreamMembers(bytes).length).toBeGreaterThan(0);
    expect(repeatedDefinitions(bytes)).toEqual([]);
  });

  it('saveIncremental() of every loaded object appends each object number once', async () => {
    const original = await source();
    const doc = await loadPdf(original);
    const changed = new Set(Iterator.from(doc.getRegistry()).map(({ ref }) => ref.objectNumber));
    const root = trailerRef(original, 'Root');
    const structure = { catalogRef: root, infoRef: trailerRef(original, 'Info'), pagesRef: root };
    const { bytes } = saveIncremental(original, doc.getRegistry(), structure, changed);
    expect(repeatedDefinitions(bytes.subarray(original.length))).toEqual([]);
  });
});

describe('a document made with createPdf', () => {
  it('a second save() defines each object number once', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4).drawText('Saved twice', { x: 72, y: 720, size: 18 });
    expect(repeatedDefinitions(await doc.save())).toEqual([]);
    expect(repeatedDefinitions(await doc.save())).toEqual([]);
  });
});
