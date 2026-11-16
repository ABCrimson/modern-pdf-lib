/**
 * Entries that accept an option and do not act on it warn once per option with the code
 * `MPL_IGNORED_OPTION`: `StreamingPdfParser` (`parseContentStreams`), `embedFont()` (`subset`,
 * `features`), `saveAsStream()` (`objectStreamThreshold`) and `saveIncremental()`
 * (`objectStreamThreshold`, `useWasm`). Each row checks the first call, the second call, the
 * absent and undefined option, the values that change nothing, and that the message names no
 * caller value. A second block checks that the results do not change with the option.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf } from '../../../../src/index.js';
import { StreamingPdfParser } from '../../../../src/parser/streamingParser.js';
import { saveIncremental } from '../../../../src/core/io/incrementalWriter.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
  PdfString,
} from '../../../../src/core/pdfObjects.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';
import { CODE, TYPE, ignoredOptionMessage as message } from '../../../helpers/ignoredOptions.js';

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
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

function incrementalInputs() {
  const registry = new PdfObjectRegistry();
  const info = new PdfDict();
  info.set('/Title', PdfString.literal('Updated'));
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
  return {
    registry,
    structure: { catalogRef, infoRef, pagesRef },
    changed: new Set([infoRef.objectNumber]),
  };
}

const incremental = (extra: Record<string, unknown>) => {
  const { registry, structure, changed } = incrementalInputs();
  return saveIncremental(pdf, registry, structure, changed, extra);
};

interface Row {
  readonly entry: string;
  /** The subject as it appears in the message, with `()` for a function. */
  readonly subject: string;
  readonly option: string;
  /** The value passed to trigger the warning. */
  readonly value: unknown;
  /** Values that change nothing and must not warn. */
  readonly quiet?: readonly unknown[];
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const ROWS: readonly Row[] = [
  {
    entry: 'StreamingPdfParser',
    subject: 'StreamingPdfParser',
    option: 'parseContentStreams',
    value: true,
    quiet: [false],
    invoke: (extra) => new StreamingPdfParser(extra),
  },
  {
    entry: 'embedFont',
    subject: 'embedFont()',
    option: 'subset',
    value: false,
    quiet: [true],
    invoke: (extra) => createPdf().embedFont('Helvetica', extra),
  },
  {
    entry: 'embedFont',
    subject: 'embedFont()',
    option: 'features',
    value: { kern: true },
    quiet: [],
    invoke: (extra) => createPdf().embedFont('Helvetica', extra),
  },
  {
    entry: 'saveAsStream',
    subject: 'saveAsStream()',
    option: 'objectStreamThreshold',
    value: 4747,
    quiet: [Infinity],
    invoke: (extra) => createPdf().saveAsStream(extra),
  },
  {
    entry: 'saveIncremental',
    subject: 'saveIncremental()',
    option: 'objectStreamThreshold',
    value: 4747,
    quiet: [Infinity],
    invoke: incremental,
  },
  {
    entry: 'saveIncremental',
    subject: 'saveIncremental()',
    option: 'useWasm',
    value: true,
    quiet: [false],
    invoke: incremental,
  },
];

function ignoredCalls(): unknown[][] {
  return emit.mock.calls.filter(([, options]) => (options as { code?: string }).code === CODE);
}

describe.each(ROWS)('$entry option $option', (row) => {
  it('warns once on the first call and not on the second', async () => {
    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(message(row.subject, row.option), { type: TYPE, code: CODE });

    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
  });

  it('does not warn when the option is absent or undefined', async () => {
    await row.invoke({});
    await row.invoke({ [row.option]: undefined });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('does not warn for a value that changes nothing', async () => {
    for (const quiet of row.quiet ?? []) await row.invoke({ [row.option]: quiet });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('names no caller value in the message', async () => {
    await row.invoke({ [row.option]: row.value });
    const [text] = ignoredCalls()[0] as [string];
    expect(text).toBe(message(row.subject, row.option));
    if (typeof row.value === 'number') {
      expect(text).not.toContain(String(row.value));
    }
  });
});

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

describe('results stay the same', () => {
  it('StreamingPdfParser returns the same result with and without parseContentStreams', () => {
    const run = (options?: { parseContentStreams: boolean }) => {
      const parser = new StreamingPdfParser(options);
      parser.feed(pdf);
      return parser.end();
    };
    expect(run({ parseContentStreams: true })).toEqual(run());
  });

  it('embedFont returns the same font with and without subset and features', async () => {
    const plain = await createPdf().embedFont('Helvetica');
    const withOptions = await createPdf().embedFont('Helvetica', {
      subset: false,
      features: { kern: true },
    });
    expect(withOptions.name).toBe(plain.name);
  });

  it('saveAsStream writes the same bytes with and without objectStreamThreshold and has no object stream', async () => {
    const build = () => {
      const doc = createPdf();
      doc.addPage();
      return doc;
    };
    const plain = await readAll(build().saveAsStream({ compress: false }));
    const withOption = await readAll(
      build().saveAsStream({ compress: false, objectStreamThreshold: 1 }),
    );
    expect(withOption.length).toBe(plain.length);
    expect(new TextDecoder('latin1').decode(withOption)).not.toContain('/ObjStm');
  });

  it('saveIncremental writes the same bytes with and without objectStreamThreshold and useWasm', () => {
    expect(incremental({ objectStreamThreshold: 1, useWasm: true }).bytes).toEqual(
      incremental({}).bytes,
    );
  });
});
