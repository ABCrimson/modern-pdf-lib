/**
 * Bodies of the render adversarial pair (render-limits.test.ts). Each entry builds its Form
 * XObjects in code, interprets a page that calls them and returns what the interpretation
 * produced; the font and image entries run the extractors on a page whose stream data cannot be
 * read.
 */
import { deflateSync } from 'node:zlib';
import type { JsonValue } from '../helpers/budget.js';
import { interpretContentStream } from '../../src/render/interpreter.js';
import { parseContentStream } from '../../src/parser/contentStreamParser.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfString,
} from '../../src/core/pdfObjects.js';
import type { PdfPage } from '../../src/core/pdfPage.js';
import { extractFonts } from '../../src/render/fontExtract.js';
import { extractImages } from '../../src/render/imageExtract.js';
import { INTERNAL_LIMITS } from '../../src/internal/limits.js';
import { ResourceLimitError, UnsupportedFilterError } from '../../src/errors.js';

const encoder = new TextEncoder();

function resourcesOf(name: string, stream: PdfStream): PdfDict {
  return new PdfDict().set('/XObject', new PdfDict().set(`/${name}`, stream));
}

function newForm(content: string): PdfStream {
  const dict = new PdfDict().set('/Subtype', PdfName.of('Form'));
  return PdfStream.fromString(content, dict);
}

function interpretCalling(name: string, stream: PdfStream, page = `/${name} Do`): JsonValue {
  const dl = interpretContentStream(parseContentStream(encoder.encode(page)), {
    width: 200,
    height: 200,
    resources: resourcesOf(name, stream),
  });
  return { items: dl.items.length };
}

/** A form that draws one rectangle and then calls itself `args.calls` times. */
export function selfInvoking(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const calls = (args as { calls: number }).calls;
  const self = newForm(`0 0 1 1 re f ${'/Self Do '.repeat(calls)}`);
  self.dict.set('/Resources', resourcesOf('Self', self));
  return interpretCalling('Self', self);
}

/** Two forms that call each other `args.calls` times each. */
export function mutuallyInvoking(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const calls = (args as { calls: number }).calls;
  const a = newForm(`0 0 1 1 re f ${'/B Do '.repeat(calls)}`);
  const b = newForm(`2 2 1 1 re f ${'/A Do '.repeat(calls)}`);
  a.dict.set('/Resources', resourcesOf('B', b));
  b.dict.set('/Resources', resourcesOf('A', a));
  return interpretCalling('A', a);
}

/** `args.depth` distinct forms in a chain, each calling the next `args.calls` times. */
export function distinctChain(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { depth, calls } = args as { depth: number; calls: number };
  return chainOf(depth, calls, '0 0 1 1 re f');
}

/** `depth` distinct forms in a chain, each calling the next `calls` times; the leaf is `leaf`. */
function chainOf(depth: number, calls: number, leaf: string): JsonValue {
  let next = newForm(leaf);
  for (let level = 1; level < depth; level++) {
    const form = newForm('/N Do '.repeat(calls));
    form.dict.set('/Resources', resourcesOf('N', next));
    next = form;
  }
  return interpretCalling('N', next);
}

/** Forms whose leaf is one TJ of `args.n` one-character strings, under a fan-out of `depth` x `calls`. */
export function tjFanout(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { depth, calls, n } = args as { depth: number; calls: number; n: number };
  return chainOf(depth, calls, `/F1 12 Tf [${'(a)'.repeat(n)}] TJ`);
}

/** `len` bytes of `pattern` repeated (the last copy cut short), built by doubling copies. */
function fillBytes(len: number, pattern: string | number): Uint8Array {
  const out = new Uint8Array(len);
  const seed =
    typeof pattern === 'number' ? Uint8Array.of(pattern) : new TextEncoder().encode(pattern);
  let filled = Math.min(seed.length, len);
  out.set(seed.subarray(0, filled));
  while (filled < len) {
    const step = Math.min(filled, len - filled);
    out.copyWithin(filled, 0, step);
    filled += step;
  }
  return out;
}

/** The parts joined end to end. */
function joinBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Forms whose leaf is one Tj of an `args.n`-character string, under a fan-out of `depth` x `calls`. */
export function longTj(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { depth, calls, n } = args as { depth: number; calls: number; n: number };
  return chainOf(depth, calls, `/F1 12 Tf (${'a'.repeat(n)}) Tj`);
}

/** A Flate form of `args.ops` operators `n`, called once. */
export function hugeOnce(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const ops = (args as { ops: number }).ops;
  const data = fillBytes(ops * 2, 'n ');
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Form'))
    .set('/Filter', PdfName.of('FlateDecode'));
  return interpretCalling('F', PdfStream.fromBytes(deflateSync(data, { level: 1 }), dict));
}

/**
 * A Flate form of 2^24 operands (`args.shape`): empty arrays then an operator, empty arrays only,
 * one array of empty arrays, or numbers only; the operands are counted as they are parsed.
 */
export function operandForm(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const shape = (args as { shape: string }).shape;
  const n = 16 * 1024 * 1024;
  let data: Uint8Array;
  if (shape === 'arraysThenOperator') data = joinBytes(fillBytes(n * 2, '[]'), fillBytes(2, ' n'));
  else if (shape === 'arraysOnly') data = fillBytes(n * 2, '[]');
  else if (shape === 'oneArray')
    data = joinBytes(fillBytes(1, '['), fillBytes(n * 2, '[]'), fillBytes(1, ']'));
  else data = fillBytes(n * 2, '1 ');
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Form'))
    .set('/Filter', PdfName.of('FlateDecode'));
  return interpretCalling('F', PdfStream.fromBytes(deflateSync(data, { level: 1 }), dict));
}

/**
 * A form whose data inflates to `args.mib` MiB and then names a filter that is not supported, called
 * `args.k` times by the page.
 */
export function failingRepeat(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { mib, k } = args as { mib: number; k: number };
  const data = fillBytes(mib * 1024 * 1024, 0x20);
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Form'))
    .set('/Filter', PdfArray.of([PdfName.of('FlateDecode'), PdfName.of('JPXDecode')]));
  const form = PdfStream.fromBytes(deflateSync(data, { level: 1 }), dict);
  return interpretCalling('F', form, '/F Do '.repeat(k));
}

/** A stream whose raw data cannot be read: reading it throws `error`. */
function unreadable(dict: PdfDict, error: Error): PdfStream {
  const stream = PdfStream.fromString('', dict);
  Object.defineProperty(stream, 'data', {
    get() {
      throw error;
    },
  });
  return stream;
}

/** A page with the given resources and no indirect objects, as the extractors read it. */
function pageOf(resources: PdfDict): PdfPage {
  return {
    getOriginalResources: () => resources,
    getRegistry: () => ({ resolve: () => undefined }),
  } as unknown as PdfPage;
}

/** extractFonts on a page whose embedded font file cannot be decoded: `args.limit` picks the error. */
export function fontFileUnreadable(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const error = (args as { limit: boolean }).limit
    ? new ResourceLimitError(
        'maxDecodedStreamBytes',
        INTERNAL_LIMITS.maxDecodedStreamBytes,
        'bytes',
      )
    : new Error('unreadable');
  const descriptor = new PdfDict().set('/FontFile2', unreadable(new PdfDict(), error));
  const font = new PdfDict().set('/FontDescriptor', descriptor);
  const resources = new PdfDict().set('/Font', new PdfDict().set('/F1', font));
  return { fonts: extractFonts(pageOf(resources)).length };
}

/** extractImages on a page whose image data cannot be decoded: `args.kind` picks the error. */
export function imageUnreadable(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const kind = (args as { kind: 'limit' | 'unsupported' | 'other' }).kind;
  const error =
    kind === 'limit'
      ? new ResourceLimitError('maxImagePixels', INTERNAL_LIMITS.maxImagePixels, 'pixels')
      : kind === 'unsupported'
        ? new UnsupportedFilterError('JPXDecode')
        : new Error('unreadable');
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Image'))
    .set('/Width', PdfNumber.of(2))
    .set('/Height', PdfNumber.of(2))
    .set('/ColorSpace', PdfName.of('DeviceGray'));
  const resources = new PdfDict().set(
    '/XObject',
    new PdfDict().set('/Im1', unreadable(dict, error)),
  );
  return { images: extractImages(pageOf(resources)).length };
}

/** extractImages on an Indexed image of `args.w` x `args.w` pixels whose data is `args.data` bytes long. */
export function indexedImage(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { w, data } = args as { w: number; data: number };
  const space = PdfArray.of([
    PdfName.of('Indexed'),
    PdfName.of('DeviceRGB'),
    PdfNumber.of(1),
    PdfString.hex('000000ffffff'),
  ]);
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Image'))
    .set('/Width', PdfNumber.of(w))
    .set('/Height', PdfNumber.of(w))
    .set('/BitsPerComponent', PdfNumber.of(8))
    .set('/ColorSpace', space);
  const stream = PdfStream.fromBytes(new Uint8Array(data), dict);
  const resources = new PdfDict().set('/XObject', new PdfDict().set('/Im1', stream));
  return { images: extractImages(pageOf(resources)).length };
}

/** extractImages on a DeviceGray image of `args.w` x `args.w` pixels, 8 bits, with all its data. */
export function grayImage(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const w = (args as { w: number }).w;
  const dict = new PdfDict()
    .set('/Subtype', PdfName.of('Image'))
    .set('/Width', PdfNumber.of(w))
    .set('/Height', PdfNumber.of(w))
    .set('/BitsPerComponent', PdfNumber.of(8))
    .set('/ColorSpace', PdfName.of('DeviceGray'));
  const stream = PdfStream.fromBytes(new Uint8Array(w * w), dict);
  const resources = new PdfDict().set('/XObject', new PdfDict().set('/Im1', stream));
  return { images: extractImages(pageOf(resources)).length };
}
