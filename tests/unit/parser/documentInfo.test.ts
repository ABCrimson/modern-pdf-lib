/**
 * The document information of a loaded file is text (ISO 32000-2 14.3.3: every key but /Trapped
 * is a text string or a date, and a text string is PDFDocEncoding, UTF-16BE with a byte order
 * mark, or UTF-8 with a byte order mark, 7.9.2.2).
 *
 * The files are built by hand, so each key holds the exact bytes a writer other than this library
 * chose. `loadPdf` decodes them with the rule of `PdfString.toText`: `getTitle` and the other
 * getters return the text, not the bytes as one character each. The saved file keeps the text:
 * qpdf `--json=2` reads the same text from the written /Title.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { latin1String } from '../../../src/internal/latin1.js';
import { expectQpdfClean, requireQpdf } from '../../helpers/oracle/qpdf.js';
import { qpdfObjects, qpdfText } from '../../oracle/text-set/setup.js';

/** The bytes of `text` in UTF-16BE with the FE FF byte order mark, as PDF hex digits. */
function utf16beHex(text: string): string {
  let digits = 'FEFF';
  for (let i = 0; i < text.length; i++) {
    digits += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${digits}>`;
}

/** The bytes of `text` in UTF-8 with the EF BB BF byte order mark, as a literal string syntax. */
function utf8Literal(text: string): string {
  return `(\xEF\xBB\xBF${latin1String(new TextEncoder().encode(text))})`;
}

/**
 * A one-page file whose /Info holds `entries` (a key to the PDF syntax of its value; a character
 * is a byte, U+0000 to U+00FF), with a classic cross-reference table.
 */
function infoPdf(entries: Readonly<Record<string, string>>): Uint8Array {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>',
    `<<${Object.entries(entries)
      .map(([key, syntax]) => `/${key}${syntax}`)
      .join('')}>>`,
  ];
  let file = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`;
  file += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 4 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(file, (c) => c.charCodeAt(0));
}

const KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const;

/** The six text getters of a loaded document, in the order of {@link KEYS}. */
async function infoTexts(file: Uint8Array): Promise<(string | undefined)[]> {
  const doc = await loadPdf(file);
  return [
    doc.getTitle(),
    doc.getAuthor(),
    doc.getSubject(),
    doc.getKeywords(),
    doc.getCreator(),
    doc.getProducer(),
  ];
}

const ALL_KEYS = (syntax: string): Record<string, string> =>
  Object.fromEntries(KEYS.map((key) => [key, syntax]));

describe('loadPdf: the information dictionary is text', () => {
  it('reads UTF-16BE strings, in hex form, as text for all six keys', async () => {
    const text = 'Résumé 日本語 😀';
    expect(await infoTexts(infoPdf(ALL_KEYS(utf16beHex(text))))).toEqual(KEYS.map(() => text));
  });

  it('reads UTF-8 strings with a byte order mark, in literal form, as text for all six keys', async () => {
    const text = 'Résumé 日本語 😀';
    expect(await infoTexts(infoPdf(ALL_KEYS(utf8Literal(text))))).toEqual(KEYS.map(() => text));
  });

  it('reads PDFDocEncoding by Annex D, not as Latin-1', async () => {
    // 0xE9 is "é" in both; 0x80 is the bullet U+2022 in PDFDocEncoding (U+0080 in Latin-1) and
    // 0xA0 is the euro sign U+20AC (a no-break space in Latin-1).
    const file = infoPdf({ Title: '(Caf\xE9 \x80 \xA0)' });
    expect((await infoTexts(file))[0]).toBe('Café • €');
  });

  it('reads a UTF-16BE date', async () => {
    const date = 'D:20240102030405Z';
    const doc = await loadPdf(
      infoPdf({ CreationDate: utf16beHex(date), ModDate: utf16beHex(date) }),
    );
    expect(doc.getCreationDate()?.toISOString()).toBe('2024-01-02T03:04:05.000Z');
    expect(doc.getModDate()?.toISOString()).toBe('2024-01-02T03:04:05.000Z');
  });
});

describe('loadPdf then save: the information text is kept', () => {
  beforeEach((ctx) => {
    requireQpdf(ctx);
  });

  // The titles are text a Latin-1 byte string can hold once decoded: saving text above U+00FF
  // follows the library's text writers, which this reader does not change.
  it.each([
    ['UTF-16BE', utf16beHex('Résumé (1)')],
    ['UTF-8', utf8Literal('Résumé (1)')],
    ['PDFDocEncoding', '(R\xE9sum\xE9 \\(1\\))'],
  ])('writes the text of a %s title, read by qpdf', async (_name, syntax) => {
    const doc = await loadPdf(infoPdf({ Title: syntax }));
    expect(doc.getTitle()).toBe('Résumé (1)');

    const saved = await doc.save();
    expectQpdfClean(saved);
    const objects = qpdfObjects(saved);
    const info = objects.get(`obj:${String(objects.get('trailer')?.['/Info'])}`);
    expect(qpdfText(info?.['/Title'])).toBe('Résumé (1)');
    expect((await loadPdf(saved)).getTitle()).toBe('Résumé (1)');
  });
});
