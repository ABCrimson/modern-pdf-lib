/**
 * Standard-font text is normalised to NFC before it is encoded: Helvetica `drawText` of "cafe"
 * followed by U+0301 COMBINING ACUTE ACCENT writes the one WinAnsiEncoding code of "é", and
 * pdf.js reads "café".
 */
import { beforeEach, describe, expect } from 'vitest';
import { createPdf, StandardFonts } from '../../../src/index.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('standard-font text normalised to NFC', () => {
  knownDefect(
    defectKey('core-page-01', '0.41.0'),
    'Helvetica drawText of "cafe" and U+0301: pdf.js reads "café"',
    {
      failsWith:
        /^AssertionError: expected \[ \[ 'cafeÌ•' \] \] to deeply equal \[ \[ 'café' \] \]$/,
    },
    async () => {
      const doc = createPdf();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText(`cafe${String.fromCodePoint(0x0301)}`, { x: 50, y: 700, font, size: 12 });
      expect(await pdfjsLines(await cleanSave(doc))).toEqual([['café']]);
    },
  );
});
