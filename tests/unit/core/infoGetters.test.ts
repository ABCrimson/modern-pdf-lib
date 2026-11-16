/**
 * Tests for the document information getters of a loaded `PdfDocument` (`getTitle` to
 * `getModDate`): each key of the /Info dictionary is a text string (ISO 32000-2 7.9.2.2, 14.3.3),
 * and the getters return its decoded text, whichever encoding the file uses.
 */

import { describe, expect, it } from 'vitest';
import { loadPdf } from '../../../src/index.js';

/** One byte per character of `text`; the characters are all U+0000 to U+00FF. */
function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

/** A one-page classic-xref file whose trailer /Info is the dictionary body `info`. */
function pdfWithInfo(info: string): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    info,
  ];
  let s = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(s.length);
    s += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefAt = s.length;
  s += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) s += `${String(offset).padStart(10, '0')} 00000 n \n`;
  s += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return latin1(s);
}

describe('PdfDocument information getters of a loaded file', () => {
  it('return the text of UTF-16BE and UTF-8 strings that begin with a byte order mark', async () => {
    const doc = await loadPdf(
      pdfWithInfo(
        [
          '<<',
          // UTF-16BE: FE FF, then "Café".
          '/Title <FEFF00430061006600E9>',
          // UTF-8: EF BB BF, then "Café".
          '/Author <EFBBBF436166C3A9>',
          // UTF-16BE: FE FF, then "日本語 €".
          '/Subject <FEFF65E5672C8A9E002020AC>',
          // UTF-8: EF BB BF, then "日本語".
          '/Keywords <EFBBBFE697A5E69CACE8AA9E>',
          // UTF-16BE in literal form: FE FF, then "Ab".
          '/Creator (\xFE\xFF\x00A\x00b)',
          // UTF-8 in literal form: EF BB BF, then "é".
          '/Producer (\xEF\xBB\xBF\xC3\xA9)',
          // UTF-16BE: FE FF, then "D:20240102030405Z".
          '/CreationDate <FEFF0044003A00320030003200340030003100300032003000330030003400300035005A>',
          // UTF-8: EF BB BF, then "D:20250607080910Z".
          '/ModDate <EFBBBF443A32303235303630373038303931305A>',
          '>>',
        ].join('\n'),
      ),
    );

    expect({
      title: doc.getTitle(),
      author: doc.getAuthor(),
      subject: doc.getSubject(),
      keywords: doc.getKeywords(),
      creator: doc.getCreator(),
      producer: doc.getProducer(),
      creationDate: doc.getCreationDate()?.toISOString(),
      modDate: doc.getModDate()?.toISOString(),
    }).toEqual({
      title: 'Café',
      author: 'Café',
      subject: '日本語 €',
      keywords: '日本語',
      creator: 'Ab',
      producer: 'é',
      creationDate: '2024-01-02T03:04:05.000Z',
      modDate: '2025-06-07T08:09:10.000Z',
    });
  });

  it('return the text of PDFDocEncoding strings', async () => {
    const doc = await loadPdf(
      pdfWithInfo(
        [
          '<<',
          // 0xE9 is "é" and 0x80 is "•" (U+2022) in PDFDocEncoding.
          '/Title (R\xE9sum\xE9 \x80 list)',
          '/Author <52E973756DE9>',
          '/CreationDate (D:20240102030405Z)',
          '>>',
        ].join('\n'),
      ),
    );

    expect({
      title: doc.getTitle(),
      author: doc.getAuthor(),
      creationDate: doc.getCreationDate()?.toISOString(),
    }).toEqual({
      title: 'Résumé • list',
      author: 'Résumé',
      creationDate: '2024-01-02T03:04:05.000Z',
    });
  });
});
