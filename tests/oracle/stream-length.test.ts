/**
 * Stream /Length framing against qpdf 12.4.2 and pdf.js on the constructed /Length matrix (one
 * page, content stream = object 4, in a classic-xref file and in a twin whose startxref is broken
 * so the recovery scan runs). Where /Length is usable and endstream follows it, the library's
 * data for object 4 equals qpdf's raw stream data exactly. Where it is not, qpdf keeps the EOL
 * before endstream in the recovered data and the library trims one, so the library's data equals
 * qpdf's minus at most one trailing EOL. pdf.js reads the page text of the same files, except
 * where no endstream keyword exists at all (it throws; the library recovers up to endobj).
 * qpdf comes from `QPDF`, then `PATH`; each test skips with a reason where qpdf is absent locally
 * and fails when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PdfRef, PdfStream } from '../../src/core/pdfObjects.js';
import { extractText, loadPdf, parseContentStream } from '../../src/index.js';
import { pdfjsText } from '../helpers/oracle/pdfjs.js';
import { QPDF_BIN, requireQpdf } from '../helpers/oracle/qpdf.js';
import { LENGTH_CASES } from '../helpers/streamLengthFixtures.js';
import type { LengthCase } from '../helpers/streamLengthFixtures.js';

/** qpdf's raw stream data of object `objNum` (`--show-object --raw-stream-data`). */
function qpdfRawStream(bytes: Uint8Array, objNum: number): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'mpl-stream-length-'));
  try {
    const file = join(dir, 'in.pdf');
    writeFileSync(file, bytes);
    const result = spawnSync(QPDF_BIN, [`--show-object=${objNum}`, '--raw-stream-data', file], {
      maxBuffer: 64 * 1024 * 1024,
    });
    // Exit 3 is "warnings": qpdf warns whenever it has to recover a stream length.
    if (result.status !== 0 && result.status !== 3) {
      throw new Error(`qpdf exited ${result.status}: ${result.stderr.toString('latin1')}`);
    }
    return new Uint8Array(result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `bytes` without one trailing EOL (CRLF, LF or CR). */
function withoutOneEol(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  if (end > 0 && bytes[end - 1] === 0x0a) {
    end--;
    if (end > 0 && bytes[end - 1] === 0x0d) end--;
  } else if (end > 0 && bytes[end - 1] === 0x0d) {
    end--;
  }
  return bytes.subarray(0, end);
}

async function libraryStream(bytes: Uint8Array): Promise<{ data: Uint8Array; text: string }> {
  const doc = await loadPdf(bytes);
  const page = doc.getPage(0);
  const object = page.getRegistry().resolve(PdfRef.of(4, 0));
  if (!(object instanceof PdfStream)) throw new Error('object 4 is not a stream');
  return {
    data: object.data,
    text: extractText(parseContentStream(page.getContentStream()), page.getOriginalResources())
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

const NO_ENDSTREAM = new Set(['bad_kw_correct_len', 'bad_kw_long5']);

describe.each([
  ['classic xref', (c: LengthCase) => c.bytes],
  ['recovery scan', (c: LengthCase) => c.scanBytes],
])('stream /Length matrix, %s', (_label, pick) => {
  it.for(LENGTH_CASES.map((c) => [c.name, c] as const))('%s', async ([, c], ctx) => {
    requireQpdf(ctx);
    const bytes = pick(c);
    const qpdf = qpdfRawStream(bytes, 4);
    const { data, text } = await libraryStream(bytes);

    if (c.trusted) {
      expect(data).toEqual(qpdf);
    } else {
      // The EOL qpdf keeps before endstream is not data: one is trimmed here. The remaining
      // difference is at most that one EOL.
      expect(data).toEqual(withoutOneEol(qpdf));
    }
    expect(data).toEqual(c.expected);

    if (NO_ENDSTREAM.has(c.name)) {
      // pdf.js throws "Missing endstream command."; the library recovers up to endobj.
      await expect(pdfjsText(bytes)).rejects.toThrow();
    } else {
      // pdf.js reads the page text; the library reads the same text unless the data itself
      // was cut at a keyword inside it (embedded_kw_short), where both still show the text.
      expect(await pdfjsText(bytes)).toEqual(['Hello Length']);
      expect(text).toBe('Hello Length');
    }
  });
});
