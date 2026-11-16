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
import { deflateRawSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createPdf, loadPdf, PdfDocument } from '../../../src/index.js';
import { interpretPage } from '../../../src/render/interpreter.js';
import { extractImages } from '../../../src/render/imageExtract.js';
import { extractFonts } from '../../../src/render/fontExtract.js';
import { InvalidArgumentError, ResourceLimitError } from '../../../src/errors.js';
import { PdfDict, PdfName, PdfStream } from '../../../src/core/pdfObjects.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { StreamingPdfParser } from '../../../src/parser/streamingParser.js';
import { extractText, extractTextWithPositions } from '../../../src/parser/text/textExtractor.js';
import {
  buildPng,
  buildTiffImage,
  zlibOfZeroBytes,
} from '../../adversarial/image-limits.bodies.js';
import { buildCmapFont } from '../../adversarial/text-limits.bodies.js';

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

/** The error `run` throws, or `undefined` when it returns. */
function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (err) {
    return err;
  }
  return undefined;
}

/** One indirect object of {@link buildPdf}: a dictionary, or a stream written with /FlateDecode. */
type PdfSourceObject = string | { readonly dict: string; readonly data: string };

/** The text of a stream object holding `data` compressed with /FlateDecode, one character per byte. */
function flateStream({ dict, data }: { readonly dict: string; readonly data: string }): string {
  const deflated = String.fromCharCode(...deflateSync(new TextEncoder().encode(data)));
  return `<< ${dict} /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n${deflated}\nendstream`;
}

/**
 * A classic-xref PDF of `objects`, numbered from 1; object 1 is the catalog.
 * Each stream's ASCII `data` is compressed with /FlateDecode, so that
 * decoding it checks `maxDecodedStreamBytes`.
 */
function buildPdf(objects: readonly PdfSourceObject[]): Uint8Array {
  let body = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${typeof obj === 'string' ? obj : flateStream(obj)}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) body += `${String(at).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  // Latin-1: one byte per character, so the compressed bytes are written unchanged.
  return Uint8Array.from(body, (c) => c.charCodeAt(0));
}

/** A one-page PDF (objects 1 to 3) whose page has `resources` and the content `content`. */
function onePagePdf(
  resources: string,
  content: string,
  rest: readonly PdfSourceObject[],
): Uint8Array {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources ${resources} /Contents 4 0 R >>`,
    { dict: '', data: content },
    ...rest,
  ]);
}

/** A 10 x 10 /DeviceGray image XObject: 100 bytes of pixels. */
const GRAY_IMAGE_10: PdfSourceObject = {
  dict: '/Type /XObject /Subtype /Image /Width 10 /Height 10 /ColorSpace /DeviceGray /BitsPerComponent 8',
  data: 'A'.repeat(100),
};

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

  it('embedPdf loads the file it embeds under the limits of the document it embeds into', async () => {
    const { bytes, contentSize } = await contentHeavyFile();
    const low = createPdf({ limits: { maxDecodedStreamBytes: contentSize - 1 } });
    await expect(low.embedPdf(bytes)).rejects.toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxDecodedStreamBytes',
      max: contentSize - 1,
      source: 'option',
    });
    const equal = createPdf({ limits: { maxDecodedStreamBytes: contentSize } });
    expect((await equal.embedPdf(bytes)).map((page) => page.name)).toEqual(['XF1']);
  });
});

describe('copy keeps the limits', () => {
  it('gives the copy the limits of the document it copies', async () => {
    const doc = await loadPdf(nestedPageTreePdf(1), { limits: { maxDecodedStreamBytes: 100 } });
    const copy = await doc.copy();
    expect(copy.getRegistry().limits.maxDecodedStreamBytes).toBe(100);
    drawRectangles(copy.getPage(0), 10);
    expectOptionLimit(() => copy.getPage(0).getContentStream(), 100);
  });
});

describe('interpretPage limits', () => {
  /** The number of operators of the content `drawRectangles(page, 3)` writes. */
  function operatorCount(): number {
    const page = createPdf().addPage([200, 200]);
    drawRectangles(page, 3);
    return parseContentStream(page.getContentStream()).length;
  }

  it('counts the operators of the page toward maxPageOperators', () => {
    const count = operatorCount();
    const low = createPdf({ limits: { maxPageOperators: count - 1 } }).addPage([200, 200]);
    drawRectangles(low, 3);
    expect(thrownBy(() => interpretPage(low))).toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxPageOperators',
      max: count - 1,
      actual: count,
      source: 'option',
    });
    const equal = createPdf({ limits: { maxPageOperators: count } }).addPage([200, 200]);
    drawRectangles(equal, 3);
    expect(interpretPage(equal).items.length).toBeGreaterThan(0);
  });

  it('decodes a Form XObject of the page under the limits of the document', async () => {
    const form = {
      dict: '/Type /XObject /Subtype /Form /BBox [0 0 100 100]',
      data: '0 0 m 10 10 l S\n'.repeat(20),
    };
    const bytes = onePagePdf('<< /XObject << /Fm1 5 0 R >> >>', '/Fm1 Do', [form]);
    const low = (await loadPdf(bytes, { limits: { maxDecodedStreamBytes: 100 } })).getPage(0);
    // The page content itself is under the limit; the form decodes to 320 bytes.
    expect(low.getContentStream().length).toBeLessThan(100);
    expectOptionLimit(() => interpretPage(low), 100);
    expect(interpretPage((await loadPdf(bytes)).getPage(0)).items.length).toBeGreaterThan(0);
  });
});

describe('extractImages limits', () => {
  /** A page holding two 10 x 10 gray images, Im1 and Im2. */
  const twoImages = onePagePdf('<< /XObject << /Im1 5 0 R /Im2 6 0 R >> >>', '', [
    GRAY_IMAGE_10,
    GRAY_IMAGE_10,
  ]);

  it('skips an image above maxImagePixels of the document and keeps one equal to it', async () => {
    const bytes = onePagePdf('<< /XObject << /Im1 5 0 R >> >>', '', [GRAY_IMAGE_10]);
    const low = await loadPdf(bytes, { limits: { maxImagePixels: 99 } });
    expect(extractImages(low.getPage(0))).toEqual([]);
    const equal = await loadPdf(bytes, { limits: { maxImagePixels: 100 } });
    expect(extractImages(equal.getPage(0)).map((image) => image.name)).toEqual(['Im1']);
  });

  it('adds the pixels of every image of the call to maxTotalImageBytes', async () => {
    const low = await loadPdf(twoImages, { limits: { maxTotalImageBytes: 199 } });
    expect(thrownBy(() => extractImages(low.getPage(0)))).toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxTotalImageBytes',
      max: 199,
      actual: 200,
      source: 'option',
    });
    const equal = await loadPdf(twoImages, { limits: { maxTotalImageBytes: 200 } });
    expect(extractImages(equal.getPage(0)).map((image) => image.name)).toEqual(['Im1', 'Im2']);
  });
});

describe('extractFonts limits', () => {
  it('decodes a font file under the limits of the document', async () => {
    const bytes = onePagePdf('<< /Font << /F1 5 0 R >> >>', '', [
      '<< /Type /Font /Subtype /TrueType /BaseFont /Probe /FontDescriptor 6 0 R >>',
      '<< /Type /FontDescriptor /FontName /Probe /Flags 32 /FontFile2 7 0 R >>',
      { dict: '/Length1 200', data: 'F'.repeat(200) },
    ]);
    const low = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: 199 } });
    expectOptionLimit(() => extractFonts(low.getPage(0)), 199);
    const equal = await loadPdf(bytes, { limits: { maxDecodedStreamBytes: 200 } });
    expect(extractFonts(equal.getPage(0)).map((font) => font.data.length)).toEqual([200]);
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

/** Resources with fonts /F1, /F2 and on, one per count, whose ToUnicode CMap maps `count` codes in one bfrange. */
function resourcesWithCMap(...counts: number[]): PdfDict {
  const hex = (n: number): string => n.toString(16).padStart(4, '0');
  const fonts = new PdfDict();
  counts.forEach((count, i) => {
    const cmap = `begincmap\n1 beginbfrange\n<0000> <${hex(count - 1)}> <0041>\nendbfrange\nendcmap\n`;
    const font = new PdfDict();
    font.set('/Subtype', PdfName.of('/Type0'));
    font.set('/ToUnicode', PdfStream.fromBytes(new TextEncoder().encode(cmap)));
    fonts.set(`/F${i + 1}`, font);
  });
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

  it('shares maxTotalCMapMappings across the fonts of the call', () => {
    const resources = resourcesWithCMap(6, 6);
    expect(
      thrownBy(() => extractText(operators, resources, { limits: { maxTotalCMapMappings: 11 } })),
    ).toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxTotalCMapMappings',
      max: 11,
      actual: 12,
      source: 'option',
    });
    expect(extractText(operators, resources, { limits: { maxTotalCMapMappings: 12 } })).toBe('A');
  });
});

describe('image and font embedding limits', () => {
  /** A lossless 10 x 10 WebP file (100 pixels). */
  const webp10 = Uint8Array.fromHex(
    '524946461e000000574542505650384c110000002f0940020016103820e08181ffff07000000',
  );
  /** Each embed call, run as a promise: embedPng is async, embedWebP and embedTiff are not. */
  const embedsOf: ReadonlyArray<readonly [string, (doc: PdfDocument) => Promise<unknown>]> = [
    ['embedPng', async (doc) => doc.embedPng(buildPng(10, 10, 2, zlibOfZeroBytes(310)))],
    ['embedWebP', async (doc) => doc.embedWebP(webp10)],
    ['embedTiff', async (doc) => doc.embedTiff(buildTiffImage(10, 10, 1, new Uint8Array(100)))],
  ];

  it.each(embedsOf)(
    '%s decodes a 10 x 10 image under maxImagePixels of the document',
    async (_name, embed) => {
      await expect(embed(createPdf({ limits: { maxImagePixels: 99 } }))).rejects.toMatchObject({
        name: 'ResourceLimitError',
        limit: 'maxImagePixels',
        max: 99,
        actual: 100,
        source: 'option',
      });
      await expect(embed(createPdf({ limits: { maxImagePixels: 100 } }))).resolves.toBeDefined();
      await expect(embed(createPdf())).resolves.toBeDefined();
    },
  );

  it('embedFont reads the cmap of a font under maxFontCmapMappings of the document', async () => {
    const font = buildCmapFont({ format: 12, numGlyphs: 600, ranges: [[0x20, 0x7e, 1]] });
    await expect(
      createPdf({ limits: { maxFontCmapMappings: 94 } }).embedFont(font),
    ).rejects.toMatchObject({
      name: 'ResourceLimitError',
      limit: 'maxFontCmapMappings',
      max: 94,
      actual: 95,
      source: 'option',
    });
    await expect(
      createPdf({ limits: { maxFontCmapMappings: 95 } }).embedFont(font),
    ).resolves.toBeDefined();
  });
});

describe('save rewraps under the limits of the document', () => {
  const DECODED = 4000;
  /** A catalog, a page tree, a page, and object 4: a raw DEFLATE /FlateDecode stream of 4,000 zero bytes. */
  const RAW_FILE = ((): Uint8Array => {
    const raw = String.fromCharCode(...deflateRawSync(new Uint8Array(DECODED)));
    return buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
      `<< /Filter /FlateDecode /Length ${raw.length} >>\nstream\n${raw}\nendstream`,
    ]);
  })();

  /** Whether the saved bytes hold a stream that starts with a zlib header (0x78 0x9c). */
  function hasZlibStream(saved: Uint8Array): boolean {
    return /stream\r?\n\x78\x9c/.test(String.fromCharCode(...saved));
  }

  it('writes the raw DEFLATE stream back as zlib data under the default limits', async () => {
    expect(hasZlibStream(await (await loadPdf(RAW_FILE)).save())).toBe(true);
  });

  it('leaves a stream that decodes past maxDecodedStreamBytes of the document as loaded', async () => {
    const low = await loadPdf(RAW_FILE, { limits: { maxDecodedStreamBytes: DECODED - 1 } });
    expect(hasZlibStream(await low.save())).toBe(false);
  });

  it('writes a stream that decodes to exactly maxDecodedStreamBytes back as zlib data', async () => {
    const equal = await loadPdf(RAW_FILE, { limits: { maxDecodedStreamBytes: DECODED } });
    expect(hasZlibStream(await equal.save())).toBe(true);
  });
});
