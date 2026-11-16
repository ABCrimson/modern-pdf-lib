/**
 * Table cell text: `drawTable` names its fonts by resource name (`fontName`, and the `fontName` of
 * a text run); a name that a font registered on the page carries encodes through that font, so
 * pdf.js must read each cell as given: "Größe €" in Helvetica (embedded with `embedFont`), Greek
 * text in Symbol, and Cyrillic and Greek text above U+00FF in an embedded TrueType font, both as a
 * plain cell and as a text run. The TrueType font is Liberation Sans Regular as pdfjs-dist ships it
 * in standard_fonts/ (tests/fixtures holds no TrueType file); it is embedded whole, because pdf.js
 * does not read the text of a subset back yet (ledger core-document-11, open for 0.41.6).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, StandardFonts } from '../../../src/index.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

const CELL = 'Größe €';
const SYMBOL_CELL = 'αβγ Σ';
const WIDE_CELL = 'Привет Ω €';
const LIBERATION_SANS = new Uint8Array(
  readFileSync(
    join(
      import.meta.dirname,
      '../../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
    ),
  ),
);

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

  test('drawTable: pdf.js reads a Symbol cell as given', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const symbol = await doc.embedFont(StandardFonts.Symbol);
    page.drawTable({
      x: 50,
      y: 700,
      width: 200,
      fontName: symbol.name,
      rows: [{ cells: [SYMBOL_CELL] }],
    });
    expect(await pdfjsLines(await cleanSave(doc))).toEqual([[SYMBOL_CELL]]);
  });

  test('drawTable: pdf.js reads text above U+00FF in an embedded font, in a cell and in a text run', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(LIBERATION_SANS, { subset: false });
    page.drawTable({
      x: 50,
      y: 700,
      width: 300,
      fontName: font.name,
      rows: [{ cells: [WIDE_CELL] }, { cells: [{ content: [{ text: WIDE_CELL }] }] }],
    });
    expect(await pdfjsLines(await cleanSave(doc))).toEqual([[WIDE_CELL, WIDE_CELL]]);
  });
});
