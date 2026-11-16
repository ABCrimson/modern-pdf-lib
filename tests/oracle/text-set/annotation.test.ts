/**
 * Annotation text (ISO 32000-2 12.5.2 /Contents, 12.5.6.2 /T): one Text, one FreeText and one
 * Square annotation are added with the same `contents` and `author`, the file is saved, and
 * pdf.js (`getAnnotations()`: `contentsObj.str`, `titleObj.str`) and qpdf `--json=2` (the
 * annotation dictionaries) each report that text for both entries of all three.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../../src/index.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, INPUTS, qpdfObjects, qpdfText } from './setup.js';

const TYPES = ['Text', 'FreeText', 'Square'] as const;

/** The annotation fields pdf.js reports that this file reads. */
interface PdfjsAnnotation {
  readonly subtype?: string;
  readonly contentsObj?: { readonly str?: string };
  readonly titleObj?: { readonly str?: string };
}

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** Saves three annotations holding `text` and asserts that pdf.js and qpdf read it in each. */
async function expectAnnotationsReadBack(text: string): Promise<void> {
  const doc = createPdf();
  const page = doc.addPage();
  for (const [i, type] of TYPES.entries()) {
    page.addAnnotation(type, {
      rect: [50, 700 - 60 * i, 250, 740 - 60 * i],
      contents: text,
      author: text,
    });
  }
  const bytes = await cleanSave(doc);
  const want = TYPES.map((type) => [type, text, text]);

  const annotations = await withPdfjs(
    bytes,
    async (pdf) => (await (await pdf.getPage(1)).getAnnotations()) as PdfjsAnnotation[],
  );
  expect(
    annotations.map((a) => [a.subtype, a.contentsObj?.str, a.titleObj?.str]),
    `pdf.js ${JSON.stringify(text)}`,
  ).toEqual(want);

  const dicts = [...qpdfObjects(bytes).values()];
  expect(
    TYPES.map((type) => {
      const dict = dicts.find((d) => d['/Subtype'] === `/${type}`) ?? {};
      return [type, qpdfText(dict['/Contents']), qpdfText(dict['/T'])];
    }),
    `qpdf ${JSON.stringify(text)}`,
  ).toEqual(want);
}

describe('annotation contents and author read back by pdf.js and qpdf', () => {
  test('ASCII text: pdf.js and qpdf read /Contents and /T of each annotation as set', async () => {
    await expectAnnotationsReadBack(INPUTS.ascii);
  });

  test.each([
    ['Latin text with characters of PDFDocEncoding and WinAnsiEncoding', INPUTS.latin],
    ['CJK text, which needs UTF-16BE', INPUTS.cjk],
    ['a character outside the Basic Multilingual Plane', INPUTS.astral],
  ])('%s: pdf.js and qpdf read /Contents and /T of each annotation as set', async (_kind, text) => {
    await expectAnnotationsReadBack(text);
  });
});
