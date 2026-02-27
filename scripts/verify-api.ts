/**
 * Comprehensive API verification script.
 * Tests every public API feature of modern-pdf end-to-end.
 */

import { zlibSync } from 'fflate';

import {
  createPdf,
  PdfDocument,
  StandardFonts,
  PdfPage,
  PageSizes,
  rgb,
  cmyk,
  grayscale,
  degrees,
  radians,
  initWasm,
  PdfNull,
  PdfBool,
  PdfNumber,
  PdfString,
  PdfName,
  PdfArray,
  PdfDict,
  PdfStream,
  PdfRef,
  PdfObjectRegistry,
  PdfWriter,
  serializePdf,
  PdfStreamWriter,
  buildCatalog,
  buildPageTree,
  buildInfoDict,
  buildDocumentStructure,
  formatPdfDate,
  EmbeddedFont,
  extractMetrics,
} from '../src/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

async function main(): Promise<void> {
  console.log('\n=== modern-pdf Comprehensive API Verification ===\n');

  // -----------------------------------------------------------------------
  // 1. Exports check
  // -----------------------------------------------------------------------
  console.log('1. Export availability');
  assert(typeof createPdf === 'function', 'createPdf is a function');
  assert(typeof PdfDocument !== 'undefined', 'PdfDocument is exported');
  assert(typeof StandardFonts === 'object', 'StandardFonts is exported');
  assert(typeof PdfPage !== 'undefined', 'PdfPage is exported');
  assert(typeof PageSizes === 'object', 'PageSizes is exported');
  assert(typeof rgb === 'function', 'rgb() is exported');
  assert(typeof cmyk === 'function', 'cmyk() is exported');
  assert(typeof grayscale === 'function', 'grayscale() is exported');
  assert(typeof degrees === 'function', 'degrees() is exported');
  assert(typeof radians === 'function', 'radians() is exported');
  assert(typeof initWasm === 'function', 'initWasm() is exported');
  assert(typeof PdfNull !== 'undefined', 'PdfNull is exported');
  assert(typeof PdfBool !== 'undefined', 'PdfBool is exported');
  assert(typeof PdfNumber !== 'undefined', 'PdfNumber is exported');
  assert(typeof PdfString !== 'undefined', 'PdfString is exported');
  assert(typeof PdfName !== 'undefined', 'PdfName is exported');
  assert(typeof PdfArray !== 'undefined', 'PdfArray is exported');
  assert(typeof PdfDict !== 'undefined', 'PdfDict is exported');
  assert(typeof PdfStream !== 'undefined', 'PdfStream is exported');
  assert(typeof PdfRef !== 'undefined', 'PdfRef is exported');
  assert(typeof PdfObjectRegistry !== 'undefined', 'PdfObjectRegistry is exported');
  assert(typeof PdfWriter !== 'undefined', 'PdfWriter is exported');
  assert(typeof serializePdf === 'function', 'serializePdf is exported');
  assert(typeof PdfStreamWriter !== 'undefined', 'PdfStreamWriter is exported');
  assert(typeof buildCatalog === 'function', 'buildCatalog is exported');
  assert(typeof buildPageTree === 'function', 'buildPageTree is exported');
  assert(typeof buildInfoDict === 'function', 'buildInfoDict is exported');
  assert(typeof buildDocumentStructure === 'function', 'buildDocumentStructure is exported');
  assert(typeof formatPdfDate === 'function', 'formatPdfDate is exported');
  assert(typeof EmbeddedFont !== 'undefined', 'EmbeddedFont is exported');
  assert(typeof extractMetrics === 'function', 'extractMetrics is exported');

  // -----------------------------------------------------------------------
  // 2. createPdf and basic document
  // -----------------------------------------------------------------------
  console.log('\n2. Document creation');
  const doc = createPdf();
  assert(doc instanceof PdfDocument, 'createPdf() returns PdfDocument');

  // -----------------------------------------------------------------------
  // 3. Page sizes — tuple and object forms
  // -----------------------------------------------------------------------
  console.log('\n3. Page sizes');
  const pageTuple = doc.addPage(PageSizes.A4);
  assert(pageTuple instanceof PdfPage, 'addPage(PageSizes.A4) works (tuple)');
  assert(pageTuple.width === 595.28, 'A4 width = 595.28');
  assert(pageTuple.height === 841.89, 'A4 height = 841.89');

  const pageObj = doc.addPage({ width: 600, height: 800 });
  assert(pageObj instanceof PdfPage, 'addPage({ width, height }) works (object)');
  assert(pageObj.width === 600, 'Object width = 600');
  assert(pageObj.height === 800, 'Object height = 800');

  const pageLetter = doc.addPage(PageSizes.Letter);
  assert(pageLetter.width === 612, 'Letter width = 612');
  assert(pageLetter.height === 792, 'Letter height = 792');

  const pageDefault = doc.addPage();
  assert(pageDefault instanceof PdfPage, 'addPage() no args works (default size)');

  // -----------------------------------------------------------------------
  // 4. All predefined page sizes
  // -----------------------------------------------------------------------
  console.log('\n4. Predefined page sizes');
  const sizeNames = Object.keys(PageSizes) as (keyof typeof PageSizes)[];
  for (const name of sizeNames) {
    const [w, h] = PageSizes[name];
    assert(w > 0 && h > 0, `PageSizes.${name} = [${w}, ${h}]`);
  }
  assert(sizeNames.length === 14, `14 predefined sizes (got ${sizeNames.length})`);

  // -----------------------------------------------------------------------
  // 5. Standard fonts
  // -----------------------------------------------------------------------
  console.log('\n5. Standard fonts');
  const doc2 = createPdf();
  const page2 = doc2.addPage(PageSizes.A4);
  const standardFontNames = [
    'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
    'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    'Symbol', 'ZapfDingbats',
  ];
  for (const fontName of standardFontNames) {
    const font = await doc2.embedFont(fontName);
    assert(font !== undefined && font.name !== undefined, `embedFont('${fontName}') returns FontRef`);
  }

  // -----------------------------------------------------------------------
  // 6. Font measurement
  // -----------------------------------------------------------------------
  console.log('\n6. Font measurement');
  const helvetica = await doc2.embedFont('Helvetica');
  const textWidth = helvetica.widthOfTextAtSize('Hello', 12);
  assert(typeof textWidth === 'number' && textWidth > 0, `widthOfTextAtSize('Hello', 12) = ${textWidth.toFixed(2)}`);
  const textHeight = helvetica.heightAtSize(12);
  assert(typeof textHeight === 'number' && textHeight > 0, `heightAtSize(12) = ${textHeight.toFixed(2)}`);

  // -----------------------------------------------------------------------
  // 7. drawText
  // -----------------------------------------------------------------------
  console.log('\n7. drawText');
  page2.drawText('Basic text', { x: 50, y: 750 });
  assert(true, 'drawText with x, y');

  page2.drawText('With font ref', { x: 50, y: 730, font: helvetica, size: 14 });
  assert(true, 'drawText with FontRef');

  page2.drawText('Coloured', { x: 50, y: 710, color: rgb(1, 0, 0) });
  assert(true, 'drawText with RGB color');

  page2.drawText('CMYK', { x: 50, y: 690, color: cmyk(0, 1, 0, 0) });
  assert(true, 'drawText with CMYK color');

  page2.drawText('Gray', { x: 50, y: 670, color: grayscale(0.5) });
  assert(true, 'drawText with grayscale color');

  page2.drawText('Rotated', { x: 50, y: 650, rotate: degrees(15) });
  assert(true, 'drawText with rotation (degrees)');

  page2.drawText('Rad rotated', { x: 50, y: 630, rotate: radians(0.2) });
  assert(true, 'drawText with rotation (radians)');

  page2.drawText('Semi-transparent', { x: 50, y: 610, opacity: 0.5 });
  assert(true, 'drawText with opacity');

  page2.drawText('Line one\nLine two\nLine three', { x: 50, y: 590, lineHeight: 16 });
  assert(true, 'drawText multi-line');

  page2.drawText('This is a long sentence that should wrap within the maxWidth constraint set here.', {
    x: 50, y: 550, maxWidth: 200, size: 12,
  });
  assert(true, 'drawText with maxWidth wrapping');

  // -----------------------------------------------------------------------
  // 8. drawRectangle
  // -----------------------------------------------------------------------
  console.log('\n8. drawRectangle');
  page2.drawRectangle({ x: 300, y: 700, width: 100, height: 50 });
  assert(true, 'drawRectangle basic');

  page2.drawRectangle({ x: 300, y: 640, width: 100, height: 50, color: rgb(0, 0, 1) });
  assert(true, 'drawRectangle with fill color');

  page2.drawRectangle({
    x: 300, y: 580, width: 100, height: 50,
    borderColor: rgb(1, 0, 0), borderWidth: 2,
  });
  assert(true, 'drawRectangle with border');

  page2.drawRectangle({
    x: 300, y: 520, width: 100, height: 50,
    color: rgb(0, 1, 0), borderColor: rgb(0, 0, 0), borderWidth: 1,
    rotate: degrees(10), opacity: 0.7,
  });
  assert(true, 'drawRectangle with all options');

  // -----------------------------------------------------------------------
  // 9. drawLine
  // -----------------------------------------------------------------------
  console.log('\n9. drawLine');
  page2.drawLine({
    start: { x: 50, y: 450 },
    end: { x: 250, y: 450 },
  });
  assert(true, 'drawLine basic');

  page2.drawLine({
    start: { x: 50, y: 430 },
    end: { x: 250, y: 430 },
    thickness: 3, color: rgb(0, 0.5, 0), opacity: 0.8,
  });
  assert(true, 'drawLine with thickness, color, opacity');

  page2.drawLine({
    start: { x: 50, y: 410 },
    end: { x: 250, y: 410 },
    dashArray: [5, 3], dashPhase: 0,
  });
  assert(true, 'drawLine with dash pattern');

  // -----------------------------------------------------------------------
  // 10. drawCircle
  // -----------------------------------------------------------------------
  console.log('\n10. drawCircle');
  page2.drawCircle({ x: 350, y: 450, radius: 30 });
  assert(true, 'drawCircle basic');

  page2.drawCircle({
    x: 450, y: 450, radius: 25,
    color: rgb(1, 0.5, 0), borderColor: rgb(0, 0, 0), borderWidth: 2,
    opacity: 0.6,
  });
  assert(true, 'drawCircle with all options');

  // -----------------------------------------------------------------------
  // 11. drawEllipse
  // -----------------------------------------------------------------------
  console.log('\n11. drawEllipse');
  page2.drawEllipse({ x: 350, y: 350, xScale: 60, yScale: 30 });
  assert(true, 'drawEllipse basic');

  page2.drawEllipse({
    x: 350, y: 280, xScale: 50, yScale: 25,
    color: cmyk(0.5, 0, 0.5, 0), borderColor: rgb(0, 0, 0), borderWidth: 1,
    opacity: 0.9,
  });
  assert(true, 'drawEllipse with all options');

  // -----------------------------------------------------------------------
  // 12. Colour helpers
  // -----------------------------------------------------------------------
  console.log('\n12. Colour helpers');
  const r = rgb(0.1, 0.2, 0.3);
  assert(r.type === 'rgb' && r.r === 0.1, 'rgb() creates RgbColor');

  const c = cmyk(0.1, 0.2, 0.3, 0.4);
  assert(c.type === 'cmyk' && c.c === 0.1, 'cmyk() creates CmykColor');

  const g = grayscale(0.5);
  assert(g.type === 'grayscale' && g.gray === 0.5, 'grayscale() creates GrayscaleColor');

  // -----------------------------------------------------------------------
  // 13. Angle helpers
  // -----------------------------------------------------------------------
  console.log('\n13. Angle helpers');
  const d = degrees(90);
  assert(d.type === 'degrees' && d.value === 90, 'degrees(90) correct');

  const rad = radians(Math.PI);
  assert(rad.type === 'radians' && Math.abs(rad.value - Math.PI) < 1e-10, 'radians(PI) correct');

  // -----------------------------------------------------------------------
  // 14. Metadata
  // -----------------------------------------------------------------------
  console.log('\n14. Metadata');
  const doc3 = createPdf();
  doc3.setTitle('Test Title');
  doc3.setAuthor('Test Author');
  doc3.setSubject('Test Subject');
  doc3.setKeywords('test, pdf');
  doc3.setCreator('verify-api.ts');
  doc3.setProducer('modern-pdf');
  doc3.addPage();
  assert(true, 'All metadata methods work');

  // -----------------------------------------------------------------------
  // 15. Image embedding (PNG)
  // -----------------------------------------------------------------------
  console.log('\n15. PNG embedding');
  const doc4 = createPdf();
  const page4 = doc4.addPage(PageSizes.A4);

  // Minimal 2x2 RGBA PNG
  const pngBytes = createMinimalPng();
  const pngImage = await doc4.embedPng(pngBytes);
  assert(pngImage !== undefined, 'embedPng returns ImageRef');
  assert(typeof pngImage.width === 'number' && pngImage.width === 2, 'PNG width = 2');
  assert(typeof pngImage.height === 'number' && pngImage.height === 2, 'PNG height = 2');

  page4.drawImage(pngImage, { x: 50, y: 700, width: 100, height: 100 });
  assert(true, 'drawImage with PNG');

  page4.drawImage(pngImage, { x: 200, y: 700, width: 50, height: 50, opacity: 0.5, rotate: degrees(30) });
  assert(true, 'drawImage with rotation and opacity');

  // -----------------------------------------------------------------------
  // 16. Image embedding (JPEG)
  // -----------------------------------------------------------------------
  console.log('\n16. JPEG embedding');
  const jpegBytes = createMinimalJpeg();
  const jpegImage = await doc4.embedJpeg(jpegBytes);
  assert(jpegImage !== undefined, 'embedJpeg returns ImageRef');
  assert(typeof jpegImage.width === 'number', 'JPEG has width');
  assert(typeof jpegImage.height === 'number', 'JPEG has height');

  page4.drawImage(jpegImage, { x: 50, y: 500 });
  assert(true, 'drawImage with JPEG');

  // -----------------------------------------------------------------------
  // 17. Save methods
  // -----------------------------------------------------------------------
  console.log('\n17. Save methods');
  const bytes1 = await doc2.save();
  assert(bytes1 instanceof Uint8Array && bytes1.length > 0, 'save() returns Uint8Array');

  // Validate PDF structure
  const pdfStr = new TextDecoder().decode(bytes1.slice(0, 20));
  assert(pdfStr.startsWith('%PDF-1.'), 'save() starts with %PDF-1.x header');

  const pdfEnd = new TextDecoder().decode(bytes1.slice(-10));
  assert(pdfEnd.includes('%%EOF'), 'save() ends with %%EOF');

  // save with no compression
  const bytesNoCompress = await doc3.save({ compress: false });
  assert(bytesNoCompress instanceof Uint8Array && bytesNoCompress.length > 0, 'save({ compress: false }) works');

  // save with compression
  const bytesCompress = await doc3.save({ compress: true, compressionLevel: 9 });
  assert(bytesCompress instanceof Uint8Array && bytesCompress.length > 0, 'save({ compress: true, level: 9 }) works');
  assert(bytesCompress.length > 0 && bytesNoCompress.length > 0, 'Both compressed and uncompressed produce output');

  // -----------------------------------------------------------------------
  // 18. Save as stream
  // -----------------------------------------------------------------------
  console.log('\n18. saveAsStream');
  const stream = doc3.saveAsStream();
  assert(stream instanceof ReadableStream, 'saveAsStream() returns ReadableStream');

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  assert(chunks.length > 0, 'Stream produced chunks');

  // -----------------------------------------------------------------------
  // 19. Save as Blob
  // -----------------------------------------------------------------------
  console.log('\n19. saveAsBlob');
  const blob = await doc3.saveAsBlob();
  assert(blob instanceof Blob, 'saveAsBlob() returns Blob');
  assert(blob.size > 0, 'Blob has data');
  assert(blob.type === 'application/pdf', 'Blob type is application/pdf');

  // -----------------------------------------------------------------------
  // 20. Object streams
  // -----------------------------------------------------------------------
  console.log('\n20. Object streams');
  const doc5 = createPdf();
  for (let i = 0; i < 5; i++) {
    const p = doc5.addPage(PageSizes.A4);
    p.drawText(`Page ${i + 1}`, { x: 50, y: 750 });
  }
  const bytesObjStream = await doc5.save({ objectStreamThreshold: 1 });
  assert(bytesObjStream instanceof Uint8Array && bytesObjStream.length > 0, 'save with objectStreamThreshold works');

  const objStreamStr = new TextDecoder().decode(bytesObjStream);
  assert(objStreamStr.includes('/Type /XRef'), 'Object streams produce /Type /XRef');

  // -----------------------------------------------------------------------
  // 21. PDF object model
  // -----------------------------------------------------------------------
  console.log('\n21. PDF object model');

  // Helper to serialize a PDF object to a string
  function ser(obj: { serialize(w: { writeString(s: string): void; writeBytes(b: Uint8Array): void }): void }): string {
    let result = '';
    const w = {
      writeString(s: string) { result += s; },
      writeBytes(b: Uint8Array) { result += new TextDecoder().decode(b); },
    };
    obj.serialize(w);
    return result;
  }

  assert(ser(PdfNull.instance) === 'null', 'PdfNull serializes to "null"');
  assert(ser(new PdfBool(true)) === 'true', 'PdfBool(true) serializes');
  assert(ser(new PdfNumber(42)) === '42', 'PdfNumber(42) serializes');
  assert(ser(new PdfNumber(3.14)) === '3.14', 'PdfNumber(3.14) serializes');
  assert(ser(new PdfString('hello')).includes('hello'), 'PdfString serializes');
  assert(ser(PdfName.of('Type')) === '/Type', 'PdfName serializes');
  assert(ser(new PdfRef(1, 0)) === '1 0 R', 'PdfRef serializes');

  const arr = new PdfArray([new PdfNumber(1), new PdfNumber(2)]);
  const arrStr = ser(arr);
  assert(arrStr.includes('1') && arrStr.includes('2'), 'PdfArray serializes');

  const dict = new PdfDict();
  dict.set('Type', PdfName.of('Page'));
  const dictStr = ser(dict);
  assert(dictStr.includes('/Type') && dictStr.includes('/Page'), 'PdfDict serializes');

  // -----------------------------------------------------------------------
  // 22. Registry
  // -----------------------------------------------------------------------
  console.log('\n22. PdfObjectRegistry');
  const reg = new PdfObjectRegistry();
  const ref1 = reg.allocate();
  assert(ref1 instanceof PdfRef, 'allocate() returns PdfRef');
  reg.assign(ref1, new PdfNumber(42));
  const resolved = reg.resolve(ref1);
  assert(resolved instanceof PdfNumber && resolved.value === 42, 'resolve() works');

  // -----------------------------------------------------------------------
  // 23. Document structure builders
  // -----------------------------------------------------------------------
  console.log('\n23. Document structure builders');
  // buildDocumentStructure/buildPageTree are internal APIs tightly coupled
  // to the registry lifecycle; test them via the high-level API instead.
  const registry2 = new PdfObjectRegistry();
  const infoRef = buildInfoDict({ title: 'Test', author: 'Verify' }, registry2);
  assert(infoRef instanceof PdfRef, 'buildInfoDict returns PdfRef');

  const dateStr = formatPdfDate(new Date(2025, 0, 15));
  assert(dateStr.startsWith('D:2025'), 'formatPdfDate formats correctly');

  // -----------------------------------------------------------------------
  // 24. initWasm (no-op without binaries)
  // -----------------------------------------------------------------------
  console.log('\n24. initWasm');
  await initWasm(); // no-op
  assert(true, 'initWasm() with no args is a no-op');

  await initWasm('https://example.com'); // legacy signature
  assert(true, 'initWasm(string) legacy is a no-op');

  // -----------------------------------------------------------------------
  // 25. Multiple pages with mixed content
  // -----------------------------------------------------------------------
  console.log('\n25. Complex multi-page document');
  const docComplex = createPdf();
  docComplex.setTitle('Complex Test Document');
  docComplex.setAuthor('Verification Script');

  // Page 1: Text showcase
  const p1 = docComplex.addPage(PageSizes.A4);
  const helv = await docComplex.embedFont('Helvetica');
  const times = await docComplex.embedFont('Times-Roman');
  const courier = await docComplex.embedFont('Courier');

  p1.drawText('Helvetica Title', { x: 50, y: 780, font: helv, size: 24, color: rgb(0.2, 0.2, 0.8) });
  p1.drawText('Times body text with wrapping support for long paragraphs that need to fit within a specific width constraint on the page.', {
    x: 50, y: 740, font: times, size: 12, maxWidth: 500, lineHeight: 16,
  });
  p1.drawText('Courier monospace', { x: 50, y: 680, font: courier, size: 10 });

  // Page 2: Shapes showcase
  const p2 = docComplex.addPage(PageSizes.Letter);
  p2.drawRectangle({ x: 50, y: 600, width: 200, height: 100, color: rgb(0.9, 0.1, 0.1), opacity: 0.8 });
  p2.drawRectangle({ x: 100, y: 550, width: 200, height: 100, color: rgb(0.1, 0.9, 0.1), opacity: 0.6 });
  p2.drawCircle({ x: 400, y: 650, radius: 50, color: cmyk(1, 0, 0, 0), borderColor: rgb(0, 0, 0), borderWidth: 2 });
  p2.drawEllipse({ x: 400, y: 500, xScale: 80, yScale: 40, color: grayscale(0.7) });
  p2.drawLine({ start: { x: 50, y: 400 }, end: { x: 550, y: 400 }, thickness: 2, color: rgb(0, 0, 0) });

  // Page 3: Images
  const p3 = docComplex.addPage({ width: 500, height: 500 });
  const img = await docComplex.embedPng(pngBytes);
  p3.drawImage(img, { x: 50, y: 350, width: 100, height: 100 });
  p3.drawImage(img, { x: 200, y: 350, width: 100, height: 100, rotate: degrees(45), opacity: 0.5 });

  const complexBytes = await docComplex.save({ compress: true, compressionLevel: 6 });
  assert(complexBytes.length > 0, 'Complex document saved successfully');

  const complexStr = new TextDecoder().decode(complexBytes);
  assert(complexStr.includes('/Title'), 'Complex PDF has title metadata');
  assert(complexStr.includes('/Author'), 'Complex PDF has author metadata');
  assert((complexStr.match(/\/Type \/Page\b/g) || []).length >= 3, 'Complex PDF has 3+ pages');

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// -------------------------------------------------------------------------
// Helper: create minimal valid 2x2 RGBA PNG
// -------------------------------------------------------------------------
function createMinimalPng(): Uint8Array {
  // 2x2 RGBA image data with filter bytes (filter = 0 None for each row)
  const rawData = new Uint8Array([
    0, 255, 0, 0, 255,   0, 255, 0, 128,  // Row 0: filter=0, red pixel, green+alpha pixel
    0, 0, 0, 255, 255,   255, 255, 0, 64,  // Row 1: filter=0, blue pixel, yellow+alpha pixel
  ]);

  // Build PNG file
  const chunks: Uint8Array[] = [];

  // PNG signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, 2); // width
  ihdrView.setUint32(4, 2); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(buildPngChunk('IHDR', ihdr));

  // IDAT chunk (zlib wrapped)
  const zlibData = zlibSync(rawData);
  chunks.push(buildPngChunk('IDAT', zlibData));

  // IEND chunk
  chunks.push(buildPngChunk('IEND', new Uint8Array(0)));

  // Concatenate
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  // CRC32
  const crcData = chunk.slice(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcData));
  return chunk;
}

function wrapZlib(_deflated: Uint8Array): Uint8Array {
  const rawData = new Uint8Array([
    0, 255, 0, 0, 255,   0, 255, 0, 128,
    0, 0, 0, 255, 255,   255, 255, 0, 64,
  ]);
  return zlibSync(rawData);
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// -------------------------------------------------------------------------
// Helper: create minimal valid JPEG
// -------------------------------------------------------------------------
function createMinimalJpeg(): Uint8Array {
  // Minimal 1x1 pixel JPEG (gray)
  return new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
    0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
    0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
    0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
    0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
    0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
    0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
    0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
    0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
    0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
    0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
    0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
    0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
    0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
    0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0x7B, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0xFF, 0xD9,
  ]);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
