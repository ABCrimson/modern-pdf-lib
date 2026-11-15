/**
 * In-memory builder of the stream /Length matrix: one page whose content stream (object 4) is
 * `CONTENT` with a /Length that is right, wrong, missing, indirect or unusable, in a classic
 * cross-reference file and in a twin whose startxref is broken so the recovery scan runs.
 */

/** The content stream's data. */
export const CONTENT = 'BT /F1 24 Tf 72 700 Td (Hello Length) Tj ET';
export const CONTENT_BYTES: Uint8Array = latin1(CONTENT);
const L = CONTENT.length;

export function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

type Body = readonly [number, string];

/** A classic-xref PDF from object bodies in file order. */
function classic(objs: readonly Body[], brokenXref = false): Uint8Array {
  let s = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = new Map<number, number>();
  for (const [n, body] of objs) {
    offsets.set(n, s.length);
    s += `${n} 0 obj\n${body}\nendobj\n`;
  }
  const max = Math.max(...offsets.keys());
  const xrefAt = s.length;
  s += `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= max; i++) {
    const off = offsets.get(i);
    s +=
      off === undefined ? '0000000000 65535 f \n' : `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  s += `trailer\n<< /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${brokenXref ? 999999 : xrefAt}\n%%EOF\n`;
  return latin1(s);
}

const base = (contentObj: string, extra: readonly Body[] = []): Body[] => [
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
  [
    3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>',
  ],
  [4, contentObj],
  ...extra,
];

interface StreamOptions {
  data?: string;
  eol?: string;
  end?: string;
}

const stream = (
  lengthToken: string | number | null,
  { data = CONTENT, eol = '\n', end = 'endstream' }: StreamOptions = {},
): string =>
  `<< ${lengthToken === null ? '' : `/Length ${lengthToken}`} >>\nstream\n${data}${eol}${end}`;

/** The object lists of the 30 constructed cases (object 4 is the content stream). */
const CASES: Readonly<Record<string, Body[]>> = {
  correct: base(stream(L)),
  short5: base(stream(L - 5)),
  long5: base(stream(L + 5)),
  long30: base(stream(L + 30)),
  zero: base(stream(0)),
  negative: base(stream(-5)),
  missing: base(stream(null)),
  nonint: base(stream(L + 0.5)),
  huge: base(stream(1e12)),
  name: base(stream('/Foo')),
  eol_cr: base(stream(L, { eol: '\r' })),
  eol_crlf: base(stream(L, { eol: '\r\n' })),
  eol_none: base(stream(L, { eol: '' })),
  short5_crlf: base(stream(L - 5, { eol: '\r\n' })),
  long1_crlf: base(stream(L + 1, { eol: '\r\n' })),
  long2_crlf: base(stream(L + 2, { eol: '\r\n' })),
  trailing_ws_ok: base(stream(L + 2, { data: `${CONTENT}  ` })),
  bad_kw_correct_len: base(stream(L, { end: 'endstrem' })),
  bad_kw_long5: base(stream(L + 5, { end: 'endstrem' })),
  embedded_kw_ok: base(stream(L + 13, { data: `${CONTENT} %endstream\n` })),
  embedded_kw_short: base(stream(L - 5, { data: `${CONTENT} %endstream\n` })),
  ind_forward: base(stream('5 0 R'), [[5, String(L)]]),
  ind_forward_lowernum: base(stream('6 0 R'), [[6, String(L)]]),
  ind_backward: [[5, String(L)], ...base(stream('5 0 R'))],
  ind_unresolved: base(stream('99 0 R')),
  ind_loop: base(stream('5 0 R'), [
    [5, '6 0 R'],
    [6, '5 0 R'],
  ]),
  ind_self: base(stream('4 0 R')),
  ind_to_name: base(stream('5 0 R'), [[5, '/Foo']]),
  ind_forward_wrong: base(stream('5 0 R'), [[5, String(L - 5)]]),
  ind_negative: base(stream('5 0 R'), [[5, '-5']]),
};

/** What a case's object 4 data is: the content bytes, as the load must return them. */
export interface LengthCase {
  readonly name: string;
  /** Classic cross-reference table, valid startxref. */
  readonly bytes: Uint8Array;
  /** The same objects with a broken startxref, so the recovery scan runs. */
  readonly scanBytes: Uint8Array;
  /** True when /Length is usable and `endstream` follows it: no recovery, strict loads. */
  readonly trusted: boolean;
  /** The bytes of object 4's stream data a load must give. */
  readonly expected: Uint8Array;
}

/** Cases whose data a load takes by the trusted path (a usable /Length, `endstream` after it). */
const TRUSTED = new Set([
  'correct',
  'eol_cr',
  'eol_crlf',
  'eol_none',
  'long1_crlf',
  'long2_crlf',
  'trailing_ws_ok',
  'embedded_kw_ok',
  'ind_forward',
  'ind_forward_lowernum',
  'ind_backward',
]);

/** Object 4's data for each case: the content, except where the stream's data differs. */
function expectedFor(name: string): Uint8Array {
  switch (name) {
    case 'eol_crlf':
      return latin1(CONTENT);
    case 'long1_crlf':
      return latin1(`${CONTENT}\r`);
    case 'long2_crlf':
      return latin1(`${CONTENT}\r\n`);
    case 'trailing_ws_ok':
      return latin1(`${CONTENT}  `);
    case 'embedded_kw_ok':
      // /Length counts the comment, its line ending and the EOL before the real keyword.
      return latin1(`${CONTENT} %endstream\n\n`);
    case 'bad_kw_correct_len':
    case 'bad_kw_long5':
      // Recovery runs to endobj and trims one EOL: the data, its EOL, the misspelt keyword.
      return latin1(`${CONTENT}\nendstrem`);
    case 'embedded_kw_short':
      // Cut at the `endstream` inside the data; no EOL precedes it.
      return latin1(`${CONTENT} %`);
    default:
      return latin1(CONTENT);
  }
}

export const LENGTH_CASES: readonly LengthCase[] = Object.entries(CASES).map(([name, objs]) => ({
  name,
  bytes: classic(objs),
  scanBytes: classic(objs, true),
  trusted: TRUSTED.has(name),
  expected: expectedFor(name),
}));

/**
 * An xref-stream file whose content stream's /Length (`6 0 R`) lives in an object stream
 * (object 7, uncompressed, unfiltered).
 */
export function indirectLengthInObjectStream(): Uint8Array {
  let s = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = new Map<number, number>();
  const add = (n: number, body: string): void => {
    offsets.set(n, s.length);
    s += `${n} 0 obj\n${body}\nendobj\n`;
  };
  for (const [n, b] of base(stream('6 0 R')).slice(0, 4)) add(n, b);
  const objstm = `6 0 ${L}`;
  add(
    7,
    `<< /Type /ObjStm /N 1 /First 4 /Length ${objstm.length} >>\nstream\n${objstm}\nendstream`,
  );
  const xrefAt = s.length;
  const row = (t: number, a: number, b: number): number[] => [
    t,
    (a >> 24) & 255,
    (a >> 16) & 255,
    (a >> 8) & 255,
    a & 255,
    b,
  ];
  const rows: number[][] = [row(0, 0, 255)];
  for (let i = 1; i <= 8; i++) {
    if (i === 6) rows.push(row(2, 7, 0));
    else if (i === 8) rows.push(row(1, xrefAt, 0));
    else rows.push(row(1, offsets.get(i) ?? 0, 0));
  }
  const bin = Uint8Array.from(rows.flat());
  const head = `8 0 obj\n<< /Type /XRef /Size 9 /W [1 4 1] /Root 1 0 R /Length ${bin.length} >>\nstream\n`;
  const tail = `\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Uint8Array.from([...latin1(s + head), ...bin, ...latin1(tail)]);
}

/**
 * A one-page classic-xref PDF whose content stream is object 4, written as `contentObject`
 * (a dictionary, `stream` and `endstream`), with `extra` objects appended in file order.
 */
export function contentPdf(contentObject: string, extra: readonly Body[] = []): Uint8Array {
  return classic(base(contentObject, extra));
}
