/**
 * A page index or a page label number that is not a whole number (1.5, NaN) is refused with an
 * InvalidArgumentError that names the argument, as an index out of range is. Without the check
 * `getPage(1.5)` returned undefined, and `copyPages` and `embedPdf` read the page at index 1.5.
 */
import { describe, expect, it } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { copyPages } from '../../../src/core/documentMerge.js';
import { setPageLabels } from '../../../src/core/pageLabels.js';
import { InvalidArgumentError } from '../../../src/errors.js';

const NOT_WHOLE = [1.5, Number.NaN] as const;

function twoPages() {
  const doc = createPdf();
  doc.addPage();
  doc.addPage();
  return doc;
}

describe('page indexes that are not whole numbers', () => {
  it.each(NOT_WHOLE)('getPage(%s) throws InvalidArgumentError', (index) => {
    expect(() => twoPages().getPage(index)).toThrow(
      expect.objectContaining({ name: 'InvalidArgumentError', argument: 'index' }),
    );
  });

  it.each(NOT_WHOLE)('addSignatureField on the page %s throws InvalidArgumentError', (index) => {
    expect(() => twoPages().addSignatureField(index, [0, 0, 10, 10], 'sig')).toThrow(
      expect.objectContaining({ name: 'InvalidArgumentError', argument: 'pageIndex' }),
    );
  });

  it.each(NOT_WHOLE)('copyPages with the index %s throws InvalidArgumentError', (index) => {
    expect(() => copyPages(twoPages(), createPdf(), [0, index])).toThrow(
      expect.objectContaining({ name: 'InvalidArgumentError', argument: 'indices' }),
    );
  });

  it.each(NOT_WHOLE)('embedPdf with the index %s throws InvalidArgumentError', async (index) => {
    const source = await twoPages().save();
    await expect(createPdf().embedPdf(source, [0, index])).rejects.toThrow(
      expect.objectContaining({ name: 'InvalidArgumentError', argument: 'pageIndices' }),
    );
  });
});

describe('page label numbers that are not whole numbers', () => {
  it.each(NOT_WHOLE)('startPage %s throws InvalidArgumentError', (startPage) => {
    expect(() => setPageLabels(twoPages(), [{ startPage, style: 'decimal' }])).toThrow(
      InvalidArgumentError,
    );
  });

  it.each(NOT_WHOLE)('start %s throws InvalidArgumentError', (start) => {
    expect(() => setPageLabels(twoPages(), [{ startPage: 0, style: 'decimal', start }])).toThrow(
      InvalidArgumentError,
    );
  });
});
