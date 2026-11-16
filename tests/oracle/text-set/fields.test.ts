/**
 * Text field values (ISO 32000-2 12.7.4.3 /V), read back by pdf.js (`getFieldObjects()`, the
 * `value` of the field) and qpdf `--json=2` (the /V of each text field), in three ways:
 *
 * - Dictionary level: the public API reaches the catalog through a plugin's `onBuildCatalog`
 *   hook, so the test builds an /AcroForm there. Each field is a text field merged with its
 *   widget annotation and listed in the page's /Annots (through `onBuildPageDict`), since pdf.js
 *   reports no field without a widget. A field must be an indirect object, which only
 *   `doc.getRegistry()` (documented as internal) can register.
 * - Form API: `createTextField` and `setText`.
 * - A loaded form: the text field "Text Box 1" of the corpus file qpdf-form-acrobat.pdf, which
 *   pdf.js reads as "abc potato" before any change.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  createPdf,
  loadPdf,
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
} from '../../../src/index.js';
import type { PdfDocument } from '../../../src/index.js';
import { encodeTextString } from '../../../src/core/internal/textString.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, INPUTS, qpdfObjects, qpdfText } from './setup.js';

const TEXTS = Object.values(INPUTS);
/** The field names: one field per input text. */
const NAMES = TEXTS.map((_, i) => `text${i + 1}`);
const FORM_FILE = new URL('../../fixtures/corpus/qpdf-form-acrobat.pdf', import.meta.url);

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A one-page document whose /AcroForm holds one text field per value, named after NAMES. */
function catalogFieldDoc(values: readonly PdfString[]): PdfDocument {
  const doc = createPdf();
  doc.addPage();
  const refs = values.map((value, i) => {
    const field = new PdfDict();
    field.set('/FT', PdfName.of('Tx'));
    field.set('/T', PdfString.fromText(NAMES[i] ?? ''));
    field.set('/V', value);
    field.set('/Type', PdfName.of('Annot'));
    field.set('/Subtype', PdfName.of('Widget'));
    field.set('/Rect', PdfArray.fromNumbers([50, 700 - 40 * i, 250, 730 - 40 * i]));
    field.set('/F', PdfNumber.of(4));
    return doc.getRegistry().register(field);
  });
  doc.use({
    name: 'text-set-acroform',
    onBuildCatalog(catalog) {
      const acroForm = new PdfDict();
      acroForm.set('/Fields', PdfArray.of(refs));
      catalog.set('/AcroForm', acroForm);
    },
    onBuildPageDict(page) {
      page.set('/Annots', PdfArray.of(refs));
    },
  });
  return doc;
}

/** The value pdf.js reports for each named field (undefined for a field it does not report). */
async function pdfjsFieldValues(bytes: Uint8Array, names: readonly string[]): Promise<unknown[]> {
  const fields = await withPdfjs(bytes, (pdf) => pdf.getFieldObjects());
  return names.map((name) => (fields?.get(name)?.[0] as { value?: unknown } | undefined)?.value);
}

/** The /V qpdf reads for each named text field (undefined for a field it does not find). */
function qpdfFieldValues(bytes: Uint8Array, names: readonly string[]): (string | undefined)[] {
  const fields = [...qpdfObjects(bytes).values()].filter((d) => d['/FT'] === '/Tx');
  return names.map((name) => qpdfText(fields.find((d) => qpdfText(d['/T']) === name)?.['/V']));
}

/** Asserts that pdf.js and qpdf read `texts` as the values of the fields named `names`. */
async function expectFieldValues(
  bytes: Uint8Array,
  names: readonly string[],
  texts: readonly string[],
): Promise<void> {
  expect(await pdfjsFieldValues(bytes, names), 'pdf.js').toEqual(texts);
  expect(qpdfFieldValues(bytes, names), 'qpdf').toEqual(texts);
}

describe('text field values read back by pdf.js and qpdf', () => {
  test('dictionary level: field values written as PDF text strings read back through the catalog route', async () => {
    const values = TEXTS.map((text) => PdfString.fromBytes(encodeTextString(text), 'hex'));
    await expectFieldValues(await cleanSave(catalogFieldDoc(values)), NAMES, TEXTS);
  });

  test('dictionary level: field values made with PdfString.fromText read back as set', async () => {
    const values = TEXTS.map((text) => PdfString.fromText(text));
    await expectFieldValues(await cleanSave(catalogFieldDoc(values)), NAMES, TEXTS);
  });

  knownDefect(
    defectKey('forms-35', '0.41.4'),
    'form API: createTextField and setText values read back as set',
    {
      // setText writes each value as a text string, but save() regenerates the field
      // appearances in Helv, whose WinAnsi encoding refuses the first character of the CJK
      // text; past that, save() writes no field the form API created.
      failsWith:
        /^UnencodableTextError: Helvetica \(WinAnsiEncoding\) cannot encode "日" \(U\+65E5\) at index 0;/,
    },
    async () => {
      const doc = createPdf();
      doc.addPage();
      const form = doc.getForm();
      for (const [i, text] of TEXTS.entries()) {
        form
          .createTextField(NAMES[i] ?? '', 0, [50, 700 - 40 * i, 250, 730 - 40 * i])
          .setText(text);
      }
      await expectFieldValues(await cleanSave(doc), NAMES, TEXTS);
    },
  );

  knownDefect(
    defectKey('forms-34', '0.41.5'),
    'loaded form: a text field of qpdf-form-acrobat.pdf set with setText reads back as set',
    { failsWith: /^NoSuchFieldError: No form field named "Text Box 1" exists in this document\.$/ },
    async () => {
      const doc = await loadPdf(new Uint8Array(readFileSync(FORM_FILE)));
      doc.getForm().getTextField('Text Box 1').setText(INPUTS.latin);
      await expectFieldValues(await cleanSave(doc), ['Text Box 1'], [INPUTS.latin]);
    },
  );
});
