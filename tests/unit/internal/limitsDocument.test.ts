/**
 * The limits of a document: loadPdf and createPdf take a `limits` option, the
 * document keeps the resolved limits on its object registry, and every later
 * call on the document (getContentStream, interpretPage, embedPage into
 * another document) decodes under them. A second document in the same process
 * keeps its own limits.
 *
 * The sizes come from qpdf 12.4.2: in qpdf-objstm-xref.pdf the object stream
 * (object 1) decodes to 339 bytes (`qpdf --show-object=1
 * --filtered-stream-data`), the largest stream the load decodes; the page
 * content (object 7) decodes to 44 bytes.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createPdf, loadPdf, PdfDocument } from '../../../src/index.js';
import { interpretPage } from '../../../src/render/interpreter.js';
import { InvalidArgumentError, ResourceLimitError } from '../../../src/errors.js';
import { PdfDict, PdfName, PdfStream } from '../../../src/core/pdfObjects.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { StreamingPdfParser } from '../../../src/parser/streamingParser.js';
import { extractText, extractTextWithPositions } from '../../../src/parser/text/textExtractor.js';

const OBJSTM_FILE = new URL('../../fixtures/corpus/qpdf-objstm-xref.pdf', import.meta.url);
/** The decoded size of object 1, the object stream of qpdf-objstm-xref.pdf (qpdf). */
const OBJSTM_DECODED = 339;

/** Expects `run` to throw a ResourceLimitError for `maxDecodedStreamBytes` set by the option. */
function expectOptionLimit(run: () => unknown, max: number): void {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(ResourceLimitError);
  expect(caught).toMatchObject({ limit: 'maxDecodedStreamBytes', max, source: 'option' });
}

/** Draws `count` rectangles: about 30 bytes of page operators each. */
function drawRectangles(page: ReturnType<PdfDocument['addPage']>, count: number): void {
  for (let i = 0; i < count; i++) page.drawRectangle({ x: i, y: i, width: 10, height: 10 });
}

/** A one-page document whose single content stream decodes to several KiB, saved and the decoded size. */
async function contentHeavyFile(): Promise<{ bytes: Uint8Array; contentSize: number }> {
  const doc = createPdf();
  drawRectangles(doc.addPage([200, 200]), 300);
  const bytes = await doc.save();
  // One content stream: getContentStream adds one newline after it.
  const contentSize = (await loadPdf(bytes)).getPage(0).getContentStream().length - 1;
  return { bytes, contentSize };
}

describe('loadPdf limits', () => {
  it('refuses an object stream one byte above maxDecodedStreamBytes, with source "option"', async () => {
    const bytes = new Uint8Array(await readFile(OBJSTM_FILE));
    const load = loadPdf(bytes, { limits: { maxDecodedStreamBytes: OBJSTM_DECODED - 1 } });
    await expect(load).rejects.toBeInstanceOf(ResourceLimitError);
    await expect(load).rejects.toMatchObject({
      limit: 'maxDecodedStreamBytes',
      max: OBJSTM_DECODED - 1,
      actual: OBJSTM_DECODED,
      source: 'option',
    });
  });

  it('loads when the object stream decodes to exactly maxDecodedStreamBytes', async () => {
    const bytes = new Uint8Array(await readFile(OBJSTM_FILE));
    const doc = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: OBJSTM_DECODED } });
    expect(doc.getPageCount()).toBe(1);
  });

  it('keeps its limits for getContentStream and interpretPage; a second document keeps the defaults', async () => {
    const bytes = new Uint8Array(await readFile(OBJSTM_FILE));
    const low = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: OBJSTM_DECODED } });
    const other = await loadPdf(bytes);
    const lowPage = low.getPage(0);
    const otherPage = other.getPage(0);
    drawRectangles(lowPage, 20);
    drawRectangles(otherPage, 20);
    expectOptionLimit(() => lowPage.getContentStream(), OBJSTM_DECODED);
    expectOptionLimit(() => interpretPage(lowPage), OBJSTM_DECODED);
    expect(otherPage.getContentStream().length).toBeGreaterThan(OBJSTM_DECODED);
    expect(interpretPage(otherPage).items.length).toBeGreaterThan(0);
  });

  it('refuses a page tree deeper than maxTreeDepth', async () => {
    const bytes = new Uint8Array(await readFile(OBJSTM_FILE));
    // The page tree root is level 1, the page level 2.
    await expect(loadPdf(bytes, { limits: { maxTreeDepth: 1 } })).rejects.toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxTreeDepth',
      max: 1,
      actual: 2,
      source: 'option',
    });
    expect((await loadPdf(bytes, { limits: { maxTreeDepth: 2 } })).getPageCount()).toBe(1);
  });

  it('refuses an invalid limits option with InvalidArgumentError', async () => {
    const bytes = new Uint8Array(await readFile(OBJSTM_FILE));
    // @ts-expect-error -- an unknown limit name is the input under test
    const load = loadPdf(bytes, { limits: { maxPages: 1 } });
    await expect(load).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(load).rejects.toMatchObject({ argument: 'limits.maxPages' });
  });
});

describe('embedding decodes under the limits of the source document', () => {
  it('refuses a page of a low-limit document embedded into a default document', async () => {
    const { bytes, contentSize } = await contentHeavyFile();
    const low = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: contentSize - 1 } });
    const target = createPdf();
    expectOptionLimit(() => target.embedPage(low.getPage(0)), contentSize - 1);
  });

  it('embeds the page when the source limit equals the decoded content size', async () => {
    const { bytes, contentSize } = await contentHeavyFile();
    const source = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: contentSize } });
    const target = createPdf();
    expect(target.embedPage(source.getPage(0)).name).toBe('XF1');
  });

  it('decodes under the source limits when the target document has lower ones', async () => {
    const { bytes, contentSize } = await contentHeavyFile();
    const source = await loadPdf(bytes);
    const target = createPdf({ limits: { maxDecodedStreamBytes: contentSize - 1 } });
    expect(target.embedPage(source.getPage(0)).name).toBe('XF1');
  });
});

describe('createPdf limits', () => {
  it('keeps the limits of the option for the pages of the document', () => {
    const doc = createPdf({ limits: { maxDecodedStreamBytes: 100 } });
    const page = doc.addPage([200, 200]);
    drawRectangles(page, 10);
    expectOptionLimit(() => page.getContentStream(), 100);
    const other = PdfDocument.create();
    const otherPage = other.addPage([200, 200]);
    drawRectangles(otherPage, 10);
    expect(otherPage.getContentStream().length).toBeGreaterThan(100);
  });

  it('takes the option on PdfDocument.create too', () => {
    const page = PdfDocument.create({ limits: { maxDecodedStreamBytes: 100 } }).addPage([200, 200]);
    drawRectangles(page, 10);
    expectOptionLimit(() => page.getContentStream(), 100);
  });

  it('refuses an invalid limits option with InvalidArgumentError', () => {
    expect(() => createPdf({ limits: { maxDecodedStreamBytes: 0 } })).toThrow(InvalidArgumentError);
  });
});

/** A classic-xref PDF whose page sits under `levels` /Pages nodes (the root is level 1). */
function nestedPageTreePdf(levels: number): Uint8Array {
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>'];
  for (let i = 0; i < levels; i++) {
    const num = 2 + i;
    const kid = num + 1;
    const parent = i === 0 ? '' : ` /Parent ${num - 1} 0 R`;
    objects.push(`<< /Type /Pages /Kids [${kid} 0 R] /Count 1${parent} >>`);
  }
  objects.push(`<< /Type /Page /Parent ${levels + 1} 0 R /MediaBox [0 0 100 100] >>`);
  let body = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) body += `${String(at).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe('StreamingPdfParser limits', () => {
  it('walks the page tree at most maxTreeDepth levels deep', () => {
    const bytes = nestedPageTreePdf(2);
    // Two /Pages levels, the page at level 3.
    const low = new StreamingPdfParser({ limits: { maxTreeDepth: 2 } });
    low.feed(bytes);
    let caught: unknown;
    try {
      low.end();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResourceLimitError);
    expect(caught).toMatchObject({ limit: 'maxTreeDepth', max: 2, actual: 3, source: 'option' });
    const equal = new StreamingPdfParser({ limits: { maxTreeDepth: 3 } });
    equal.feed(bytes);
    expect(equal.end().pageCount).toBe(1);
  });

  it('refuses an invalid limits option in the constructor', () => {
    expect(() => new StreamingPdfParser({ limits: { maxTreeDepth: 257 } })).toThrow(
      InvalidArgumentError,
    );
  });
});

/** Resources with one font /F1 whose ToUnicode CMap maps `count` codes in one bfrange. */
function resourcesWithCMap(count: number): PdfDict {
  const hex = (n: number): string => n.toString(16).padStart(4, '0');
  const cmap = `begincmap\n1 beginbfrange\n<0000> <${hex(count - 1)}> <0041>\nendbfrange\nendcmap\n`;
  const font = new PdfDict();
  font.set('/Subtype', PdfName.of('/Type0'));
  font.set('/ToUnicode', PdfStream.fromBytes(new TextEncoder().encode(cmap)));
  const fonts = new PdfDict();
  fonts.set('/F1', font);
  const resources = new PdfDict();
  resources.set('/Font', fonts);
  return resources;
}

describe('text extraction limits', () => {
  const operators = parseContentStream(new TextEncoder().encode('BT /F1 12 Tf <0000> Tj ET'));

  it('parses each ToUnicode CMap under maxCMapMappings of the option', () => {
    const resources = resourcesWithCMap(10);
    expect(() => extractText(operators, resources, { limits: { maxCMapMappings: 9 } })).toThrow(
      ResourceLimitError,
    );
    expect(extractText(operators, resources, { limits: { maxCMapMappings: 10 } })).toBe('A');
    expect(() =>
      extractTextWithPositions(operators, resources, { limits: { maxCMapMappings: 9 } }),
    ).toThrow(ResourceLimitError);
  });

  it('adds the mappings of every CMap of the call to maxTotalCMapMappings', () => {
    const resources = resourcesWithCMap(10);
    let caught: unknown;
    try {
      extractText(operators, resources, { limits: { maxTotalCMapMappings: 9 } });
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxTotalCMapMappings',
      max: 9,
      actual: 10,
      source: 'option',
    });
    expect(extractText(operators, resources, { limits: { maxTotalCMapMappings: 10 } })).toBe('A');
  });
});
