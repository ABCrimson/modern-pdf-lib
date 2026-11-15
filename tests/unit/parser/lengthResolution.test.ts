/**
 * An indirect stream /Length that cannot be resolved costs one attempt per load.
 *
 * Many streams may name the same /Length object. When that object does not parse (here a
 * dictionary that is never closed), the first stream that names it tries it and fails; the
 * failure is remembered for the rest of the load, so the other streams are framed without
 * parsing the broken object again. Without that memory the load parses the broken object once
 * per stream, and its cost grows with the number of streams times the object's size.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfObjectParser } from '../../../src/parser/internal/objectParser.js';
import { loadPdf } from '../../../src/index.js';
import { PdfRef } from '../../../src/core/pdfObjects.js';
import type { PdfStream } from '../../../src/core/pdfObjects.js';

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/**
 * Catalog 1, pages 2, page 3, the streams 10 to 10 + `streams` - 1 whose /Length is the
 * reference `target 0 R`, and the object `target` = `<< ` followed by `/A 1 ` `size` times and
 * no `>>`. Returns the file and the byte offset of the broken object.
 */
function sharedBrokenLength(streams: number, size: number): { bytes: Uint8Array; at: number } {
  const target = 10 + streams;
  const bodies = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'],
  ]);
  for (let i = 0; i < streams; i++) {
    bodies.set(10 + i, `<< /Length ${target} 0 R >>\nstream\nabc\nendstream`);
  }
  bodies.set(target, `<< ${'/A 1 '.repeat(size)}`);
  let text = '%PDF-1.7\n';
  const offsets = new Map<number, number>();
  for (const [num, body] of bodies) {
    offsets.set(num, text.length);
    text += `${num} 0 obj\n${body}\nendobj\n`;
  }
  const xrefAt = text.length;
  text += `xref\n0 ${target + 1}\n0000000000 65535 f \n`;
  for (let num = 1; num <= target; num++) {
    const offset = offsets.get(num);
    text +=
      offset === undefined
        ? '0000000000 00000 f \n'
        : `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  text += `trailer\n<< /Size ${target + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return { bytes: latin1(text), at: offsets.get(target)! };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a failed /Length resolution is remembered for the load', () => {
  /** How often a load of `bytes` parses the object at byte offset `at`. */
  async function parsesAt(bytes: Uint8Array, at: number): Promise<number> {
    const parse = vi.spyOn(PdfObjectParser.prototype, 'parseIndirectObjectAt');
    await loadPdf(bytes);
    const count = parse.mock.calls.filter(([offset]) => offset === at).length;
    parse.mockRestore();
    return count;
  }

  it('streams that share one unresolvable /Length try its target once as a /Length, as one stream does', async () => {
    const streams = 40;
    const { bytes, at } = sharedBrokenLength(streams, 2000);
    const one = sharedBrokenLength(1, 2000);
    // The load parses the broken object once as a /Length and once as an object of the
    // document, however many streams name it.
    const attempts = await parsesAt(bytes, at);
    expect(attempts).toBe(await parsesAt(one.bytes, one.at));
    expect(attempts).toBeLessThanOrEqual(2);
    const doc = await loadPdf(bytes);
    // Every stream is still framed, by its endstream.
    for (let i = 0; i < streams; i++) {
      const stream = doc.getRegistry().resolve(PdfRef.of(10 + i, 0)) as PdfStream;
      expect(String.fromCharCode(...stream.data), `object ${10 + i}`).toBe('abc');
    }
  });
});
