/**
 * PDF strings and names as bytes (ISO 32000-2 7.3.4 and 7.3.5), read back by qpdf 12.
 *
 * qpdf `--json=2` writes a string as "u:" plus its text when it reads it as text, else as "b:"
 * plus its bytes in hex. It writes a name as "/" plus its bytes when they are valid UTF-8, else as
 * "n:" plus the name in canonical syntax (# escapes); either form gives the name's bytes back.
 * Every file a test saves passes `qpdf --check`, except the one test whose input holds a NUL in a
 * name, which qpdf itself warns about: its output draws exactly the warnings of its input.
 * qpdf comes from `QPDF`, then `PATH`; the tests skip with a reason where qpdf is absent locally
 * and fail when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, loadPdf, PdfArray, PdfName, PdfString } from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { markChecked } from '../helpers/oracle/outputs.js';
import { expectQpdfClean, QPDF_BIN, QpdfError, requireQpdf } from '../helpers/oracle/qpdf.js';

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
/** The bytes as a byte string, one code unit per byte, in chunks so a large file fits. */
const byteString = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return out;
};
const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/** A dictionary as qpdf `--json=2` writes it: each key (with its "/") to its value. */
type QpdfDict = Readonly<Record<string, unknown>>;

/** Runs qpdf with `args` on `pdf` written to a temporary `in.pdf` (named by `{in}`). */
function runQpdf(pdf: Uint8Array, args: readonly string[]): SpawnSyncReturns<string> {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-string-bytes-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, pdf);
    return spawnSync(
      QPDF_BIN,
      args.map((a) => (a === '{in}' ? input : a)),
      // The JSON of a file holding a 1,000,000-byte string is larger than the 1 MiB default.
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/**
 * A one-page PDF built byte by byte: `catalogEntries` go into the catalog, which also holds
 * /Extra 4 0 R, and object 4 is `extra`.
 */
function handBuilt(catalogEntries: string, extra = '<< >>'): Uint8Array {
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R /Extra 4 0 R ${catalogEntries} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>',
    extra,
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
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1(pdf);
}

/** A new one-page document whose catalog gets `entries` when it is saved. */
function docWithCatalog(entries: Readonly<Record<string, PdfString | PdfArray>>): PdfDocument {
  const doc = createPdf();
  doc.addPage();
  doc.use({
    name: 'string-bytes-catalog',
    onBuildCatalog(catalog) {
      for (const [key, value] of Object.entries(entries)) catalog.set(key, value);
    },
  });
  return doc;
}

/** Saves without compression, passes the bytes through `qpdf --check` and returns them. */
async function cleanSave(doc: PdfDocument): Promise<Uint8Array> {
  const bytes = await doc.save({ compress: false });
  expectQpdfClean(bytes);
  return bytes;
}

/** The catalog as qpdf `--json=2` reads it. */
function qpdfCatalog(bytes: Uint8Array): QpdfDict {
  const result = runQpdf(bytes, ['--json=2', '{in}']);
  if (result.status !== 0) {
    throw new QpdfError(`qpdf --json=2 exit ${result.status}: ${result.stderr}`);
  }
  const json = JSON.parse(result.stdout) as {
    qpdf: [unknown, Record<string, { value?: unknown }>];
  };
  const catalog = Object.values(json.qpdf[1])
    .map((entry) => entry.value)
    .find((v): v is QpdfDict => (v as QpdfDict | undefined)?.['/Type'] === '/Catalog');
  if (catalog === undefined) throw new Error('qpdf reports no catalog');
  return catalog;
}

/** The warnings `qpdf --check` prints for `pdf`, each without its file and position prefix. */
function qpdfCheckWarnings(pdf: Uint8Array): string[] {
  const result = runQpdf(pdf, ['--check', '{in}']);
  return `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter((l) => l.includes('WARNING') || l.includes('ERROR'))
    .map((l) => l.replace(/^.*\): /, ''));
}

/** The bytes of a name qpdf `--json=2` writes, without the "/". */
function qpdfNameBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string') throw new Error(`not a qpdf name: ${JSON.stringify(value)}`);
  if (value.startsWith('n:/')) {
    return latin1(
      value
        .slice(3)
        .replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        ),
    );
  }
  if (value.startsWith('/')) return new TextEncoder().encode(value.slice(1));
  throw new Error(`not a qpdf name: ${value}`);
}

describe('PDF strings as bytes', () => {
  test('strings of all 256 byte values, each factory and both forms, read back by qpdf as the same bytes', async () => {
    const doc = docWithCatalog({
      '/S1': PdfString.fromBytes(ALL_BYTES),
      '/S2': PdfString.fromBytes(ALL_BYTES, 'hex'),
      '/S3': PdfString.literal(byteString(ALL_BYTES)),
      '/S4': PdfString.hexFromBytes(ALL_BYTES),
      '/S5': PdfString.fromHex(ALL_BYTES.toHex().toUpperCase()),
    });
    const bytes = await cleanSave(doc);
    const catalog = qpdfCatalog(bytes);
    for (const key of ['/S1', '/S2', '/S3', '/S4', '/S5']) {
      expect(catalog[key], key).toBe(`b:${ALL_BYTES.toHex()}`);
    }
    const text = byteString(bytes);
    expect(text).toContain(`/S2 <${ALL_BYTES.toHex()}>`);
    expect(text).toContain('/S1 (\u0000\u0001');
  });

  test('hex digits are bytes only through fromHex: fromText("AB") is the text, fromHex("AB") one byte', async () => {
    const bytes = await cleanSave(
      docWithCatalog({ '/T': PdfString.fromText('AB'), '/H': PdfString.fromHex('AB') }),
    );
    const catalog = qpdfCatalog(bytes);
    expect(catalog['/T']).toBe('u:AB');
    expect(catalog['/H']).toBe('b:ab');
  });

  test('a loaded hex string <4142> is saved as the bytes 41 42', async () => {
    const doc = await loadPdf(handBuilt('/X <4142>'));
    const bytes = await cleanSave(doc);
    expect(qpdfCatalog(bytes)['/X']).toBe('u:AB');
    expect(byteString(bytes)).toContain('/X <4142>');
  });

  test('a loaded hex string of 1,000,000 bytes loads and is saved byte for byte', async () => {
    const big = Uint8Array.from({ length: 1_000_000 }, (_, i) => (i * 7) & 0xff);
    const doc = await loadPdf(handBuilt(`/Big <${big.toHex()}>`));
    const bytes = await cleanSave(doc);
    expect(qpdfCatalog(bytes)['/Big']).toBe(`b:${big.toHex()}`);
  });
});

describe('PDF names as bytes', () => {
  /** 20 names: the 10 delimiters and "#", space, bytes 0x01-0x0A, 0x7F and 0x80-0xFF, UTF-8. */
  const NAMES: readonly (readonly [name: PdfName, written: string])[] = [
    [PdfName.of('a(b'), '/a#28b'],
    [PdfName.of('a)b'), '/a#29b'],
    [PdfName.of('a<b'), '/a#3cb'],
    [PdfName.of('a>b'), '/a#3eb'],
    [PdfName.of('a[b'), '/a#5bb'],
    [PdfName.of('a]b'), '/a#5db'],
    [PdfName.of('a{b'), '/a#7bb'],
    [PdfName.of('a}b'), '/a#7db'],
    [PdfName.of('a/b'), '/a#2fb'],
    [PdfName.of('a%b'), '/a#25b'],
    [PdfName.of('a#b'), '/a#23b'],
    [PdfName.of('a b'), '/a#20b'],
    [PdfName.of('\u0080'), '/#80'],
    [PdfName.of('\u00e9t\u00e9'), '/#e9t#e9'],
    [PdfName.of('\u00ff'), '/#ff'],
    [PdfName.of('\u007f'), '/#7f'],
    [PdfName.fromBytes(new TextEncoder().encode('日')), '/#e6#97#a5'],
    [PdfName.of('Caf\u00e9'), '/Caf#e9'],
    [PdfName.of('Plain!~'), '/Plain!~'],
    [PdfName.of('\u0001\t\n'), '/#01#09#0a'],
  ];

  test('20 names are written in the canonical form and qpdf reads the same bytes', async () => {
    const bytes = await cleanSave(
      docWithCatalog({ '/NameSet': PdfArray.of(NAMES.map(([name]) => name)) }),
    );
    expect(byteString(bytes)).toContain(`/NameSet [${NAMES.map(([, w]) => w).join(' ')}]`);
    const read = qpdfCatalog(bytes)['/NameSet'];
    expect(Array.isArray(read) ? read.length : read).toBe(NAMES.length);
    for (const [i, [name, written]] of NAMES.entries()) {
      expect(qpdfNameBytes((read as unknown[])[i]).toHex(), written).toBe(name.toBytes().toHex());
    }
  });

  test('a file holding /A#00B as a key and as a value loads, saves, and draws only the warnings of its input', async () => {
    const input = handBuilt('', '<< /A#00B /A#00B >>');
    const bytes = await (await loadPdf(input)).save({ compress: false });
    expect(byteString(bytes)).toContain('/A#00B /A#00B');
    // qpdf 12.4.2 reads a NUL in a name as a null object and warns, for the input as well: the
    // output is checked against the input's own warnings instead of through expectQpdfClean.
    markChecked(bytes);
    const outputWarnings = qpdfCheckWarnings(bytes);
    expect(outputWarnings).toContain('null character not allowed in name token');
    expect(outputWarnings.every((w) => !w.startsWith('ERROR'))).toBe(true);
    expect(new Set(outputWarnings)).toEqual(new Set(qpdfCheckWarnings(input)));
  });
});
