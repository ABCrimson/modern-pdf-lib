/**
 * The options of the document, font, streaming-parser and incremental-save entries that 0.40.9
 * accepted, ignored and warned about (`MPL_IGNORED_OPTION`), each with its 0.41.0 fate:
 *
 * - Refused with an UnsupportedOptionError: `parseContentStreams: true` of `StreamingPdfParser`
 *   and `features` of `embedFont()` (removed in 0.41.0, and gone from their types); a finite
 *   `objectStreamThreshold` of `saveIncremental()` and `saveDocumentIncremental()` (removed in
 *   0.41.0; PdfSaveOptions keeps the member because `save()` honours it; both refuse it before the
 *   document is changed); a finite `objectStreamThreshold` of `saveAsStream()`
 *   (planned for 0.41.2).
 * - Carried out: `subset: false` of `embedFont()` embeds the font program whole
 *   (tests/oracle/embed-font-full.test.ts reads the output with qpdf and pdf.js), and
 *   `useWasm: true` of `saveIncremental()` is passed to the stream compressor.
 *
 * Each refused row checks the error, that the absent and undefined option and the values that
 * change nothing are accepted, and that the message names no caller value. No call emits a
 * `MPL_IGNORED_OPTION` warning.
 */

import { inflateSync } from 'node:zlib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf, loadPdf } from '../../../../src/index.js';
import { UnsupportedOptionError } from '../../../../src/errors.js';
import type { PdfLibVersion } from '../../../../src/errors.js';
import { StreamingPdfParser } from '../../../../src/parser/streamingParser.js';
import {
  saveDocumentIncremental,
  saveIncremental,
} from '../../../../src/core/io/incrementalWriter.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
  PdfStream,
  PdfString,
} from '../../../../src/core/pdfObjects.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';

/** The WASM deflate module, replaced so that a test can mark it initialized and see its calls. */
const wasmDeflate = vi.hoisted(() => ({ ready: false, levels: [] as number[] }));

vi.mock('../../../../src/codecs/internal/libdeflateWasm.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/codecs/internal/libdeflateWasm.js')>();
  const { deflateRawSync } = await import('node:zlib');
  return {
    ...actual,
    isAvailable: () => wasmDeflate.ready,
    deflateSync: (input: Uint8Array, level = 6) => {
      wasmDeflate.levels.push(level);
      return new Uint8Array(deflateRawSync(input, { level }));
    },
  };
});

let pdf: Uint8Array;

beforeAll(async () => {
  const doc = createPdf();
  doc.addPage();
  pdf = await doc.save();
});

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  const ignored = emit.mock.calls.filter(
    ([, options]) => (options as { code?: string } | undefined)?.code === 'MPL_IGNORED_OPTION',
  );
  vi.restoreAllMocks();
  resetWarningsForTesting();
  expect(ignored, 'MPL_IGNORED_OPTION warnings').toEqual([]);
});

/** A registry with an Info dict, an empty page tree and a content stream long enough to compress. */
function incrementalInputs() {
  const registry = new PdfObjectRegistry();
  const info = new PdfDict();
  info.set('/Title', PdfString.fromText('Updated'));
  const infoRef = registry.register(info);
  const pages = new PdfDict();
  pages.set('/Type', PdfName.of('Pages'));
  pages.set('/Kids', new PdfArray());
  pages.set('/Count', PdfNumber.of(0));
  const pagesRef = registry.register(pages);
  const catalog = new PdfDict();
  catalog.set('/Type', PdfName.of('Catalog'));
  catalog.set('/Pages', pagesRef);
  const catalogRef = registry.register(catalog);
  const content = registry.register(
    PdfStream.fromString('BT /F1 12 Tf 50 700 Td (Incremental) Tj ET\n'.repeat(40)),
  );
  return {
    registry,
    structure: { catalogRef, infoRef, pagesRef },
    changed: new Set([infoRef.objectNumber, content.objectNumber]),
  };
}

const incremental = (extra: Record<string, unknown>) => {
  const { registry, structure, changed } = incrementalInputs();
  return saveIncremental(pdf, registry, structure, changed, extra);
};

/** A refused option: the call throws UnsupportedOptionError with the row's fields and message. */
interface Refused {
  readonly entry: string;
  readonly option: string;
  /** A value that is refused. */
  readonly value: unknown;
  /** Values that change nothing and are accepted. */
  readonly quiet: readonly unknown[];
  readonly plannedFor?: PdfLibVersion;
  readonly message: string;
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const REFUSED: readonly Refused[] = [
  {
    entry: 'new StreamingPdfParser()',
    option: 'parseContentStreams',
    value: true,
    quiet: [false],
    message: '`new StreamingPdfParser()`: the option `parseContentStreams` was removed in 0.41.0.',
    invoke: (extra) => new StreamingPdfParser(extra),
  },
  {
    entry: 'embedFont()',
    option: 'features',
    value: { kern: true },
    quiet: [],
    message: '`embedFont()`: the option `features` was removed in 0.41.0.',
    invoke: (extra) => createPdf().embedFont('Helvetica', extra),
  },
  {
    entry: 'saveAsStream()',
    option: 'objectStreamThreshold',
    value: 4747,
    quiet: [Infinity],
    plannedFor: '0.41.2',
    message:
      '`saveAsStream()`: the option `objectStreamThreshold` is not supported in this release; it is planned for 0.41.2.',
    invoke: (extra) => createPdf().saveAsStream(extra),
  },
  {
    entry: 'saveIncremental()',
    option: 'objectStreamThreshold',
    value: 4747,
    quiet: [Infinity],
    message: '`saveIncremental()`: the option `objectStreamThreshold` was removed in 0.41.0.',
    invoke: incremental,
  },
];

/** Runs `row.invoke` so that a synchronous throw and a rejected promise both reject. */
const run = async (row: Refused, extra: Record<string, unknown>): Promise<unknown> =>
  row.invoke(extra);

describe.each(REFUSED)('$entry option $option', (row) => {
  it('throws UnsupportedOptionError with the fixed message', async () => {
    const error: unknown = await run(row, { [row.option]: row.value }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    expect(error).toMatchObject({
      code: 'unsupported-option',
      entry: row.entry,
      option: row.option,
      plannedFor: row.plannedFor,
      message: row.message,
    });
    if (typeof row.value === 'number') {
      expect((error as Error).message).not.toContain(String(row.value));
    }
  });

  it('accepts the option absent, undefined and with a value that changes nothing', async () => {
    await run(row, {});
    await run(row, { [row.option]: undefined });
    for (const quiet of row.quiet) await run(row, { [row.option]: quiet });
  });
});

describe('refused before anything is changed', () => {
  it('saveAsStream() adds no default page', () => {
    const doc = createPdf();
    expect(() => doc.saveAsStream({ objectStreamThreshold: 1 })).toThrow(UnsupportedOptionError);
    expect(doc.getPageCount()).toBe(0);
  });

  it('saveDocumentIncremental() refuses a finite objectStreamThreshold before it changes the document', async () => {
    const doc = await loadPdf(pdf);
    const before = [...doc.getRegistry()].length;
    await expect(saveDocumentIncremental(pdf, doc, { objectStreamThreshold: 5 })).rejects.toThrow(
      UnsupportedOptionError,
    );
    expect([...doc.getRegistry()].length).toBe(before);
  });

  it('embedFont() registers no font', async () => {
    const doc = createPdf();
    await expect(
      doc.embedFont('Helvetica', { features: { kern: true } } as Record<string, unknown>),
    ).rejects.toThrow(UnsupportedOptionError);
    expect((await doc.embedFont('Courier')).name).toBe('F1');
  });
});

/** The data of every /FlateDecode stream of a file whose streams carry a direct /Length. */
function flateStreams(bytes: Uint8Array): Uint8Array[] {
  const text = new TextDecoder('latin1').decode(bytes);
  const found: Uint8Array[] = [];
  for (const m of text.matchAll(/(?<!end)stream\r?\n/g)) {
    const header = text.slice(text.lastIndexOf(' obj', m.index), m.index);
    if (!header.includes('/FlateDecode')) continue;
    const start = m.index + m[0].length;
    found.push(bytes.subarray(start, start + Number(/\/Length (\d+)/.exec(header)?.[1])));
  }
  return found;
}

describe('null as the options, accepted as in 0.40.9', () => {
  it('embedFont() and new StreamingPdfParser() accept null', async () => {
    await expect(createPdf().embedFont('Helvetica', null as never)).resolves.toMatchObject({
      name: 'F1',
    });
    expect(() => new StreamingPdfParser(null as never)).not.toThrow();
  });
});

describe('options carried out', () => {
  it('embedFont() with subset: false and true returns the standard font as without it', async () => {
    const plain = await createPdf().embedFont('Helvetica');
    for (const subset of [false, true]) {
      const font = await createPdf().embedFont('Helvetica', { subset });
      expect(font.name).toBe(plain.name);
      expect(font.widthOfTextAtSize('Subset', 12)).toBe(plain.widthOfTextAtSize('Subset', 12));
    }
  });

  it('saveIncremental() with useWasm: true writes zlib data that node:zlib inflates', () => {
    const { bytes } = incremental({ useWasm: true });
    const appended = bytes.subarray(pdf.length);
    const streams = flateStreams(appended);
    expect(streams).toHaveLength(1);
    expect(new TextDecoder('latin1').decode(inflateSync(streams[0] ?? new Uint8Array()))).toBe(
      'BT /F1 12 Tf 50 700 Td (Incremental) Tj ET\n'.repeat(40),
    );
  });

  it('saveIncremental() with useWasm: true and the WASM deflate module initialized compresses with it', () => {
    wasmDeflate.ready = true;
    wasmDeflate.levels.length = 0;
    try {
      const { bytes } = incremental({ useWasm: true, compressionLevel: 7 });
      expect(wasmDeflate.levels, 'levels passed to the WASM deflate module').toEqual([7]);
      const streams = flateStreams(bytes.subarray(pdf.length));
      expect(streams).toHaveLength(1);
      expect(new TextDecoder('latin1').decode(inflateSync(streams[0] ?? new Uint8Array()))).toBe(
        'BT /F1 12 Tf 50 700 Td (Incremental) Tj ET\n'.repeat(40),
      );
      incremental({ useWasm: false });
      expect(wasmDeflate.levels, 'useWasm: false does not call the WASM module').toEqual([7]);
    } finally {
      wasmDeflate.ready = false;
    }
  });

  it('saveIncremental() with useWasm: true and the WASM deflate module not initialized writes the bytes of useWasm: false', () => {
    expect(incremental({ useWasm: true }).bytes).toEqual(incremental({ useWasm: false }).bytes);
  });

  it('saveIncremental() with Infinity as objectStreamThreshold writes the bytes of the option absent', () => {
    expect(incremental({ objectStreamThreshold: Infinity }).bytes).toEqual(incremental({}).bytes);
  });

  it('StreamingPdfParser with parseContentStreams: false returns the result of the option absent', () => {
    const parse = (options?: Record<string, unknown>) => {
      const parser = new StreamingPdfParser(options);
      parser.feed(pdf);
      return parser.end();
    };
    expect(parse({ parseContentStreams: false })).toEqual(parse());
  });
});
