/**
 * Image streams in formats this release does not decode are still copied byte for byte.
 *
 * A /JPXDecode or /JBIG2Decode image stream is never decoded by load, save, merge or page copy, so a
 * document that holds one is loaded and saved, merged or copied with the stream unchanged. For each filter the test builds a PDF
 * whose image XObject carries raw stream bytes chosen here (not valid image data: nothing reads
 * them), loads it with the library, saves it, and asks qpdf for the raw stream bytes of that
 * object and for its dictionary entries: the bytes, /Filter and /DecodeParms are those of the
 * input, and `qpdf --check` passes on the output of save and merge. qpdf comes from `QPDF`, then `PATH`; each test
 * skips with a reason where qpdf is absent locally and fails when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, loadPdf, mergePdfs } from '../../src/index.js';
import { QPDF_BIN, expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/** 600 bytes that include every byte value, so no text or marker parser can mistake them for syntax. */
function rawBytes(seed: number): Uint8Array {
  const bytes = new Uint8Array(600);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + seed * 101 + (i >> 3)) & 0xff;
  return bytes;
}

/** A one-page PDF (classic cross-reference table) whose image XObject is object 5. */
function pdfWithImage(imageDictEntries: string, stream: Uint8Array): Uint8Array {
  const pieces: Uint8Array[] = [latin1('%PDF-1.7\n')];
  const offsets: number[] = [];
  let pos = pieces[0]!.length;
  const add = (piece: Uint8Array): void => {
    pieces.push(piece);
    pos += piece.length;
  };
  const object = (text: string): void => {
    offsets.push(pos);
    add(latin1(text));
  };
  object('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  object('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  object(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] ' +
      '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
  );
  const content = 'q 100 0 0 100 50 50 cm /Im0 Do Q';
  object(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  offsets.push(pos);
  add(
    latin1(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width 16 /Height 16 ${imageDictEntries} /Length ${stream.length} >>\nstream\n`,
    ),
  );
  add(stream);
  add(latin1('\nendstream\nendobj\n'));
  const xref = pos;
  let table = 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets) table += `${String(offset).padStart(10, '0')} 00000 n \n`;
  add(latin1(`${table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const piece of pieces) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

interface QpdfObject {
  readonly stream?: { readonly dict: Record<string, unknown> };
}

/** The raw (still encoded) bytes and dictionary of the one image stream qpdf finds in `pdf`. */
function qpdfImageStream(
  pdf: Uint8Array,
  filter: string,
): { readonly raw: Uint8Array; readonly dict: Record<string, unknown> } {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-unsupported-filter-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, pdf);
    const json = spawnSync(QPDF_BIN, ['--json=2', '--json-key=qpdf', input], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (json.status !== 0) throw new Error(`qpdf --json exit ${json.status}: ${json.stderr}`);
    const objects = (JSON.parse(json.stdout) as { qpdf: [unknown, Record<string, QpdfObject>] })
      .qpdf[1];
    const found = Object.entries(objects).filter(
      ([, value]) => value.stream?.dict['/Filter'] === `/${filter}`,
    );
    expect(found.map(([key]) => key)).toHaveLength(1);
    const [key, value] = found[0]!;
    const number = /^obj:(\d+) /.exec(key)![1]!;
    const raw = spawnSync(QPDF_BIN, [`--show-object=${number}`, '--raw-stream-data', input], {
      maxBuffer: 64 * 1024 * 1024,
    });
    if (raw.status !== 0) throw new Error(`qpdf --raw-stream-data exit ${raw.status}`);
    return { raw: new Uint8Array(raw.stdout), dict: value.stream!.dict };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('image streams in formats that are not decoded are copied unchanged', () => {
  test('save keeps JPXDecode image streams byte for byte', async () => {
    const stream = rawBytes(1);
    const input = pdfWithImage(
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /JPXDecode',
      stream,
    );
    const doc = await loadPdf(input);
    const saved = await doc.save();
    expectQpdfClean(saved);

    const out = qpdfImageStream(saved, 'JPXDecode');
    expect(out.dict['/Filter']).toBe('/JPXDecode');
    expect(Array.from(out.raw)).toEqual(Array.from(stream));
  });

  test('save keeps JBIG2Decode image streams byte for byte', async () => {
    const stream = rawBytes(2);
    const input = pdfWithImage(
      '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /JBIG2Decode /DecodeParms << /Dummy 0 >>',
      stream,
    );
    const doc = await loadPdf(input);
    const saved = await doc.save();
    expectQpdfClean(saved);

    const out = qpdfImageStream(saved, 'JBIG2Decode');
    expect(out.dict['/Filter']).toBe('/JBIG2Decode');
    expect(out.dict['/DecodeParms']).toEqual({ '/Dummy': 0 });
    expect(Array.from(out.raw)).toEqual(Array.from(stream));
  });

  test('a second save of the saved file keeps the stream byte for byte', async () => {
    const stream = rawBytes(3);
    const input = pdfWithImage(
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /JPXDecode',
      stream,
    );
    const once = await (await loadPdf(input)).save();
    expectQpdfClean(once);
    const twice = await (await loadPdf(once)).save();
    expectQpdfClean(twice);
    expect(Array.from(qpdfImageStream(twice, 'JPXDecode').raw)).toEqual(Array.from(stream));
  });

  test('mergePdfs keeps JPXDecode image streams byte for byte', async () => {
    const stream = rawBytes(4);
    const input = pdfWithImage(
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /JPXDecode',
      stream,
    );
    const merged = await mergePdfs([await loadPdf(input)]);
    const out = await merged.save();
    expectQpdfClean(out);

    const image = qpdfImageStream(out, 'JPXDecode');
    expect(image.dict['/Filter']).toBe('/JPXDecode');
    expect(Array.from(image.raw)).toEqual(Array.from(stream));
  });

  test('copyPages keeps JBIG2Decode image streams byte for byte', async () => {
    const stream = rawBytes(5);
    const input = pdfWithImage(
      '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /JBIG2Decode /DecodeParms << /Dummy 0 >>',
      stream,
    );
    const target = createPdf();
    await target.copyPages(await loadPdf(input), [0]);
    const out = await target.save();
    expectQpdfClean(out);

    const image = qpdfImageStream(out, 'JBIG2Decode');
    expect(image.dict['/Filter']).toBe('/JBIG2Decode');
    expect(image.dict['/DecodeParms']).toEqual({ '/Dummy': 0 });
    expect(Array.from(image.raw)).toEqual(Array.from(stream));
  });
});
