/**
 * Object-by-object comparison of a library load with qpdf's decrypted QDF form of the same file.
 *
 * `qpdfDecryptQdfMapped` runs `qpdf [--password=<pw>] --decrypt --qdf --object-streams=disable
 * --static-id`, which keeps a `%% Original object ID: N G` comment before each object qpdf took
 * from the input (QDF renumbers objects; the objects it adds, the indirect stream /Length values,
 * have no such comment). `compareWithQdf` loads that output with the library as an unencrypted
 * file and compares each original object N G with object N G of the library's load of the input.
 *
 * The normalisation:
 * - generations: compared for every original object and reference;
 * - references: a qpdf reference is mapped back through the original-id table; a reference to an
 *   object QDF added is compared by the value it resolves to;
 * - dictionaries: keys compared as sets, without /Length, /Filter and /DecodeParms, which the
 *   stream rule handles;
 * - streams: a qpdf stream without /Filter (QDF decoded it) is compared with the library's fully
 *   decoded data; a qpdf stream that kept its filter (one qpdf does not decode) is compared with
 *   the library's data as loaded; one trailing end-of-line is stripped on both sides;
 * - strings: compared as bytes (code units), whatever their form;
 * - numbers by value; names, booleans and null as they are;
 * - not compared: the /Encrypt dictionary, cross-reference streams and object stream containers
 *   (none of them appears in the QDF output), and the trailer /ID.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PdfRef } from '../../../src/core/pdfObjects.js';
import type {
  PdfArray,
  PdfDict,
  PdfObject,
  PdfObjectRegistry,
  PdfStream,
  PdfString,
} from '../../../src/core/pdfObjects.js';
import { decodeStreamData } from '../../../src/codecs/streamDecode.js';
import { beginCall } from '../../../src/internal/limits.js';
import { DEFAULT_LIMITS } from '../../../src/limits.js';
import { QPDF_BIN, QpdfError } from './qpdf.js';

/** The QDF form of `bytes` and the original object number and generation of each QDF object. */
export interface MappedQdf {
  readonly bytes: Uint8Array;
  /** QDF object number -> the input's object number and generation. */
  readonly original: ReadonlyMap<number, { readonly num: number; readonly gen: number }>;
}

/**
 * `qpdf [--password=<password>] --decrypt --qdf --object-streams=disable --static-id` of `bytes`,
 * with the original object ids kept. Exit 3 (warnings only) is accepted when qpdf wrote the
 * output; any other non-zero exit throws a QpdfError.
 */
export function qpdfDecryptQdfMapped(bytes: Uint8Array, password?: string): MappedQdf {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-qdf-'));
  try {
    const input = join(dir, 'in.pdf');
    const output = join(dir, 'out.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(
      QPDF_BIN,
      [
        ...(password === undefined ? [] : [`--password=${password}`]),
        '--decrypt',
        '--qdf',
        '--object-streams=disable',
        '--static-id',
        input,
        output,
      ],
      { encoding: 'utf8' },
    );
    if (result.error !== undefined) throw result.error;
    if ((result.status !== 0 && result.status !== 3) || !existsSync(output)) {
      throw new QpdfError(
        `qpdf --decrypt --qdf exit ${result.status}: ${`${result.stdout} ${result.stderr}`.replaceAll(input, 'in.pdf').trim()}`,
      );
    }
    const out = new Uint8Array(readFileSync(output));
    const text = new TextDecoder('latin1').decode(out);
    const original = new Map<number, { num: number; gen: number }>();
    for (const m of text.matchAll(/%% Original object ID: (\d+) (\d+)\r?\n(\d+) 0 obj/g)) {
      original.set(Number(m[3]), { num: Number(m[1]), gen: Number(m[2]) });
    }
    return { bytes: out, original };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Data without one trailing end-of-line (CRLF, LF or CR). */
function stripEol(data: Uint8Array): Uint8Array {
  let end = data.length;
  if (data[end - 1] === 0x0a) end--;
  if (end < data.length && data[end - 1] === 0x0d) end--;
  else if (end === data.length && data[end - 1] === 0x0d) end--;
  return data.subarray(0, end);
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const SKIPPED_KEYS = new Set(['/Length', '/Filter', '/DecodeParms']);

/**
 * Every difference between the library's load (`library`) and the QDF load (`qdf`) of the same
 * file, as `object N G: <path>: <what>` lines; empty when they agree.
 */
export function compareWithQdf(
  library: PdfObjectRegistry,
  qdf: PdfObjectRegistry,
  mapped: MappedQdf,
): string[] {
  const out: string[] = [];

  const compare = (a: PdfObject | undefined, b: PdfObject | undefined, path: string): void => {
    if (b?.kind === 'ref') {
      const target = mapped.original.get((b as PdfRef).objectNumber);
      if (target === undefined) {
        // An object QDF added: compare by value.
        const value = qdf.resolve(b as PdfRef);
        compare(a?.kind === 'ref' ? library.resolve(a as PdfRef) : a, value, path);
        return;
      }
      if (
        a?.kind !== 'ref' ||
        (a as PdfRef).objectNumber !== target.num ||
        (a as PdfRef).generationNumber !== target.gen
      ) {
        out.push(`${path}: reference ${target.num} ${target.gen} R, library ${describe(a)}`);
      }
      return;
    }
    if (a === undefined || b === undefined) {
      out.push(`${path}: library ${describe(a)}, qpdf ${describe(b)}`);
      return;
    }
    if (a.kind !== b.kind) {
      out.push(`${path}: library ${a.kind}, qpdf ${b.kind}`);
      return;
    }
    switch (b.kind) {
      case 'string': {
        const libStr = a as PdfString;
        const qpdfStr = b as PdfString;
        if (!libStr.equals(qpdfStr))
          out.push(
            `${path}: library <${libStr.toBytes().toHex()}>, qpdf <${qpdfStr.toBytes().toHex()}>`,
          );
        return;
      }
      case 'name':
      case 'bool':
      case 'number': {
        const av = (a as { value: unknown }).value;
        const bv = (b as { value: unknown }).value;
        if (av !== bv)
          out.push(`${path}: library ${JSON.stringify(av)}, qpdf ${JSON.stringify(bv)}`);
        return;
      }
      case 'null':
        return;
      case 'array': {
        const ai = (a as PdfArray).items;
        const bi = (b as PdfArray).items;
        if (ai.length !== bi.length) {
          out.push(`${path}: library ${ai.length} items, qpdf ${bi.length}`);
          return;
        }
        bi.forEach((item, i) => compare(ai[i], item, `${path}[${i}]`));
        return;
      }
      case 'dict':
        compareDicts(a as PdfDict, b as PdfDict, path);
        return;
      case 'stream': {
        const as = a as PdfStream;
        const bs = b as PdfStream;
        compareDicts(as.dict, bs.dict, path);
        let libraryData: Uint8Array;
        if (bs.dict.has('/Filter')) {
          libraryData = as.data;
        } else {
          try {
            libraryData = decodeStreamData(as, beginCall(DEFAULT_LIMITS));
          } catch (err) {
            out.push(`${path}: the library's data does not decode (${String(err)})`);
            return;
          }
        }
        if (!bytesEqual(stripEol(libraryData), stripEol(bs.data))) {
          out.push(
            `${path}: stream data differs (library ${libraryData.length}, qpdf ${bs.data.length} bytes)`,
          );
        }
        return;
      }
    }
  };

  const compareDicts = (a: PdfDict, b: PdfDict, path: string): void => {
    const keys = (d: PdfDict): string[] =>
      Array.from(d, ([k]) => k)
        .filter((k) => !SKIPPED_KEYS.has(k))
        .sort();
    const ak = keys(a);
    const bk = keys(b);
    if (ak.join(' ') !== bk.join(' ')) {
      out.push(`${path}: keys library [${ak.join(' ')}], qpdf [${bk.join(' ')}]`);
    }
    for (const k of bk) {
      if (a.has(k)) compare(a.get(k), b.get(k), `${path}${k}`);
    }
  };

  const libraryGen = new Map<number, number>();
  for (const { ref } of library) libraryGen.set(ref.objectNumber, ref.generationNumber);
  for (const [qdfNum, { num, gen }] of mapped.original) {
    const held = libraryGen.get(num);
    if (held !== undefined && held !== gen)
      out.push(`object ${num} ${gen}: library generation ${held}`);
    compare(
      library.resolve(PdfRef.of(num, gen)),
      qdf.resolve(PdfRef.of(qdfNum, 0)),
      `object ${num} ${gen}: `,
    );
  }
  return out;
}

function describe(o: PdfObject | undefined): string {
  if (o === undefined) return 'nothing';
  if (o.kind === 'ref') return `${(o as PdfRef).objectNumber} ${(o as PdfRef).generationNumber} R`;
  return o.kind;
}
