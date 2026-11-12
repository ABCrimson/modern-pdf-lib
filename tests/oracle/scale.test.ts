/**
 * Scale documents against outside readers, replacing the in-memory counts of
 * tests/integration/stress.test.ts.
 *
 * A document with 10,000 form fields across 100 pages passes `qpdf --check`; two markers
 * record that pdf.js finds none of those fields in the saved file
 * and that the library does not find them after a reload. A save and reload that adds a page
 * keeps both pages' text in pdf.js. qpdf comes from `QPDF`, then `PATH`; each test skips with
 * a reason where qpdf is absent locally and fails when `CI` is set.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { createPdf, loadPdf, PageSizes, StandardFonts } from '../../src/index.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import { expectPdfjsText, withPdfjs } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

const PLAIN = { compress: false } as const;
const PAGES = 100;
const FIELDS_PER_PAGE = 100;
const FIELDS = PAGES * FIELDS_PER_PAGE;
/** Building and saving the 10,000-field document takes several seconds. */
const BUILD_TIMEOUT = 60_000;

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('a document with 10,000 form fields', () => {
  let bytes: Uint8Array;

  beforeAll(async () => {
    const doc = createPdf();
    const form = doc.getForm();
    for (let p = 0; p < PAGES; p++) {
      doc.addPage(PageSizes.A4);
      for (let f = 0; f < FIELDS_PER_PAGE; f++) {
        const y = 800 - (f % 50) * 15;
        const x = f < 50 ? 0 : 250;
        form.createTextField(`field_p${p}_f${f}`, p, [x, y, x + 200, y + 12]);
      }
    }
    expect(form.getFields().length).toBe(FIELDS);
    bytes = await doc.save(PLAIN);
  }, BUILD_TIMEOUT);

  test('passes qpdf --check', () => {
    expectQpdfClean(bytes);
  });

  knownDefect(
    defectKey('forms-35', '0.41.4'),
    'pdf.js getFieldObjects() holds 10,000 fields',
    { failsWith: /^AssertionError: pdf\.js getFieldObjects\(\) size: expected \+0 to be 10000/ },
    async () => {
      expectQpdfClean(bytes);
      const fields = await withPdfjs(bytes, (pdf) => pdf.getFieldObjects());
      expect(fields?.size ?? 0, 'pdf.js getFieldObjects() size').toBe(FIELDS);
    },
  );

  knownDefect(
    defectKey('forms-35', '0.41.4'),
    'loadPdf() of the saved file finds 10,000 fields',
    { failsWith: /^AssertionError: loaded getFields\(\) length: expected \+0 to be 10000/ },
    async () => {
      expectQpdfClean(bytes);
      const doc = await loadPdf(bytes);
      expect(doc.getForm().getFields().length, 'loaded getFields() length').toBe(FIELDS);
    },
  );
});

describe('save and reload', () => {
  test('a page added after reload shows its text in pdf.js next to the first page', async () => {
    const doc1 = createPdf();
    const font1 = await doc1.embedFont(StandardFonts.Helvetica);
    doc1.addPage(PageSizes.A4).drawText('Original page', {
      x: 50,
      y: 750,
      size: 18,
      font: font1.name,
    });
    const bytes1 = await doc1.save(PLAIN);
    expectQpdfClean(bytes1);
    await expectPdfjsText(bytes1, ['Original page']);

    const doc2 = await loadPdf(bytes1);
    expect(doc2.getPageCount()).toBe(1);
    const font2 = await doc2.embedFont(StandardFonts.Courier);
    doc2.addPage(PageSizes.Letter).drawText('New page after reload', {
      x: 50,
      y: 750,
      size: 16,
      font: font2.name,
    });
    const bytes2 = await doc2.save(PLAIN);
    expectQpdfClean(bytes2);
    await expectPdfjsText(bytes2, ['Original page', 'New page after reload']);
  });
});
