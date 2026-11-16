/**
 * The text-string codec against pdf.js and qpdf (ISO 32000-2 7.9.2.2 and Annex D).
 *
 * A PDF is built here by hand, with no library writer: its /Info dictionary holds 40 strings,
 * T01 to T40, covering each PDFDocEncoding byte class (together every byte 0x00 to 0xFF), UTF-16BE
 * with surrogate pairs and language escapes, UTF-16LE, UTF-8 with its byte order mark, and the
 * ill-formed cases. For each string `decodeTextString` of its bytes equals the text pdf.js 6.5
 * reports (`getMetadata().info.Custom`) and the "u:" value of qpdf 12 `--json=2`; where qpdf
 * reports "b:" (bytes it does not read as text) the bytes equal the string's bytes. The cases
 * where a reader differs are listed in DISAGREEMENTS with the reader's exact text and one reason
 * each. A second hand-built PDF holds the output of `encodeTextString`, and both readers read
 * back the text it was given. qpdf comes from `QPDF`, then `PATH`; the qpdf tests skip with a
 * reason where qpdf is absent locally and fail when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestContext } from 'vitest';
import {
  decodeTextString,
  encodeTextString,
  PDF_DOC_ENCODING,
  textStringEncoding,
} from '../../src/core/internal/textString.js';
import type { TextStringWriteEncoding } from '../../src/core/internal/textString.js';
import { withPdfjs } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, QPDF_BIN, requireQpdf } from '../helpers/oracle/qpdf.js';

/** One /Info string: its key, what it covers, and its bytes as written (hex form unless `literal`). */
interface Entry {
  readonly key: string;
  readonly about: string;
  readonly bytes: Uint8Array;
  /** The literal-form syntax of the string, when it is written that way. */
  readonly literal?: string;
}

const fromHex = (digits: string): Uint8Array => Uint8Array.fromHex(digits.replaceAll(' ', ''));
const run = (first: number, last: number): number[] =>
  Array.from({ length: last - first + 1 }, (_, i) => first + i);
/** The UTF-16BE code units of `text` as hex digits, without a byte order mark. */
const utf16be = (text: string): string =>
  Array.from({ length: text.length }, (_, i) =>
    text.charCodeAt(i).toString(16).padStart(4, '0'),
  ).join('');

/** The 40 strings: key, what it covers, its bytes as hex digits, or its literal-form syntax. */
const RAW_TITLES: readonly (readonly [
  key: string,
  about: string,
  digits: string,
  literal?: string,
])[] = [
  ['T01', 'PDFDocEncoding: empty', ''],
  ['T02', 'PDFDocEncoding: TAB, LF, CR (0x09, 0x0A, 0x0D)', '6109620A630D64'],
  ['T03', 'PDFDocEncoding: diacritics 0x18-0x1A, 0x1C-0x1F', '18191A1C1D1E1F'],
  ['T04', 'PDFDocEncoding: 0x1B opens a language escape', '611B62'],
  ['T05', 'PDFDocEncoding: ASCII 0x20-0x7E', Uint8Array.from(run(0x20, 0x7e)).toHex()],
  ['T06', 'PDFDocEncoding: literal form with escapes', '', String.raw`(Plain \(ASCII\) \\ 1)`],
  ['T07', 'PDFDocEncoding: typographic marks 0x80-0x8F', Uint8Array.from(run(0x80, 0x8f)).toHex()],
  ['T08', 'PDFDocEncoding: typographic marks 0x90-0x9E', Uint8Array.from(run(0x90, 0x9e)).toHex()],
  ['T09', 'PDFDocEncoding: Euro 0xA0', 'A03130'],
  [
    'T10',
    'PDFDocEncoding: Latin-1 0xA1-0xAC, 0xAE-0xBF',
    Uint8Array.from([...run(0xa1, 0xac), ...run(0xae, 0xbf)]).toHex(),
  ],
  ['T11', 'PDFDocEncoding: Latin-1 0xC0-0xDF', Uint8Array.from(run(0xc0, 0xdf)).toHex()],
  ['T12', 'PDFDocEncoding: Latin-1 0xE0-0xFF', Uint8Array.from(run(0xe0, 0xff)).toHex()],
  ['T13', 'PDFDocEncoding: undefined 0x7F', '617F62'],
  ['T14', 'PDFDocEncoding: undefined 0x9F', '619F62'],
  ['T15', 'PDFDocEncoding: undefined 0xAD', '61AD62'],
  [
    'T16',
    'PDFDocEncoding: undefined C0 controls',
    Uint8Array.from([...run(0x00, 0x08), 0x0b, 0x0c, ...run(0x0e, 0x17)]).toHex(),
  ],
  ['T17', 'PDFDocEncoding: Café', '436166E9'],
  ['T18', 'PDFDocEncoding: FE alone', 'FE'],
  ['T19', 'PDFDocEncoding: FE then not FF', 'FE41'],
  ['T20', 'PDFDocEncoding: EF BB without BF', 'EFBB41'],
  ['T21', 'PDFDocEncoding: FF then not FE', 'FF41'],
  ['T22', 'UTF-16BE: Café', `FEFF${utf16be('Café')}`],
  ['T23', 'UTF-16BE: CJK and Euro', `FEFF${utf16be('日本語 €')}`],
  ['T24', 'UTF-16BE: surrogate pair', `FEFF${utf16be('😀 astral')}`],
  ['T25', 'UTF-16BE: language escape', 'FEFF 001B 656E 001B 0043 0061 0066 00E9'],
  ['T26', 'UTF-16BE: language and country escape', 'FEFF 001B 656E 5553 001B 0048 0069'],
  ['T27', 'UTF-16BE: unclosed language escape', 'FEFF 0041 001B 656E'],
  ['T28', 'UTF-16BE: odd length', 'FEFF 0043 00'],
  ['T29', 'UTF-16BE: byte order mark only', 'FEFF'],
  ['T30', 'UTF-16BE: second byte order mark', 'FEFF FEFF 0041'],
  ['T31', 'UTF-16BE ill-formed: lone high surrogate', 'FEFF D83D 0041'],
  ['T32', 'UTF-16BE ill-formed: lone low surrogate', 'FEFF DE00 0041'],
  ['T33', 'UTF-16BE ill-formed: low then high surrogate', 'FEFF DE00 D83D'],
  ['T34', 'UTF-16LE: odd length', 'FFFE 4300 6100 62'],
  ['T35', 'UTF-16LE: surrogate pair', 'FFFE 3DD8 00DE'],
  ['T36', 'UTF-8: text', `EFBBBF${new TextEncoder().encode('Café – 日本 😀').toHex()}`],
  ['T37', 'UTF-8: byte order mark only', 'EFBBBF'],
  ['T38', 'UTF-8: language escape', 'EFBBBF 1B 656E 1B 41'],
  ['T39', 'UTF-8 ill-formed: truncated sequence', 'EFBBBF 41 C3'],
  ['T40', 'UTF-8 ill-formed: encoded surrogate', 'EFBBBF EDA080 41'],
];

/** T06 is the only literal-form string; these are the bytes its syntax stands for. */
const T06_BYTES = Uint8Array.from('Plain (ASCII) \\ 1', (c) => c.charCodeAt(0));

const TITLES: readonly Entry[] = RAW_TITLES.map(([key, about, digits, literal]) =>
  literal === undefined
    ? { key, about, bytes: fromHex(digits) }
    : { key, about, literal, bytes: T06_BYTES },
);

/** The reasons, shared by several rows. */
const PDFJS_FALLBACK =
  'ill-formed after a byte order mark: ours decodes the sequence to U+FFFD and keeps the encoding the mark names; pdf.js decodes the whole string, mark included, as PDFDocEncoding';
const QPDF_ESCAPE = 'qpdf keeps the language escape in its text; ours removes it (7.9.2.2)';
const QPDF_SURROGATE = 'qpdf drops or misreads a lone surrogate; ours decodes each to U+FFFD';

/** Where a reader's text differs from decodeTextString: key, reader, the reader's text, reason. */
const DISAGREEMENTS: readonly {
  readonly key: string;
  readonly reader: 'pdf.js' | 'qpdf';
  readonly theirs: string;
  readonly reason: string;
}[] = [
  { key: 'T25', reader: 'qpdf', theirs: '\u001b\u656e\u001bCafé', reason: QPDF_ESCAPE },
  { key: 'T26', reader: 'qpdf', theirs: '\u001b\u656e\u5553\u001bHi', reason: QPDF_ESCAPE },
  { key: 'T27', reader: 'qpdf', theirs: 'A\u001b\u656e', reason: QPDF_ESCAPE },
  { key: 'T31', reader: 'pdf.js', theirs: 'þÿØ=\u0000A', reason: PDFJS_FALLBACK },
  { key: 'T31', reader: 'qpdf', theirs: 'A', reason: QPDF_SURROGATE },
  { key: 'T32', reader: 'pdf.js', theirs: 'þÿÞ\u0000\u0000A', reason: PDFJS_FALLBACK },
  { key: 'T32', reader: 'qpdf', theirs: '\u0200A', reason: QPDF_SURROGATE },
  { key: 'T33', reader: 'pdf.js', theirs: 'þÿÞ\u0000Ø=', reason: PDFJS_FALLBACK },
  { key: 'T33', reader: 'qpdf', theirs: 'Ȁ', reason: QPDF_SURROGATE },
  { key: 'T38', reader: 'qpdf', theirs: '\u001ben\u001bA', reason: QPDF_ESCAPE },
  { key: 'T39', reader: 'pdf.js', theirs: 'ï»¿AÃ', reason: PDFJS_FALLBACK },
  { key: 'T40', reader: 'pdf.js', theirs: 'ï»¿í€•A', reason: PDFJS_FALLBACK },
];

/** A one-page PDF whose /Info holds `entries`, built byte by byte; the /Info object is 4. */
function handBuilt(entries: readonly Entry[]): Uint8Array {
  const info = entries
    .map((e) => `/${e.key} ${e.literal ?? `<${e.bytes.toHex().toUpperCase()}>`}`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>',
    `<<\n${info}\n>>`,
  ];
  let pdf = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}

/** pdf.js's text of every /Info key (custom keys, so all of them land in `info.Custom`). */
async function pdfjsInfo(pdf: Uint8Array): Promise<ReadonlyMap<string, unknown>> {
  return withPdfjs(pdf, async (doc) => {
    const { info } = (await doc.getMetadata()) as { info: { Custom?: Map<string, unknown> } };
    return info.Custom ?? new Map();
  });
}

/** qpdf `--json=2` of the /Info object: each key (without "/") to its "u:" or "b:" value. */
function qpdfInfo(ctx: TestContext, pdf: Uint8Array): ReadonlyMap<string, string> {
  requireQpdf(ctx);
  expectQpdfClean(pdf);
  const dir = mkdtempSync(join(tmpdir(), 'oracle-text-string-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, pdf);
    const result = spawnSync(QPDF_BIN, ['--json=2', '--json-object=4', input], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const json = JSON.parse(result.stdout) as {
      qpdf: [unknown, Record<string, { value: Record<string, string> }>];
    };
    const value = json.qpdf[1]['obj:4 0 R']?.value ?? {};
    return new Map(Object.entries(value).map(([k, v]) => [k.slice(1), v]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The text a reader is expected to report for `key`: the stated disagreement, else ours. */
function expected(key: string, reader: 'pdf.js' | 'qpdf', ours: string): string {
  return DISAGREEMENTS.find((d) => d.key === key && d.reader === reader)?.theirs ?? ours;
}

const PDF = handBuilt(TITLES);

describe('decodeTextString against pdf.js and qpdf: 40 hand-built /Info strings', () => {
  test('the PDFDocEncoding strings hold every byte 0x00 to 0xFF', () => {
    const seen = new Set<number>();
    for (const { bytes } of TITLES)
      if (textStringEncoding(bytes) === 'pdfdoc') for (const b of bytes) seen.add(b);
    expect(seen.size).toBe(256);
    expect(TITLES).toHaveLength(40);
  });

  test('every stated disagreement names a string and differs from ours', () => {
    for (const d of DISAGREEMENTS) {
      const title = TITLES.find((t) => t.key === d.key);
      expect(title, d.key).toBeDefined();
      expect(d.theirs, `${d.key} ${d.reader}`).not.toBe(
        decodeTextString(title?.bytes ?? new Uint8Array()),
      );
      expect(d.reason).not.toBe('');
    }
  });

  test('pdf.js reads each string as decodeTextString does, but for the stated disagreements', async () => {
    const info = await pdfjsInfo(PDF);
    const got = TITLES.map(({ key }) => [key, info.get(key)]);
    const want = TITLES.map(({ key, bytes }) => [
      key,
      expected(key, 'pdf.js', decodeTextString(bytes)),
    ]);
    expect(got).toEqual(want);
  });

  test('qpdf "u:" text equals decodeTextString, but for the stated disagreements; "b:" is the bytes', (ctx) => {
    const info = qpdfInfo(ctx, PDF);
    const got = TITLES.map(({ key }) => [key, info.get(key)]);
    const want = TITLES.map(({ key, bytes }) => {
      const value = info.get(key) ?? '';
      return [
        key,
        value.startsWith('b:')
          ? `b:${bytes.toHex()}`
          : `u:${expected(key, 'qpdf', decodeTextString(bytes))}`,
      ];
    });
    expect(got).toEqual(want);
    // qpdf reads every UTF-16 and UTF-8 string as text, so each of those is compared as text.
    for (const { key, bytes } of TITLES)
      if (textStringEncoding(bytes) !== 'pdfdoc') expect(info.get(key), key).toMatch(/^u:/);
  });
});

/**
 * Texts for the encoder leg, with the encoding asked for. E01 is every character "auto" writes in
 * PDFDocEncoding: Table D.2 but dotaccent, which "auto" writes in UTF-16BE (E12).
 */
const ANNEX_D = PDF_DOC_ENCODING.filter((u): u is number => u !== undefined && u !== 0x02d9)
  .map((u) => String.fromCodePoint(u))
  .join('');
const WRITTEN: readonly (readonly [
  key: string,
  text: string,
  encoding: TextStringWriteEncoding,
])[] = [
  ['E01', ANNEX_D, 'auto'],
  ['E02', 'þÿab', 'auto'],
  ['E03', 'ÿþab', 'auto'],
  ['E04', 'ï»¿x', 'auto'],
  ['E05', '日本語 €', 'auto'],
  ['E06', '😀 astral', 'auto'],
  ['E07', 'a\u0001b', 'auto'],
  ['E08', 'Café – 日本 😀', 'utf-8'],
  ['E09', 'Café', 'utf-16be'],
  ['E10', 'Plain ASCII (1)', 'auto'],
  ['E11', '', 'auto'],
  ['E12', 'a\u02d9b', 'auto'],
];
const ENCODED = WRITTEN.map(([key, text, encoding]): Entry => ({
  key,
  about: text,
  bytes: encodeTextString(text, encoding),
}));
const ENCODED_PDF = handBuilt(ENCODED);

describe('encodeTextString output read back by pdf.js and qpdf', () => {
  test('E01 is written in PDFDocEncoding, E12 in UTF-16BE', () => {
    expect(textStringEncoding(ENCODED[0]?.bytes ?? new Uint8Array())).toBe('pdfdoc');
    expect(textStringEncoding(ENCODED[11]?.bytes ?? new Uint8Array())).toBe('utf-16be');
  });

  test('pdf.js reads the text given', async () => {
    const info = await pdfjsInfo(ENCODED_PDF);
    const got = WRITTEN.map(([key]) => [key, info.get(key)]);
    expect(got).toEqual(WRITTEN.map(([key, text]) => [key, text]));
  });

  test('qpdf "u:" text is the text given; "b:" is the bytes written', (ctx) => {
    const info = qpdfInfo(ctx, ENCODED_PDF);
    for (const [i, [key, text]] of WRITTEN.entries()) {
      const value = info.get(key) ?? '';
      expect(value, key).toBe(
        value.startsWith('b:') ? `b:${ENCODED[i]?.bytes.toHex()}` : `u:${text}`,
      );
    }
  });
});
