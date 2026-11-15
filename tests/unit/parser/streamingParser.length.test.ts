/**
 * StreamingPdfParser frames content streams with the same rule as the document parser: a /Length
 * is trusted only when endstream follows it, otherwise the data ends at the first endstream minus
 * one EOL. The streaming parser has no resolver, so an indirect /Length takes the search.
 */
import { describe, expect, it } from 'vitest';
import { StreamingPdfParser } from '../../../src/parser/streamingParser.js';
import { CONTENT, LENGTH_CASES, contentPdf, latin1 } from '../../helpers/stream-length-fixtures.js';

async function pageContent(bytes: Uint8Array): Promise<Uint8Array> {
  const parser = new StreamingPdfParser();
  parser.feed(bytes);
  parser.end();
  return parser.getPageContent(0);
}

describe('StreamingPdfParser: one content stream shared by several pages', () => {
  it('gives the declared bytes to every page, whatever the gap before endstream', async () => {
    const pages = 3;
    const gapped = `<< /Length ${CONTENT.length} >>\nstream\n${CONTENT}${' '.repeat(20_000)}\nendstream`;
    const kids = Array.from({ length: pages }, (_, i) => `${10 + i} 0 R`).join(' ');
    const objects: Array<[number, string]> = [
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`],
      [4, gapped],
      ...Array.from({ length: pages }, (_, i): [number, string] => [
        10 + i,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
      ]),
    ];
    let pdf = '%PDF-1.7\n';
    const offsets = new Map<number, number>();
    for (const [n, body] of objects) {
      offsets.set(n, pdf.length);
      pdf += `${n} 0 obj\n${body}\nendobj\n`;
    }
    const size = 10 + pages;
    const xrefAt = pdf.length;
    pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let n = 1; n < size; n++) {
      const at = offsets.get(n);
      pdf +=
        at === undefined ? '0000000000 65535 f \n' : `${String(at).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    const parser = new StreamingPdfParser();
    parser.feed(latin1(pdf));
    parser.end();
    for (let i = 0; i < pages; i++) {
      expect((await parser.getPageContent(i)).length, `page ${i}`).toBe(CONTENT.length);
    }
  });
});

describe('StreamingPdfParser: stream data framing', () => {
  it.each([
    'correct',
    'short5',
    'long5',
    'huge',
    'bad_kw_long5',
    'trailing_ws_ok',
    'zero',
    'missing',
  ])('%s gives the framed bytes of the document parser', async (name) => {
    const c = LENGTH_CASES.find((x) => x.name === name)!;
    expect(await pageContent(c.bytes)).toEqual(c.expected);
  });

  it('keeps trailing spaces of data behind an indirect /Length', async () => {
    const data = `${CONTENT}  `;
    const bytes = contentPdf(`<< /Length 5 0 R >>\nstream\n${data}\nendstream`, [
      [5, String(data.length)],
    ]);
    expect(await pageContent(bytes)).toEqual(latin1(data));
  });

  it('does not trust a /Length that endstream does not follow', async () => {
    const data = `${CONTENT}  `;
    const bytes = contentPdf(`<< /Length 8 >>\nstream\n${data}\nendstream`);
    expect(await pageContent(bytes)).toEqual(latin1(data));
  });
});
