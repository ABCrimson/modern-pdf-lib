/**
 * The typed errors of the document and page classes, the colour constructors, font embedding,
 * the incremental writer and the streaming parser: one real call per throw site asserts the
 * class, its `code` and the message, which stays as it was before the classes were typed.
 */
import { describe, expect, it } from 'vitest';
import {
  colorToHex,
  cmyk,
  componentsToColor,
  createPdf,
  deviceNColor,
  FontNotEmbeddedError,
  grayscale,
  hexToColor,
  InvalidArgumentError,
  InvalidColorError,
  InvalidPageSizeError,
  InvalidStateError,
  MalformedInputError,
  PdfError,
  PdfParseError,
  RemovePageFromEmptyDocumentError,
  rgb,
  saveDocumentIncremental,
  StandardFonts,
  StreamingParseError,
  StreamingPdfParser,
  UnsupportedFeatureError,
} from '../../../src/index.js';
import type { PdfErrorCode } from '../../../src/index.js';
import { embedFontSync } from '../../../src/assets/font/fontEmbed.js';

/** The error `run` throws, or its promise rejects with; fails the test when it returns. */
async function errorOf(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return expect.unreachable('the call returned');
}

type ErrorClass = abstract new (...args: never[]) => PdfError;

interface Site {
  readonly call: string;
  readonly run: () => unknown;
  readonly Class: ErrorClass;
  readonly code: PdfErrorCode;
  /** Fields the error carries: the message and, for an argument error, the argument. */
  readonly fields: Readonly<Record<string, unknown>>;
}

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/**
 * The message of a streaming parse error: the first line with its offset, then the expected and
 * found values, as 0.40.9 wrote them; `context` adds the hex dump of the data around the offset.
 */
function streamingMessage(
  first: string,
  offset: number,
  expected: string,
  actual: string,
  context = false,
): string | RegExp {
  const lines = `${first} (at byte offset ${offset})\n  Expected: ${expected}\n  Got: ${actual}`;
  return context ? new RegExp(`^${RegExp.escape(lines)}\\n  Context:\\n.*\\[`, 's') : lines;
}

function docWithPages(count: number) {
  const doc = createPdf();
  for (let i = 0; i < count; i++) doc.addPage();
  return doc;
}

/** An sfnt file with the four tables the metrics reader needs and no outline table. */
function sfntWithoutOutlines(signature: 'OTTO' | 'true'): Uint8Array {
  const tables: [string, number][] = [
    ['head', 54],
    ['hhea', 36],
    ['maxp', 6],
    ['hmtx', 8],
  ];
  const start = 12 + 16 * tables.length;
  const bytes = new Uint8Array(start + tables.reduce((n, [, size]) => n + size, 0));
  const view = new DataView(bytes.buffer);
  bytes.set(latin1(signature), 0);
  view.setUint16(4, tables.length);
  const at = new Map<string, number>();
  let offset = start;
  for (const [i, [tag, size]] of tables.entries()) {
    bytes.set(latin1(tag), 12 + 16 * i);
    view.setUint32(12 + 16 * i + 8, offset);
    view.setUint32(12 + 16 * i + 12, size);
    at.set(tag, offset);
    offset += size;
  }
  const head = at.get('head')!;
  view.setUint32(head, 0x00010000);
  view.setUint32(head + 12, 0x5f0f3cf5);
  view.setUint16(head + 18, 1000);
  view.setInt16(head + 38, -200);
  view.setInt16(head + 40, 1000);
  view.setInt16(head + 42, 800);
  const hhea = at.get('hhea')!;
  view.setUint32(hhea, 0x00010000);
  view.setInt16(hhea + 4, 800);
  view.setInt16(hhea + 6, -200);
  view.setUint16(hhea + 34, 2);
  const maxp = at.get('maxp')!;
  view.setUint32(maxp, 0x00010000);
  view.setUint16(maxp + 4, 2);
  const hmtx = at.get('hmtx')!;
  view.setUint16(hmtx, 500);
  view.setUint16(hmtx + 4, 600);
  return bytes;
}

const SITES: readonly Site[] = [
  // PdfDocument: page indices and sizes
  {
    call: 'getPage(2) of a document with 2 pages',
    run: () => docWithPages(2).getPage(2),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'index', message: 'Page index 2 out of range [0, 1]' },
  },
  {
    call: 'insertPage(3) of a document with 2 pages',
    run: () => docWithPages(2).insertPage(3),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'index', message: 'insertPage: index 3 out of range [0, 2]' },
  },
  {
    call: 'removePage(2) of a document with 2 pages',
    run: () => docWithPages(2).removePage(2),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'index', message: 'removePage: index 2 out of range [0, 1]' },
  },
  {
    call: 'removePage(0) of a document with no page',
    run: () => createPdf().removePage(0),
    Class: RemovePageFromEmptyDocumentError,
    code: 'remove-page-from-empty-document',
    fields: { message: 'Cannot remove a page from a document with no pages.' },
  },
  {
    call: 'movePage(2, 0) of a document with 2 pages',
    run: () => docWithPages(2).movePage(2, 0),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'fromIndex', message: 'movePage: fromIndex 2 out of range [0, 1]' },
  },
  {
    call: 'movePage(0, 2) of a document with 2 pages',
    run: () => docWithPages(2).movePage(0, 2),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    // The bound is read after the page is put back, as before the class was typed.
    fields: { argument: 'toIndex', message: 'movePage: toIndex 2 out of range [0, 2]' },
  },
  {
    call: 'addSignatureField(1, ...) of a document with 1 page',
    run: () => docWithPages(1).addSignatureField(1, [0, 0, 10, 10], 'Sig'),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'pageIndex', message: 'Page index 1 out of range [0, 0]' },
  },
  {
    call: 'embedPdf(bytes, [1]) of a file with 1 page',
    run: async () => createPdf().embedPdf(await docWithPages(1).save(), [1]),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'pageIndices', message: 'embedPdf: page index 1 out of range [0, 0]' },
  },
  {
    call: 'addPage([0, 0])',
    run: () => createPdf().addPage([0, 0]),
    Class: InvalidPageSizeError,
    code: 'invalid-page-size',
    fields: {
      message:
        'Invalid page size: width=0, height=0. Both dimensions must be finite positive numbers.',
    },
  },
  {
    call: 'addPage({ width: 100, height: Infinity })',
    run: () => createPdf().addPage({ width: 100, height: Infinity }),
    Class: InvalidPageSizeError,
    code: 'invalid-page-size',
    fields: {
      message:
        'Invalid page size: width=100, height=Infinity. Both dimensions must be finite positive numbers.',
    },
  },
  {
    call: 'insertPage(0, [NaN, 100])',
    run: () => createPdf().insertPage(0, [Number.NaN, 100]),
    Class: InvalidPageSizeError,
    code: 'invalid-page-size',
    fields: {
      message:
        'Invalid page size: width=NaN, height=100. Both dimensions must be finite positive numbers.',
    },
  },
  // PdfDocument: embedded data
  {
    call: 'embedImage of 3 bytes',
    run: () => createPdf().embedImage(new Uint8Array(3)),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: { format: 'other', message: 'Image data too short to detect format' },
  },
  {
    call: 'embedImage of bytes of no image format',
    run: () => createPdf().embedImage(new Uint8Array([1, 2, 3, 4, 5])),
    Class: UnsupportedFeatureError,
    code: 'unsupported-feature',
    fields: {
      message: 'Unsupported image format. Expected PNG, JPEG, WebP, or TIFF, got 01 02 03 04.',
    },
  },
  {
    call: 'embedFont of 4 bytes',
    run: () => createPdf().embedFont(new Uint8Array(4)),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'sfnt',
      message: 'Font data too small — expected at least 12 bytes for the table directory',
    },
  },
  {
    call: 'embedFontSync of 4 bytes',
    run: () => embedFontSync(new Uint8Array(4)),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'sfnt',
      message: 'Font data too small — expected at least 12 bytes for the table directory',
    },
  },
  {
    call: 'embedFont of an OpenType file with no CFF table',
    run: () => createPdf().embedFont(sfntWithoutOutlines('OTTO')),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'sfnt',
      message: 'No CFF table found in font data. Is this a CFF-based OpenType font?',
    },
  },
  // PdfPage: call order
  {
    call: 'endTransparencyGroup() with no group',
    run: () => createPdf().addPage().endTransparencyGroup(),
    Class: InvalidStateError,
    code: 'invalid-state',
    fields: { message: 'No transparency group to end — call beginTransparencyGroup() first' },
  },
  {
    call: 'removeAnnotation of an annotation of another page',
    run: () => {
      const doc = docWithPages(2);
      const annotation = doc.getPage(0).addAnnotation('Text', { rect: [0, 0, 10, 10] });
      doc.getPage(1).removeAnnotation(annotation);
    },
    Class: InvalidStateError,
    code: 'invalid-state',
    fields: { message: 'Annotation is not on this page' },
  },
  {
    call: 'drawText with a font embedded in another document',
    run: async () => {
      const font = await createPdf().embedFont(StandardFonts.Helvetica);
      createPdf().addPage().drawText('Hello', { font });
    },
    Class: FontNotEmbeddedError,
    code: 'font-not-embedded',
    fields: { message: 'The font "F1" has not been embedded in this document.' },
  },
  // Colours
  {
    call: 'rgb(2, 0, 0)',
    run: () => rgb(2, 0, 0),
    Class: InvalidColorError,
    code: 'invalid-color',
    fields: { message: 'RGB component out of range: r=2' },
  },
  {
    call: 'rgb(0, NaN, 0)',
    run: () => rgb(0, Number.NaN, 0),
    Class: InvalidColorError,
    code: 'invalid-color',
    fields: { message: 'RGB component out of range: g=NaN' },
  },
  {
    call: 'rgb(null, 0, 0) from JavaScript',
    // @ts-expect-error -- a JavaScript caller can pass a value that is not a number
    run: () => rgb(null, 0, 0),
    Class: InvalidColorError,
    code: 'invalid-color',
    fields: { message: 'RGB component out of range: r=null' },
  },
  {
    call: 'cmyk(0, 0, 0, -0.5)',
    run: () => cmyk(0, 0, 0, -0.5),
    Class: InvalidColorError,
    code: 'invalid-color',
    fields: { message: 'CMYK component out of range: k=-0.5' },
  },
  {
    call: 'grayscale(1.5)',
    run: () => grayscale(1.5),
    Class: InvalidColorError,
    code: 'invalid-color',
    fields: { message: 'Grayscale component out of range: gray=1.5' },
  },
  {
    call: 'componentsToColor of 2 components',
    run: () => componentsToColor([0, 1]),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: {
      argument: 'components',
      message: 'componentsToColor: expected 1, 3, or 4 components, got 2',
    },
  },
  {
    call: 'deviceNColor with 2 colorants and 1 tint',
    run: () => deviceNColor(['Cyan', 'Magenta'], 'DeviceCMYK', [1]),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: {
      argument: 'tints',
      message: 'deviceNColor: colorants length (2) must match tints length (1)',
    },
  },
  {
    call: "hexToColor('#abcd')",
    run: () => hexToColor('#abcd'),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'hex', message: "hexToColor: invalid hex colour '#abcd'" },
  },
  {
    call: "hexToColor('zzzzzz')",
    run: () => hexToColor('zzzzzz'),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: { argument: 'hex', message: "hexToColor: invalid hex colour 'zzzzzz'" },
  },
  {
    call: 'colorToHex of a DeviceN colour',
    run: () => colorToHex(deviceNColor(['Cyan'], 'DeviceCMYK', [1])),
    Class: UnsupportedFeatureError,
    code: 'unsupported-feature',
    fields: { message: 'colorToHex: DeviceN colours have no single hex representation' },
  },
  // Incremental save of an original file that breaks the trailer syntax
  {
    call: 'saveDocumentIncremental of a file with no /Size',
    run: () => saveDocumentIncremental(latin1('%PDF-1.7\nstartxref\n9\n%%EOF\n'), createPdf()),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'pdf',
      message: 'Incremental save: could not find /Size in the original trailer.',
    },
  },
  {
    call: 'saveDocumentIncremental of a file with no startxref',
    run: () => saveDocumentIncremental(latin1('%PDF-1.7\ntrailer\n<< /Size 1 >>\n'), createPdf()),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'pdf',
      message:
        'Incremental save: could not find "startxref" in the original PDF. The file may be corrupted.',
    },
  },
  {
    call: 'saveDocumentIncremental of a file with no offset after startxref',
    run: () =>
      saveDocumentIncremental(
        latin1('%PDF-1.7\ntrailer\n<< /Size 1 >>\nstartxref\nx\n%%EOF\n'),
        createPdf(),
      ),
    Class: MalformedInputError,
    code: 'malformed-input',
    fields: {
      format: 'pdf',
      message: 'Incremental save: could not parse xref offset after "startxref".',
    },
  },
  // Streaming parser
  {
    call: 'new StreamingPdfParser({ maxBufferSize: NaN })',
    run: () => new StreamingPdfParser({ maxBufferSize: Number.NaN }),
    Class: InvalidArgumentError,
    code: 'invalid-argument',
    fields: {
      argument: 'options.maxBufferSize',
      message: 'StreamingPdfParser: maxBufferSize must be a number',
    },
  },
  {
    call: 'feed() past maxBufferSize',
    run: () => new StreamingPdfParser({ maxBufferSize: 4 }).feed(new Uint8Array(5)),
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: 'data within 4 bytes',
      actual: '5 bytes',
      message: streamingMessage(
        'Streaming parser buffer exceeded maximum size of 4 bytes',
        0,
        'data within 4 bytes',
        '5 bytes',
      ),
    },
  },
  {
    call: 'end() after 4 bytes',
    run: () => {
      const parser = new StreamingPdfParser();
      parser.feed(new Uint8Array(4));
      return parser.end();
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: 'at least 8 bytes',
      actual: '4 bytes',
      message: streamingMessage(
        'Invalid PDF: data too short to contain a valid PDF header.',
        0,
        'at least 8 bytes',
        '4 bytes',
      ),
    },
  },
  {
    call: 'end() of data with no header',
    run: () => {
      const parser = new StreamingPdfParser();
      parser.feed(latin1('no header in these bytes'));
      return parser.end();
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: '"%PDF-" header',
      actual: 'no header found',
      message: streamingMessage(
        'Invalid PDF: file does not contain a "%PDF-" header.',
        0,
        '"%PDF-" header',
        'no header found',
        true,
      ),
    },
  },
  {
    call: 'end() of data with no version in the header',
    run: () => {
      const parser = new StreamingPdfParser();
      parser.feed(latin1('%PDF-x.y and more bytes'));
      return parser.end();
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: '"%PDF-X.Y" version string',
      actual: '"%PDF-x.y a"',
      message: streamingMessage(
        'Invalid PDF: could not parse version from header.',
        0,
        '"%PDF-X.Y" version string',
        '"%PDF-x.y a"',
        true,
      ),
    },
  },
  {
    call: 'end() of data with no startxref',
    run: () => {
      const parser = new StreamingPdfParser();
      parser.feed(latin1('%PDF-1.7\n1 0 obj\nnull\nendobj\n'));
      return parser.end();
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: '"startxref" near end of file',
      actual: 'no "startxref" found',
      message: streamingMessage(
        'Invalid PDF: could not find "startxref" marker in the last 2048 bytes.',
        0,
        '"startxref" near end of file',
        'no "startxref" found',
        true,
      ),
    },
  },
  {
    call: 'end() of data with no offset after startxref',
    run: () => {
      const parser = new StreamingPdfParser();
      parser.feed(latin1('%PDF-1.7\nstartxref\nx\n%%EOF\n'));
      return parser.end();
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 9,
      expected: 'decimal offset after "startxref"',
      actual: '"x\n%%EOF"',
      message: streamingMessage(
        'Invalid PDF: no valid offset after "startxref".',
        9,
        'decimal offset after "startxref"',
        '"x\n%%EOF"',
        true,
      ),
    },
  },
  {
    call: 'getPageContent() before end()',
    run: () => new StreamingPdfParser().getPageContent(0),
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: 'end() called before getPageContent()',
      actual: 'end() not yet called',
      message: streamingMessage(
        'Cannot get page content before calling end().',
        0,
        'end() called before getPageContent()',
        'end() not yet called',
      ),
    },
  },
  {
    call: 'getPageContent(1) of a file with 1 page',
    run: async () => {
      const parser = new StreamingPdfParser();
      parser.feed(await docWithPages(1).save());
      parser.end();
      return parser.getPageContent(1);
    },
    Class: StreamingParseError,
    code: 'streaming-parse',
    fields: {
      offset: 0,
      expected: 'page index in [0, 1)',
      actual: '1',
      message: streamingMessage(
        'Page index 1 is out of range (0-0).',
        0,
        'page index in [0, 1)',
        '1',
      ),
    },
  },
];

describe('typed errors of the document, page, colour, font, incremental and streaming calls', () => {
  it.each(SITES)('$call throws $Class.name', async ({ run, Class, code, fields }) => {
    const error = await errorOf(run);
    expect(error).toBeInstanceOf(Class);
    expect(error).toMatchObject({ name: Class.name, code, ...fields });
    expect(PdfError.is(error, code)).toBe(true);
  });

  it('a StreamingParseError is still a PdfParseError', async () => {
    const error = await errorOf(() =>
      new StreamingPdfParser({ maxBufferSize: 1 }).feed(new Uint8Array(2)),
    );
    expect(error).toBeInstanceOf(PdfParseError);
  });

  it('drawText checks only the font references the library made', async () => {
    const font = await createPdf().embedFont(StandardFonts.Helvetica);
    const page = createPdf().addPage();
    // A copy is a font reference the caller made; the page takes its resource name as given.
    expect(() => page.drawText('Hello', { font: { ...font } })).not.toThrow();
    const own = createPdf();
    const ownFont = await own.embedFont(StandardFonts.Helvetica);
    expect(() => own.addPage().drawText('Hello', { font: ownFont })).not.toThrow();
  });

  it('addPage of a page of another document still adds it', async () => {
    const source = docWithPages(1);
    const target = createPdf();
    expect(target.addPage(source.getPage(0))).toBe(source.getPage(0));
    expect(target.getPageCount()).toBe(1);
    await expect(target.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('drawText takes a font of the document that added the page with addPage', async () => {
    const source = docWithPages(1);
    const target = createPdf();
    const page = target.addPage(source.getPage(0));
    const font = await target.embedFont(StandardFonts.Courier);
    expect(() => page.drawText('Hello', { font })).not.toThrow();
    const before = createPdf();
    const early = await before.embedFont(StandardFonts.Courier);
    const adopted = before.addPage(docWithPages(1).getPage(0));
    expect(() => adopted.drawText('Hello', { font: early })).not.toThrow();
  });
});
