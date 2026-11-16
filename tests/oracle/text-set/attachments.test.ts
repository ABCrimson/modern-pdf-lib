/**
 * Embedded file names and descriptions (ISO 32000-2 7.11.3 /UF, /F, /Desc; 7.9.6 name tree
 * keys): `attachFile` stores each name and description as a PDF text string, the file is saved,
 * and pdf.js (`getAttachments()`: the name tree key, the file name and the description) and
 * qpdf `--json=2` (the /UF and /Desc of each file specification) report the texts given.
 *
 * The names are the four inputs of the set (./setup.ts) and "Größe": ASCII, text PDFDocEncoding
 * holds, CJK text that needs UTF-16BE, and a surrogate pair.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../../src/index.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, INPUTS, qpdfObjects, qpdfText } from './setup.js';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

const NAMES = [INPUTS.ascii, INPUTS.latin, INPUTS.cjk, INPUTS.astral, 'Größe'] as const;
const byCodeUnit = (a = '', b = ''): number => (a < b ? -1 : a > b ? 1 : 0);

describe('embedded file names read back by pdf.js and qpdf', () => {
  test('each name and description is read as given', async () => {
    const doc = createPdf();
    doc.addPage();
    for (const name of NAMES) {
      doc.attachFile(name, new TextEncoder().encode(name), 'text/plain', {
        description: `Beschreibung ${name}`,
      });
    }
    const bytes = await cleanSave(doc);

    const found = await withPdfjs(bytes, async (pdf) => {
      const attachments = await pdf.getAttachments();
      return [...(attachments ?? [])].map(([key, file]) => ({
        key,
        filename: file.filename,
        description: file.description,
      }));
    });
    expect(found.map((f) => f.key).toSorted(byCodeUnit), 'pdf.js name tree keys').toEqual(
      [...NAMES].toSorted(byCodeUnit),
    );
    for (const file of found) {
      expect(file.filename, 'pdf.js file name').toBe(file.key);
      expect(file.description, 'pdf.js description').toBe(`Beschreibung ${file.key}`);
    }

    // A file specification is the dictionary with an /EF entry (7.11.3, Table 43).
    const specs = [...qpdfObjects(bytes).values()].filter((d) => '/EF' in d);
    expect(specs.map((d) => qpdfText(d['/UF'])).toSorted(byCodeUnit), 'qpdf /UF').toEqual(
      [...NAMES].toSorted(byCodeUnit),
    );
    expect(specs.map((d) => qpdfText(d['/Desc'])).toSorted(byCodeUnit), 'qpdf /Desc').toEqual(
      NAMES.map((n) => `Beschreibung ${n}`).toSorted(byCodeUnit),
    );
  });

  test('a name tree of non-ASCII names passes qpdf --check', async () => {
    const names = ['€-Rechnung.pdf', 'Übersicht.pdf', '– Notiz.txt', 'Ärger.txt', '日本語.txt'];
    const doc = createPdf();
    doc.addPage();
    for (const name of names) doc.attachFile(name, new TextEncoder().encode(name), 'text/plain');
    const bytes = await cleanSave(doc);

    const keys = await withPdfjs(bytes, async (pdf) =>
      [...((await pdf.getAttachments()) ?? [])].map(([key]) => key),
    );
    expect(keys.toSorted(byCodeUnit)).toEqual([...names].toSorted(byCodeUnit));
  });
});
