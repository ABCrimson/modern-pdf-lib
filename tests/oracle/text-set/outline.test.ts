/**
 * Outline titles (ISO 32000-2 12.3.3 /Title): one top-level outline item per input text is
 * added with `getOutlines().addItem`, the file is saved, and pdf.js (`getOutline()` titles, in
 * order) and qpdf `--json=2` (the /Title of every outline item) each report the texts given.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../../src/index.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, INPUTS, qpdfObjects, qpdfText } from './setup.js';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** Saves one outline item per text and asserts that pdf.js and qpdf read the titles. */
async function expectTitlesReadBack(texts: readonly string[]): Promise<void> {
  const doc = createPdf();
  doc.addPage();
  const outline = doc.getOutlines();
  for (const text of texts) outline.addItem(text, { type: 'page', pageIndex: 0, fit: 'Fit' });
  const bytes = await cleanSave(doc);

  const titles = await withPdfjs(bytes, async (pdf) =>
    ((await pdf.getOutline()) ?? []).map((item) => item.title),
  );
  expect(titles, 'pdf.js').toEqual(texts);

  // An outline item is the dictionary with both /Title and /Parent (12.3.3, Table 151).
  const items = [...qpdfObjects(bytes).values()].filter((d) => '/Title' in d && '/Parent' in d);
  const byCodeUnit = (a = '', b = ''): number => (a < b ? -1 : a > b ? 1 : 0);
  expect(items.map((d) => qpdfText(d['/Title'])).toSorted(byCodeUnit), 'qpdf').toEqual(
    texts.toSorted(byCodeUnit),
  );
}

describe('outline titles read back by pdf.js and qpdf', () => {
  test('ASCII text: pdf.js and qpdf read the outline title as set', async () => {
    await expectTitlesReadBack([INPUTS.ascii]);
  });

  test('text above U+00FF: pdf.js and qpdf read each outline title as set', async () => {
    await expectTitlesReadBack([INPUTS.latin, INPUTS.cjk, INPUTS.astral]);
  });
});
