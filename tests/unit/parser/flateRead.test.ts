/**
 * Reading `/FlateDecode` cross-reference streams and object streams.
 *
 * ISO 32000 defines `/FlateDecode` data as zlib (RFC 1950). Every other producer writes it that
 * way; modern-pdf-lib 0.40.6 and earlier wrote raw DEFLATE (RFC 1951) without the wrapper. Both
 * must load through the cross-reference stream, with no recovery scan, also when the load is
 * strict (`throwOnInvalidObject: true`).
 *
 * - tests/fixtures/flate/qpdf-objstm.pdf and qpdf-linearized-objstm.pdf were written by qpdf
 *   (see the README there) from the content of
 *   tests/fixtures/legacy-0.40.3/raw-deflate-objstm.pdf, which modern-pdf-lib 0.40.3 wrote with
 *   raw DEFLATE throughout. The three files hold the same two pages.
 * - The built files below compress their streams with node:zlib (`deflateSync` for zlib,
 *   `deflateRawSync` for raw DEFLATE), so the expected decoding does not come from this library.
 * - With any other filter on a cross-reference stream or an object stream, a load gives the same
 *   result as 0.40.6 for the same bytes.
 */
import { readFileSync } from 'node:fs';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { extractText, loadPdf, parseContentStream } from '../../../src/index.js';
import type { PdfDocument } from '../../../src/index.js';
import { XrefParser } from '../../../src/parser/internal/xrefParser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixture = (path: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/${path}`, import.meta.url)));

/** Count the recovery scans a load makes (the method is private; the cast reaches it). */
function spyOnScan(): MockInstance {
  return vi.spyOn(
    XrefParser.prototype as unknown as { rebuildXrefFromScan(): unknown },
    'rebuildXrefFromScan',
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

interface Loaded {
  readonly doc: PdfDocument;
  readonly scans: number;
}

/** Load twice: once counting recovery scans, once strict. */
async function loadBoth(bytes: Uint8Array): Promise<Loaded> {
  const scan = spyOnScan();
  const doc = await loadPdf(bytes);
  const scans = scan.mock.calls.length;
  scan.mockRestore();
  await loadPdf(bytes, { throwOnInvalidObject: true });
  return { doc, scans };
}

const pageText = (doc: PdfDocument, index: number): string =>
  extractText(parseContentStream(doc.getPage(index).getContentStream()));

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

type Encoding = 'zlib' | 'raw';

const encode = (data: Uint8Array, encoding: Encoding): Uint8Array =>
  new Uint8Array(encoding === 'zlib' ? deflateSync(data) : deflateRawSync(data));

/**
 * Apply the PNG Up predictor (PDF /Predictor 12) to rows of `columns` bytes: each output row is
 * the filter byte 2 followed by the difference from the row above.
 */
function pngUp(data: Uint8Array, columns: number): Uint8Array {
  const rows = data.length / columns;
  const out = new Uint8Array(rows * (columns + 1));
  for (let r = 0; r < rows; r++) {
    out[r * (columns + 1)] = 2;
    for (let c = 0; c < columns; c++) {
      const above = r > 0 ? (data[(r - 1) * columns + c] ?? 0) : 0;
      out[r * (columns + 1) + 1 + c] = ((data[r * columns + c] ?? 0) - above) & 0xff;
    }
  }
  return out;
}

interface BuildOptions {
  /** Encoding of every stream (object stream, content stream, cross-reference stream). */
  readonly encoding: Encoding;
  /** Write /Filter and /DecodeParms as one-element arrays instead of a name and a dictionary. */
  readonly arrays?: boolean;
  /** Apply the PNG Up predictor to the object stream as well. */
  readonly objStmPredictor?: boolean;
}

/** Text shown on the single page of a built file. */
const BUILT_TEXT = 'Flate read probe';

/**
 * Build a one-page PDF whose catalog, page tree and page live in an object stream (object 1),
 * with a content stream (object 5) and a cross-reference stream (object 6, /W [1 2 1],
 * PNG Up predictor, 4 columns).
 */
function buildPdf(options: BuildOptions): Uint8Array {
  const { encoding, arrays = false, objStmPredictor = false } = options;
  const filter = arrays ? '[/FlateDecode]' : '/FlateDecode';
  const parms = (columns: number): string => {
    const dict = `<< /Predictor 12 /Columns ${columns} >>`;
    return arrays ? `[${dict}]` : dict;
  };

  const members = [
    '<< /Type /Catalog /Pages 3 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>',
  ];
  let body = '';
  const offsets: number[] = [];
  for (const m of members) {
    offsets.push(body.length);
    body += `${m}\n`;
  }
  const header = `2 ${offsets[0]} 3 ${offsets[1]} 4 ${offsets[2]}\n`;
  let objStmData = latin1(header + body);
  let objStmParms = '';
  if (objStmPredictor) {
    // Pad to whole 8-byte rows with spaces, which the object parser skips.
    const padded = new Uint8Array(Math.ceil(objStmData.length / 8) * 8).fill(0x20);
    padded.set(objStmData);
    objStmData = pngUp(padded, 8);
    objStmParms = ` /DecodeParms ${parms(8)}`;
  }
  const objStm = encode(objStmData, encoding);
  const content = encode(latin1(`BT /F1 12 Tf 72 700 Td (${BUILT_TEXT}) Tj ET\n`), encoding);

  const parts: Uint8Array[] = [];
  let pos = 0;
  const push = (p: Uint8Array): void => {
    parts.push(p);
    pos += p.length;
  };
  push(latin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'));
  const off1 = pos;
  push(
    latin1(
      `1 0 obj\n<< /Type /ObjStm /N 3 /First ${header.length} /Length ${objStm.length}` +
        ` /Filter ${filter}${objStmParms} >>\nstream\n`,
    ),
  );
  push(objStm);
  push(latin1('\nendstream\nendobj\n'));
  const off5 = pos;
  push(latin1(`5 0 obj\n<< /Length ${content.length} /Filter ${filter} >>\nstream\n`));
  push(content);
  push(latin1('\nendstream\nendobj\n'));
  const off6 = pos;

  const rows: [number, number, number][] = [
    [0, 0, 255],
    [1, off1, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 1, 2],
    [1, off5, 0],
    [1, off6, 0],
  ];
  const table = new Uint8Array(rows.length * 4);
  rows.forEach(([type, field2, field3], i) => {
    table[i * 4] = type;
    table[i * 4 + 1] = (field2 >> 8) & 0xff;
    table[i * 4 + 2] = field2 & 0xff;
    table[i * 4 + 3] = field3;
  });
  const xref = encode(pngUp(table, 4), encoding);
  push(
    latin1(
      `6 0 obj\n<< /Type /XRef /Size 7 /W [1 2 1] /Root 2 0 R /Length ${xref.length}` +
        ` /Filter ${filter} /DecodeParms ${parms(4)} >>\nstream\n`,
    ),
  );
  push(xref);
  push(latin1(`\nendstream\nendobj\nstartxref\n${off6}\n%%EOF\n`));
  return concat(parts);
}

// ---------------------------------------------------------------------------
// Files written by qpdf, and the same content as modern-pdf-lib 0.40.3 wrote it
// ---------------------------------------------------------------------------

describe('cross-reference streams and object streams from files', () => {
  const sources: readonly (readonly [string, string])[] = [
    ['zlib, written by qpdf', 'flate/qpdf-objstm.pdf'],
    ['zlib, written by qpdf, linearized', 'flate/qpdf-linearized-objstm.pdf'],
    ['raw DEFLATE, written by modern-pdf-lib 0.40.3', 'legacy-0.40.3/raw-deflate-objstm.pdf'],
  ];

  it.each(sources)('%s: loads with no recovery scan and reads both pages', async (_, path) => {
    const { doc, scans } = await loadBoth(fixture(path));
    expect(scans).toBe(0);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('raw-deflate-objstm');
    expect(pageText(doc, 0)).toContain('ObjStm page one');
    expect(pageText(doc, 1)).toContain('ObjStm page two');
  });
});

// ---------------------------------------------------------------------------
// Built files
// ---------------------------------------------------------------------------

describe('cross-reference streams and object streams built with node:zlib', () => {
  const cases: readonly (readonly [string, BuildOptions])[] = [
    ['zlib', { encoding: 'zlib' }],
    ['raw DEFLATE (legacy data)', { encoding: 'raw' }],
    ['zlib, /Filter and /DecodeParms as arrays', { encoding: 'zlib', arrays: true }],
    ['zlib, object stream with the PNG Up predictor', { encoding: 'zlib', objStmPredictor: true }],
    [
      'zlib, arrays, object stream with the PNG Up predictor',
      { encoding: 'zlib', arrays: true, objStmPredictor: true },
    ],
    [
      'raw DEFLATE (legacy data), arrays, object stream with the PNG Up predictor',
      { encoding: 'raw', arrays: true, objStmPredictor: true },
    ],
  ];

  it.each(cases)('%s: loads with no recovery scan and reads the page', async (_, options) => {
    const { doc, scans } = await loadBoth(buildPdf(options));
    expect(scans).toBe(0);
    expect(doc.getPageCount()).toBe(1);
    expect(pageText(doc, 0)).toContain(BUILT_TEXT);
  });

  it('the built zlib streams carry the RFC 1950 header', () => {
    const bytes = buildPdf({ encoding: 'zlib' });
    const text = new TextDecoder('latin1').decode(bytes);
    const starts = [...text.matchAll(/\bstream\n/g)].map((m) => m.index + 7);
    expect(starts).toHaveLength(3);
    for (const at of starts) {
      expect([bytes[at], bytes[at + 1]]).toEqual([0x78, 0x9c]);
    }
  });
});

// ---------------------------------------------------------------------------
// Other filters on a cross-reference stream or an object stream
// ---------------------------------------------------------------------------

/** ASCIIHexDecode encoding: two hex digits per byte, then the `>` end marker. */
const hexEncode = (data: Uint8Array): Uint8Array =>
  latin1(`${Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('')}>`);

/**
 * LZWDecode encoding with literal codes only: every byte is one 9-bit code, a clear-table code
 * (256) starts the data and repeats every 200 bytes so the code width stays 9, and the
 * end-of-data code (257) ends it.
 */
function lzwEncode(data: Uint8Array): Uint8Array {
  const codes: number[] = [256];
  data.forEach((b, i) => {
    if (i > 0 && i % 200 === 0) codes.push(256);
    codes.push(b);
  });
  codes.push(257);
  const out = new Uint8Array(Math.ceil((codes.length * 9) / 8));
  let bit = 0;
  for (const code of codes) {
    for (let k = 8; k >= 0; k--) {
      if ((code >> k) & 1) out[bit >> 3] = (out[bit >> 3] ?? 0) | (0x80 >> (bit & 7));
      bit++;
    }
  }
  return out;
}

/**
 * RunLengthDecode encoding with literal runs only: each run of up to 128 bytes is preceded by its
 * length minus one, and the end-of-data byte (128) ends the data.
 */
function runLengthEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let at = 0; at < data.length; at += 128) {
    const run = data.subarray(at, at + 128);
    out.push(run.length - 1, ...run);
  }
  out.push(128);
  return Uint8Array.from(out);
}

/** How the object stream or the cross-reference stream of a filtered build is encoded. */
type StreamFilter =
  | 'flate'
  | 'hex-flate'
  | 'flate-hex'
  | 'flate-hex-zlib'
  | 'flate-rl-hex-zlib'
  | 'lzw'
  | 'dct'
  | 'ccitt'
  | 'fl';

/**
 * The /Filter (and /DecodeParms) entries and the data of one stream. With `columns`, the data
 * carries PNG Up rows of that width and /DecodeParms says so, except for the arrays that start
 * with /FlateDecode and the image filters. Every Flate encoding is raw DEFLATE, which 0.40.6 read,
 * except for the two `-zlib` kinds, whose Flate data is zlib. The image filters get stub data:
 * the plain bytes.
 */
function filtered(
  kind: StreamFilter,
  plain: Uint8Array,
  columns: number | undefined,
): { readonly dict: string; readonly data: Uint8Array } {
  const predicted = columns === undefined ? plain : pngUp(plain, columns);
  const parms =
    columns === undefined ? '' : ` /DecodeParms << /Predictor 12 /Columns ${columns} >>`;
  switch (kind) {
    case 'flate':
      return { dict: `/Filter /FlateDecode${parms}`, data: encode(predicted, 'raw') };
    case 'fl':
      return { dict: `/Filter /Fl${parms}`, data: encode(predicted, 'raw') };
    case 'hex-flate':
      return {
        dict:
          '/Filter [/ASCIIHexDecode /FlateDecode]' +
          (columns === undefined
            ? ''
            : ` /DecodeParms [null << /Predictor 12 /Columns ${columns} >>]`),
        data: hexEncode(encode(predicted, 'raw')),
      };
    case 'flate-hex':
      return {
        dict: '/Filter [/FlateDecode /ASCIIHexDecode]',
        data: encode(hexEncode(plain), 'raw'),
      };
    case 'flate-hex-zlib':
      return {
        dict: '/Filter [/FlateDecode /ASCIIHexDecode]',
        data: encode(hexEncode(plain), 'zlib'),
      };
    case 'flate-rl-hex-zlib':
      return {
        dict: '/Filter [/FlateDecode /RunLengthDecode /ASCIIHexDecode]',
        data: encode(runLengthEncode(hexEncode(plain)), 'zlib'),
      };
    case 'lzw':
      return { dict: `/Filter /LZWDecode${parms}`, data: lzwEncode(predicted) };
    case 'dct':
      return { dict: '/Filter /DCTDecode', data: plain };
    case 'ccitt':
      return { dict: '/Filter /CCITTFaxDecode', data: plain };
  }
}

/** True for the filters whose stub data is the plain bytes, without predictor rows. */
const isImageFilter = (kind: StreamFilter): boolean => kind === 'dct' || kind === 'ccitt';

/** True for the arrays of more than one filter that start with /FlateDecode. */
const isFlateFirstChain = (kind: StreamFilter): boolean =>
  kind === 'flate-hex' || kind === 'flate-hex-zlib' || kind === 'flate-rl-hex-zlib';

/**
 * Build the one-page file of {@link buildPdf} with raw DEFLATE content and the object stream and
 * cross-reference stream filtered as given (the cross-reference stream with PNG Up rows over 4
 * columns, unless {@link isImageFilter} or {@link isFlateFirstChain}). With `objStmFilter`
 * `undefined`, the catalog, page tree and page are objects 2 to 4 in the file body and object 1
 * is free.
 */
function buildFiltered(
  objStmFilter: StreamFilter | undefined,
  xrefFilter: StreamFilter,
): Uint8Array {
  const members = [
    '<< /Type /Catalog /Pages 3 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>',
  ];
  let body = '';
  const offsets: number[] = [];
  for (const m of members) {
    offsets.push(body.length);
    body += `${m}\n`;
  }
  const header = `2 ${offsets[0]} 3 ${offsets[1]} 4 ${offsets[2]}\n`;
  const content = encode(latin1(`BT /F1 12 Tf 72 700 Td (${BUILT_TEXT}) Tj ET\n`), 'raw');

  const parts: Uint8Array[] = [];
  let pos = 0;
  const push = (p: Uint8Array): void => {
    parts.push(p);
    pos += p.length;
  };
  push(latin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'));
  const memberRows: [number, number, number][] = [];
  if (objStmFilter === undefined) {
    memberRows.push([0, 0, 0]);
    members.forEach((m, i) => {
      memberRows.push([1, pos, 0]);
      push(latin1(`${i + 2} 0 obj\n${m}\nendobj\n`));
    });
  } else {
    const objStm = filtered(objStmFilter, latin1(header + body), undefined);
    memberRows.push([1, pos, 0], [2, 1, 0], [2, 1, 1], [2, 1, 2]);
    push(
      latin1(
        `1 0 obj\n<< /Type /ObjStm /N 3 /First ${header.length} /Length ${objStm.data.length}` +
          ` ${objStm.dict} >>\nstream\n`,
      ),
    );
    push(objStm.data);
    push(latin1('\nendstream\nendobj\n'));
  }
  const off5 = pos;
  push(latin1(`5 0 obj\n<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`));
  push(content);
  push(latin1('\nendstream\nendobj\n'));
  const off6 = pos;

  const rows: [number, number, number][] = [[0, 0, 255], ...memberRows, [1, off5, 0], [1, off6, 0]];
  const table = new Uint8Array(rows.length * 4);
  rows.forEach(([type, field2, field3], i) => {
    table[i * 4] = type;
    table[i * 4 + 1] = (field2 >> 8) & 0xff;
    table[i * 4 + 2] = field2 & 0xff;
    table[i * 4 + 3] = field3;
  });
  const columns = isImageFilter(xrefFilter) || isFlateFirstChain(xrefFilter) ? undefined : 4;
  const xref = filtered(xrefFilter, table, columns);
  push(
    latin1(
      `6 0 obj\n<< /Type /XRef /Size 7 /W [1 2 1] /Root 2 0 R /Length ${xref.data.length}` +
        ` ${xref.dict} >>\nstream\n`,
    ),
  );
  push(xref.data);
  push(latin1(`\nendstream\nendobj\nstartxref\n${off6}\n%%EOF\n`));
  return concat(parts);
}

/** What one load of a file gave: the page count, recovery scans and page text, or the error. */
type Outcome =
  | { readonly pages: number; readonly scans: number; readonly text: boolean }
  | { readonly rejects: string; readonly scans: number };

async function outcome(bytes: Uint8Array, strict: boolean): Promise<Outcome> {
  const scan = spyOnScan();
  try {
    const doc = await loadPdf(bytes, strict ? { throwOnInvalidObject: true } : undefined);
    return {
      pages: doc.getPageCount(),
      scans: scan.mock.calls.length,
      text: pageText(doc, 0).includes(BUILT_TEXT),
    };
  } catch (err) {
    const e = err as Error;
    return {
      rejects: `${e.name}: ${e.message.split('\n')[0] ?? ''}`,
      scans: scan.mock.calls.length,
    };
  } finally {
    scan.mockRestore();
  }
}

/** Loads with no recovery scan and reads the page. */
const LOADS: Outcome = { pages: 1, scans: 0, text: true };

/** The cross-reference stream is not read; the recovery scan finds the objects and the page. */
const LOADS_AFTER_SCAN: Outcome = { pages: 1, scans: 1, text: true };

/** The cross-reference stream is not read; the recovery scan cannot see the catalog. */
const SCAN_FINDS_NO_CATALOG: Outcome = {
  rejects:
    'PdfParseError: Invalid PDF: recovery scan could not locate the document catalog (/Root).' +
    ' The file appears to be severely corrupt.',
  scans: 1,
};

/** The object stream's data is not decoded to its objects, so the catalog is missing. */
const NO_CATALOG_OBJECT: Outcome = {
  rejects:
    'PdfParseError: Invalid PDF: /Root (catalog) at object 2 is not a dictionary (got null).',
  scans: 0,
};

/**
 * Cross-reference streams and object streams are read with no filter, or with `/FlateDecode`
 * (zlib or raw DEFLATE) and its predictor. With any other filter, a load gives what 0.40.6 gave
 * for the same bytes (measured by loading each built file with the 0.40.6 source): a
 * cross-reference stream is not read and the recovery scan takes over; an object stream's data
 * is used as stored. Only the first entry of a /Filter array is applied, and when the array has
 * more entries, its Flate data is read as raw DEFLATE only, as 0.40.6 read it.
 */
describe('cross-reference streams and object streams with other filters', () => {
  const xrefCases: readonly (readonly [string, StreamFilter, Outcome])[] = [
    ['/FlateDecode', 'flate', LOADS],
    ['[/ASCIIHexDecode /FlateDecode]', 'hex-flate', SCAN_FINDS_NO_CATALOG],
    ['[/FlateDecode /ASCIIHexDecode]', 'flate-hex', NO_CATALOG_OBJECT],
    ['/LZWDecode', 'lzw', SCAN_FINDS_NO_CATALOG],
    ['/DCTDecode with stub data', 'dct', SCAN_FINDS_NO_CATALOG],
    ['/CCITTFaxDecode with stub data', 'ccitt', SCAN_FINDS_NO_CATALOG],
    ['/Fl', 'fl', SCAN_FINDS_NO_CATALOG],
  ];

  it.each(xrefCases)('cross-reference stream with %s', async (_, kind, expected) => {
    const bytes = buildFiltered('flate', kind);
    expect(await outcome(bytes, false)).toEqual(expected);
    expect(await outcome(bytes, true)).toEqual(expected);
  });

  const xrefBodyCases: readonly (readonly [string, StreamFilter, Outcome])[] = [
    ['/FlateDecode then /ASCIIHexDecode, zlib data', 'flate-hex-zlib', LOADS_AFTER_SCAN],
    [
      '/FlateDecode then /RunLengthDecode then /ASCIIHexDecode, zlib data',
      'flate-rl-hex-zlib',
      LOADS_AFTER_SCAN,
    ],
  ];

  it.each(xrefBodyCases)(
    'cross-reference stream with %s, objects in the file body',
    async (_, kind, expected) => {
      const bytes = buildFiltered(undefined, kind);
      expect(await outcome(bytes, false)).toEqual(expected);
      expect(await outcome(bytes, true)).toEqual(expected);
    },
  );

  const objStmCases: readonly (readonly [string, StreamFilter, Outcome])[] = [
    ['/FlateDecode', 'flate', LOADS],
    ['[/ASCIIHexDecode /FlateDecode]', 'hex-flate', NO_CATALOG_OBJECT],
    ['[/FlateDecode /ASCIIHexDecode]', 'flate-hex', NO_CATALOG_OBJECT],
    ['/FlateDecode then /ASCIIHexDecode, zlib data', 'flate-hex-zlib', NO_CATALOG_OBJECT],
    ['/LZWDecode', 'lzw', NO_CATALOG_OBJECT],
    ['/DCTDecode with stub data', 'dct', LOADS],
    ['/CCITTFaxDecode with stub data', 'ccitt', LOADS],
    ['/Fl', 'fl', NO_CATALOG_OBJECT],
  ];

  it.each(objStmCases)('object stream with %s', async (_, kind, expected) => {
    const bytes = buildFiltered(kind, 'flate');
    expect(await outcome(bytes, false)).toEqual(expected);
    expect(await outcome(bytes, true)).toEqual(expected);
  });
});

/**
 * Write `/Predictor 16` in place of every `/Predictor 12` of a built file. PNG rows name their own
 * filter, so the same Up rows decode under any PNG predictor value; every other byte is kept.
 */
const withPredictor16 = (bytes: Uint8Array): Uint8Array =>
  latin1(String.fromCharCode(...bytes).replaceAll('/Predictor 12', '/Predictor 16'));

describe('cross-reference streams and object streams with /Predictor 16', () => {
  it('cross-reference stream with raw DEFLATE data, PNG Up rows and /Predictor 16 /Columns 4', async () => {
    const bytes = withPredictor16(buildFiltered('flate', 'flate'));
    expect(new TextDecoder('latin1').decode(bytes)).toContain(
      '/DecodeParms << /Predictor 16 /Columns 4 >>',
    );
    expect(await outcome(bytes, false)).toEqual(LOADS);
    expect(await outcome(bytes, true)).toEqual(LOADS);
  });

  it.each([
    ['as a name and a dictionary', false],
    ['as one-entry arrays', true],
  ])(
    'object stream with raw DEFLATE data and PNG Up rows, /Filter and /DecodeParms %s',
    async (_, arrays) => {
      const bytes = withPredictor16(buildPdf({ encoding: 'raw', arrays, objStmPredictor: true }));
      expect(new TextDecoder('latin1').decode(bytes)).toContain('/Predictor 16 /Columns 8');
      expect(await outcome(bytes, false)).toEqual(LOADS);
      expect(await outcome(bytes, true)).toEqual(LOADS);
    },
  );
});
