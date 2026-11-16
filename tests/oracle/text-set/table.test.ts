/**
 * Table cell text: `drawTable` with one cell "Größe €" in Helvetica (embedded with `embedFont`,
 * its resource name passed as `fontName`); pdf.js must read the cell text as given.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, StandardFonts } from '../../../src/index.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

const CELL = 'Größe €';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('table cell text read back by pdf.js', () => {
  test('drawTable: pdf.js reads a Helvetica cell "Größe €" as given', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawTable({ x: 50, y: 700, width: 200, fontName: font.name, rows: [{ cells: [CELL] }] });
    expect(await pdfjsLines(await cleanSave(doc))).toEqual([[CELL]]);
  });
});
