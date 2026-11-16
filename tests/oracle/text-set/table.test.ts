/**
 * Table cell text: `drawTable` with one cell "Größe €" in Helvetica (embedded with `embedFont`,
 * its resource name passed as `fontName`); pdf.js must read the cell text as given.
 */
import { beforeEach, describe, expect } from 'vitest';
import { createPdf, StandardFonts } from '../../../src/index.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

const CELL = 'Größe €';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('table cell text read back by pdf.js', () => {
  knownDefect(
    defectKey('tests-suites-image-layout-M02', '0.41.0'),
    'drawTable: pdf.js reads a Helvetica cell "Größe €" as given',
    {
      failsWith:
        /^AssertionError: expected \[ \[ 'GrÃ¶ÃŸe â‚¬' \] \] to deeply equal \[ \[ 'Größe €' \] \]$/,
    },
    async () => {
      const doc = createPdf();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawTable({ x: 50, y: 700, width: 200, fontName: font.name, rows: [{ cells: [CELL] }] });
      expect(await pdfjsLines(await cleanSave(doc))).toEqual([[CELL]]);
    },
  );
});
