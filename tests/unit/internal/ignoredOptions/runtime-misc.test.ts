/**
 * `metadataPlugin` carries out its options `creator`, `defaultTitle` and `defaultAuthor`, so it
 * no longer warns (0.40.9 warned once per option). Each row checks that the first call emits
 * no library warning, and that the option takes effect: `creator` when the plugin registers, the
 * two defaults at save and only where the document has no title or author.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf } from '../../../../src/core/pdfDocument.js';
import type { PdfDocument } from '../../../../src/core/pdfDocument.js';
import { metadataPlugin } from '../../../../src/plugins/builtins/metadataPlugin.js';
import { resetWarningsForTesting, WARNING_TYPE } from '../../../../src/internal/warnings.js';

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

interface Row {
  readonly option: 'creator' | 'defaultTitle' | 'defaultAuthor';
  /** The document member that shows the option took effect. */
  readonly read: (doc: PdfDocument) => string | undefined;
}

interface DefaultRow extends Row {
  readonly option: 'defaultTitle' | 'defaultAuthor';
  /** The document member that sets the value the option is the default for. */
  readonly set: (doc: PdfDocument, value: string) => void;
}

const DEFAULT_ROWS: readonly DefaultRow[] = [
  {
    option: 'defaultTitle',
    read: (doc) => doc.getTitle(),
    set: (doc, value) => doc.setTitle(value),
  },
  {
    option: 'defaultAuthor',
    read: (doc) => doc.getAuthor(),
    set: (doc, value) => doc.setAuthor(value),
  },
];

const ROWS: readonly Row[] = [
  { option: 'creator', read: (doc) => doc.getCreator() },
  ...DEFAULT_ROWS,
];

function libraryWarnings(): unknown[][] {
  return emit.mock.calls.filter(
    ([, options]) => (options as { type?: string } | undefined)?.type === WARNING_TYPE,
  );
}

describe.each(ROWS)('metadataPlugin option $option', (row) => {
  it('emits no warning, on the first call or the second', () => {
    metadataPlugin({ [row.option]: 'VALUE' });
    metadataPlugin({ [row.option]: 'VALUE' });
    expect(libraryWarnings()).toHaveLength(0);
  });

  it.each([
    ['absent', {}],
    ['undefined', { [row.option]: undefined }],
  ])('does nothing to the document when the option is %s', async (_, options) => {
    const doc = createPdf();
    doc.use(metadataPlugin(options));
    await doc.save();
    expect(row.read(doc)).toBeUndefined();
  });

  it('takes effect on a document that has no value', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ [row.option]: 'VALUE' }));
    await doc.save();
    expect(row.read(doc)).toBe('VALUE');
  });
});

describe.each(DEFAULT_ROWS)('metadataPlugin option $option as a default', (row) => {
  it('leaves a value the document already has', async () => {
    const doc = createPdf();
    row.set(doc, 'SET BEFORE');
    doc.use(metadataPlugin({ [row.option]: 'VALUE' }));
    await doc.save();
    expect(row.read(doc)).toBe('SET BEFORE');
  });

  it('fills an empty value at save and not before', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ [row.option]: 'VALUE' }));
    row.set(doc, '');
    expect(row.read(doc)).toBe('');
    await doc.save();
    expect(row.read(doc)).toBe('VALUE');
  });
});

describe('metadataPlugin creator', () => {
  it('is set when the plugin registers, before any save', () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ creator: 'Invoice app' }));
    expect(doc.getCreator()).toBe('Invoice app');
  });
});

describe('metadataPlugin defaults', () => {
  it('are not applied when the plugin registers, only at save', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ defaultTitle: 'Invoice', defaultAuthor: 'Billing' }));
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    await doc.save();
    expect(doc.getTitle()).toBe('Invoice');
    expect(doc.getAuthor()).toBe('Billing');
  });

  it('an empty default writes nothing', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ defaultTitle: '', defaultAuthor: '' }));
    await doc.save();
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
  });

  it('are not applied by saveAsStream(), which runs no plugin hook', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ defaultTitle: 'Invoice', defaultAuthor: 'Billing' }));
    await new Response(doc.saveAsStream()).arrayBuffer();
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
  });
});
