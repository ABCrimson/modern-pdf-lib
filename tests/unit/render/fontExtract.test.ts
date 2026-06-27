import { describe, it, expect } from 'vitest';
import { PdfDocument, createPdf } from '../../../src/core/pdfDocument.js';
import { extractFonts } from '../../../src/render/fontExtract.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal valid TrueType font binary.
//
// Produces a real sfnt with magic 0x00010000 and the tables required by
// extractMetrics (head, hhea, maxp, hmtx).  This is the same fixture style
// the font-embedding unit tests use.
// ---------------------------------------------------------------------------

function writeTag(buf: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) {
    buf[offset + i] = tag.charCodeAt(i);
  }
}

function buildMinimalTtf(): Uint8Array {
  const numTables = 4;
  const headerSize = 12;
  const recordSize = 16;
  const tableRecordsSize = numTables * recordSize;
  const tablesStart = headerSize + tableRecordsSize;

  const headSize = 54;
  const hheaSize = 36;
  const maxpSize = 6;
  const hmtxSize = 8;

  const totalSize = tablesStart + headSize + hheaSize + maxpSize + hmtxSize;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Offset table (TrueType signature)
  view.setUint32(0, 0x00010000, false);
  view.setUint16(4, numTables, false);
  view.setUint16(6, 64, false);
  view.setUint16(8, 2, false);
  view.setUint16(10, 0, false);

  let recordOffset = headerSize;
  let dataOffset = tablesStart;

  // head
  writeTag(buf, recordOffset, 'head');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, headSize, false);
  const headOffset = dataOffset;
  view.setUint32(headOffset, 0x00010000, false);
  view.setUint32(headOffset + 4, 0x00010000, false);
  view.setUint32(headOffset + 8, 0, false);
  view.setUint32(headOffset + 12, 0x5f0f3cf5, false);
  view.setUint16(headOffset + 16, 0x000b, false);
  view.setUint16(headOffset + 18, 1000, false);
  view.setInt16(headOffset + 36, 0, false);
  view.setInt16(headOffset + 38, -200, false);
  view.setInt16(headOffset + 40, 1000, false);
  view.setInt16(headOffset + 42, 800, false);
  view.setInt16(headOffset + 50, 0, false);
  dataOffset += headSize;
  recordOffset += recordSize;

  // hhea
  writeTag(buf, recordOffset, 'hhea');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, hheaSize, false);
  const hheaOffset = dataOffset;
  view.setUint32(hheaOffset, 0x00010000, false);
  view.setInt16(hheaOffset + 4, 800, false);
  view.setInt16(hheaOffset + 6, -200, false);
  view.setInt16(hheaOffset + 8, 0, false);
  view.setUint16(hheaOffset + 10, 600, false);
  view.setUint16(hheaOffset + 34, 2, false);
  dataOffset += hheaSize;
  recordOffset += recordSize;

  // maxp
  writeTag(buf, recordOffset, 'maxp');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, maxpSize, false);
  const maxpOffset = dataOffset;
  view.setUint32(maxpOffset, 0x00010000, false);
  view.setUint16(maxpOffset + 4, 2, false);
  dataOffset += maxpSize;
  recordOffset += recordSize;

  // hmtx
  writeTag(buf, recordOffset, 'hmtx');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, hmtxSize, false);
  const hmtxOffset = dataOffset;
  view.setUint16(hmtxOffset, 500, false);
  view.setInt16(hmtxOffset + 2, 0, false);
  view.setUint16(hmtxOffset + 4, 600, false);
  view.setInt16(hmtxOffset + 6, 50, false);

  return buf;
}

/** Check the first four bytes are a recognised sfnt magic. */
function isSfnt(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  const magic = (data[0]! << 24) | (data[1]! << 16) | (data[2]! << 8) | data[3]!;
  // 0x00010000 (TrueType), 'true' (0x74727565), 'OTTO' (0x4f54544f), 'ttcf'
  return (
    magic === 0x00010000 ||
    magic === 0x74727565 ||
    magic === 0x4f54544f ||
    magic === 0x74746366
  );
}

describe('extractFonts', () => {
  it('extracts an embedded TrueType font from a saved+loaded page', async () => {
    const doc = createPdf();
    const page = doc.addPage([300, 300]);
    const ttf = buildMinimalTtf();
    // Give the embedded font a concrete, untagged PostScript name so the
    // round-tripped /BaseFont is stable and unambiguous.
    const font = await doc.embedFont(ttf, { customName: 'MyEmbeddedFont' });
    page.drawText('Hi', { x: 50, y: 250, font, size: 24 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const loadedPage = loaded.getPage(0);

    const fonts = extractFonts(loadedPage);

    // Exactly one embedded font program should be discovered.
    expect(fonts.length).toBe(1);
    const f = fonts[0]!;

    expect(f.format).toBe('truetype');
    expect(f.resourceName.length).toBeGreaterThan(0);
    expect(typeof f.baseFont).toBe('string');
    expect(f.baseFont).toBe('MyEmbeddedFont');

    // FontFile2 is a complete standalone sfnt program.
    expect(f.data).toBeInstanceOf(Uint8Array);
    expect(f.data.length).toBeGreaterThan(0);
    expect(isSfnt(f.data)).toBe(true);

    // 'MyEmbeddedFont' carries no 6-letter '+' subset tag.
    expect(f.subset).toBe(false);
  });

  it('reports subset=true when the BaseFont carries a 6-letter "+" tag', async () => {
    // Verify the subset-tag detection independently of the embed pipeline by
    // hand-building a page whose /Font dict references a tagged BaseFont.
    const doc = createPdf();
    const page = doc.addPage([100, 100]);
    const ttf = buildMinimalTtf();
    const font = await doc.embedFont(ttf, { customName: 'ABCDEF+CustomFont' });
    page.drawText('x', { x: 10, y: 10, font, size: 12 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const fonts = extractFonts(loaded.getPage(0));

    expect(fonts.length).toBe(1);
    expect(fonts[0]!.baseFont).toBe('ABCDEF+CustomFont');
    expect(fonts[0]!.subset).toBe(true);
    expect(fonts[0]!.format).toBe('truetype');
    expect(isSfnt(fonts[0]!.data)).toBe(true);
  });

  it('skips standard-14 fonts that have no embedded font program', async () => {
    const doc = createPdf();
    const page = doc.addPage([200, 200]);
    const helv = await doc.embedFont('Helvetica');
    page.drawText('Hello', { x: 20, y: 100, font: helv, size: 18 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const fonts = extractFonts(loaded.getPage(0));

    expect(fonts).toEqual([]);
  });

  it('returns [] for a page with no fonts at all', () => {
    const doc = createPdf();
    const page = doc.addPage([100, 100]);
    page.drawRectangle({ x: 10, y: 10, width: 20, height: 20 });
    expect(extractFonts(page)).toEqual([]);
  });
});
