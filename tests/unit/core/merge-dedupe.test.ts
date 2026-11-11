/**
 * Stream de-duplication in copyPages / mergePdfs / splitPdf reuses an
 * earlier copy only when the stream bytes and dictionary are both equal.
 */
import { describe, it, expect } from 'vitest';
import {
  createPdf,
  loadPdf,
  copyPages,
  mergePdfs,
  splitPdf,
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfStream,
} from '../../../src/index.js';
import type { PdfDocument, PdfObject } from '../../../src/index.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const nums = (values: number[]): PdfArray => PdfArray.of(values.map((n) => PdfNumber.of(n)));

/** A 2x1 DeviceGray image XObject over `data`, with extra or overriding entries. */
function image(data: Uint8Array, extra: [string, PdfObject][] = []): PdfStream {
  const dict = new PdfDict([
    ['/Type', PdfName.of('/XObject')],
    ['/Subtype', PdfName.of('/Image')],
    ['/Width', PdfNumber.of(2)],
    ['/Height', PdfNumber.of(1)],
    ['/ColorSpace', PdfName.of('/DeviceGray')],
    ['/BitsPerComponent', PdfNumber.of(8)],
    ...extra,
  ]);
  return PdfStream.fromBytes(new Uint8Array(data), dict);
}

/** A Form XObject over `data` with the given /BBox and extra entries. */
function form(data: Uint8Array, bbox: number[], extra: [string, PdfObject][] = []): PdfStream {
  const dict = new PdfDict([
    ['/Type', PdfName.of('/XObject')],
    ['/Subtype', PdfName.of('/Form')],
    ['/BBox', nums(bbox)],
    ...extra,
  ]);
  return PdfStream.fromBytes(new Uint8Array(data), dict);
}

/** One page that paints XObjects /XA and /XB, built in memory. */
function sourceWith(a: PdfStream, b: PdfStream): PdfDocument {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  const registry = doc.getRegistry();
  page.registerXObject('XA', registry.register(a));
  page.registerXObject('XB', registry.register(b));
  page.pushOperators('q 50 0 0 50 10 10 cm /XA Do Q q 50 0 0 50 100 10 cm /XB Do Q\n');
  return doc;
}

/** The target refs of /XA and /XB on page 0 of an in-memory document. */
function xobjectRefs(doc: PdfDocument): { a: PdfRef; b: PdfRef } {
  const page = doc.getPages()[0];
  if (!page) throw new Error('no page 0');
  const xobjects = page.buildResources().get('/XObject');
  if (!(xobjects instanceof PdfDict)) throw new Error('no /XObject dict');
  const a = xobjects.get('/XA');
  const b = xobjects.get('/XB');
  if (!(a instanceof PdfRef) || !(b instanceof PdfRef)) throw new Error('/XA or /XB is not a ref');
  return { a, b };
}

function copied(source: PdfDocument): PdfDocument {
  const target = createPdf();
  copyPages(source, target, [0]);
  return target;
}

function resolvedStream(doc: PdfDocument, ref: PdfRef): PdfStream {
  const obj = doc.getRegistry().resolve(ref);
  if (!(obj instanceof PdfStream)) throw new Error(`object ${ref.objectNumber} is not a stream`);
  return obj;
}

/** 32-bit FNV-1a, the bucket hash documentMerge uses, to prove the fixture still collides. */
function fnv1a32(data: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const PIXELS = new Uint8Array([0x00, 0xff]);

describe('merge dedupe: same data, different dictionary stays two objects', () => {
  const cases: [string, PdfStream, PdfStream][] = [
    ['/Decode', image(PIXELS), image(PIXELS, [['/Decode', nums([1, 0])]])],
    [
      '/Width and /Height',
      image(PIXELS),
      image(PIXELS, [
        ['/Width', PdfNumber.of(1)],
        ['/Height', PdfNumber.of(2)],
      ]),
    ],
    [
      '/ColorSpace',
      image(PIXELS),
      image(PIXELS, [
        [
          '/ColorSpace',
          new PdfArray([
            PdfName.of('/Indexed'),
            PdfName.of('/DeviceRGB'),
            PdfNumber.of(1),
            PdfNumber.of(0),
          ]),
        ],
      ]),
    ],
    ['/Filter', image(enc('41>')), image(enc('41>'), [['/Filter', PdfName.of('/ASCIIHexDecode')]])],
    [
      '/DecodeParms',
      image(PIXELS, [['/DecodeParms', new PdfDict([['/Predictor', PdfNumber.of(12)]])]]),
      image(PIXELS, [['/DecodeParms', new PdfDict([['/Predictor', PdfNumber.of(2)]])]]),
    ],
    ['/Subtype (Form vs Image)', form(PIXELS, [0, 0, 1, 1]), image(PIXELS)],
    [
      'empty data, /BBox',
      form(new Uint8Array(0), [0, 0, 10, 10]),
      form(new Uint8Array(0), [0, 0, 99, 99]),
    ],
  ];

  it.each(cases)('differs in %s', (_label, a, b) => {
    const target = copied(sourceWith(a, b));
    const refs = xobjectRefs(target);
    expect(refs.b.objectNumber).not.toBe(refs.a.objectNumber);
    // B keeps its own dictionary in the copy
    const copiedB = resolvedStream(target, refs.b);
    for (const [key] of b.dict) {
      if (key !== '/Length') expect(copiedB.dict.has(key), key).toBe(true);
    }
  });

  it('keeps /Decode on the second image through PdfDocument.copyPages, mergePdfs and splitPdf', async () => {
    const make = (): PdfDocument =>
      sourceWith(image(PIXELS), image(PIXELS, [['/Decode', nums([1, 0])]]));

    const viaMethod = createPdf();
    await viaMethod.copyPages(make(), [0]);
    const other = createPdf();
    other.addPage();
    const merged = await mergePdfs([make(), other]);
    const [split] = await splitPdf(make(), [[0, 0]]);
    if (!split) throw new Error('splitPdf returned no document');

    for (const doc of [viaMethod, merged, split]) {
      const refs = xobjectRefs(doc);
      expect(refs.b.objectNumber).not.toBe(refs.a.objectNumber);
      expect(resolvedStream(doc, refs.b).dict.get('/Decode')).toBeInstanceOf(PdfArray);
      expect(resolvedStream(doc, refs.a).dict.has('/Decode')).toBe(false);
    }
  });

  it('survives save and reload of a merged document', async () => {
    const merged = await mergePdfs([
      sourceWith(image(PIXELS), image(PIXELS, [['/Decode', nums([1, 0])]])),
      createPdf(),
    ]);
    const reloaded = await loadPdf(await merged.save({ compress: false }));
    const page = reloaded.getPages()[0];
    if (!page) throw new Error('no page 0');
    const resources = page.getOriginalResources();
    const xobjects = resources?.get('/XObject');
    if (!(xobjects instanceof PdfDict)) throw new Error('no /XObject dict on reload');
    const a = xobjects.get('/XA');
    const b = xobjects.get('/XB');
    if (!(a instanceof PdfRef) || !(b instanceof PdfRef))
      throw new Error('/XA or /XB is not a ref');
    expect(b.objectNumber).not.toBe(a.objectNumber);
    const streamB = reloaded.getRegistry().resolve(b);
    expect(streamB).toBeInstanceOf(PdfStream);
    expect((streamB as PdfStream).dict.get('/Decode')).toBeInstanceOf(PdfArray);
  });
});

describe('merge dedupe: different data never aliases', () => {
  it('two streams with equal 32-bit FNV-1a hash and equal dictionaries stay two objects', () => {
    const a = enc('00009pf8');
    const b = enc('0000arj6');
    // Precondition: the fixture really collides under the bucket hash.
    expect(fnv1a32(a)).toBe(fnv1a32(b));
    const target = copied(sourceWith(form(a, [0, 0, 10, 10]), form(b, [0, 0, 10, 10])));
    const refs = xobjectRefs(target);
    expect(refs.b.objectNumber).not.toBe(refs.a.objectNumber);
    expect(new TextDecoder().decode(resolvedStream(target, refs.b).data)).toBe('0000arj6');
  });

  it('streams whose dictionaries point at different indirect objects stay two objects', () => {
    const source = createPdf();
    const page = source.addPage([200, 200]);
    const registry = source.getRegistry();
    const resA = registry.register(new PdfDict([['/ProcSet', new PdfArray([PdfName.of('/PDF')])]]));
    const resB = registry.register(
      new PdfDict([['/ProcSet', new PdfArray([PdfName.of('/Text')])]]),
    );
    page.registerXObject(
      'XA',
      registry.register(form(enc('q Q'), [0, 0, 1, 1], [['/Resources', resA]])),
    );
    page.registerXObject(
      'XB',
      registry.register(form(enc('q Q'), [0, 0, 1, 1], [['/Resources', resB]])),
    );
    page.pushOperators('/XA Do /XB Do\n');
    const refs = xobjectRefs(copied(source));
    expect(refs.b.objectNumber).not.toBe(refs.a.objectNumber);
  });
});

describe('merge dedupe: same data and same dictionary still dedupes', () => {
  it('identical streams become one object', () => {
    const data = enc('0 0 m 10 10 l S');
    const refs = xobjectRefs(
      copied(sourceWith(form(data, [0, 0, 10, 10]), form(data, [0, 0, 10, 10]))),
    );
    expect(refs.b.objectNumber).toBe(refs.a.objectNumber);
  });

  it('dictionary key order does not matter', () => {
    const data = enc('q Q');
    const reordered = new PdfStream(
      new PdfDict([
        ['/BBox', nums([0, 0, 5, 5])],
        ['/Subtype', PdfName.of('/Form')],
        ['/Type', PdfName.of('/XObject')],
        ['/Length', PdfNumber.of(data.length)],
      ]),
      new Uint8Array(data),
    );
    const refs = xobjectRefs(copied(sourceWith(form(data, [0, 0, 5, 5]), reordered)));
    expect(refs.b.objectNumber).toBe(refs.a.objectNumber);
  });

  it('/Length is ignored (missing or wrong on one side)', () => {
    const data = enc('q Q');
    const noLength = new PdfStream(
      new PdfDict([
        ['/Type', PdfName.of('/XObject')],
        ['/Subtype', PdfName.of('/Form')],
        ['/BBox', nums([0, 0, 5, 5])],
      ]),
      new Uint8Array(data),
    );
    const wrongLength = form(data, [0, 0, 5, 5]);
    wrongLength.dict.set('/Length', PdfNumber.of(999));
    const missing = xobjectRefs(copied(sourceWith(form(data, [0, 0, 5, 5]), noLength)));
    expect(missing.b.objectNumber).toBe(missing.a.objectNumber);
    const wrong = xobjectRefs(copied(sourceWith(form(data, [0, 0, 5, 5]), wrongLength)));
    expect(wrong.b.objectNumber).toBe(wrong.a.objectNumber);
  });
});
