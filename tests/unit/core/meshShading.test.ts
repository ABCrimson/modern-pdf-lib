/**
 * Tests for mesh shadings types 4–7 (ISO 32000-2:2020 §8.7.4.5.5–.8).
 *
 * Covers:
 * - buildFreeFormGouraudShading()  → /ShadingType 4 (flagged vertices)
 * - buildLatticeFormGouraudShading() → /ShadingType 5 (+ /VerticesPerRow)
 * - buildCoonsPatchShading()        → /ShadingType 6 (12 pts + 4 colors, flag 0)
 * - buildTensorPatchShading()       → /ShadingType 7 (16 pts + 4 colors, flag 0)
 *
 * The packed-stream assertions are hand-computed (see comments) so that the
 * MSB-first, big-endian bit-packing rule (§8.7.4.5.5) is pinned down exactly.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFreeFormGouraudShading,
  buildLatticeFormGouraudShading,
  buildCoonsPatchShading,
  buildTensorPatchShading,
  type MeshVertex,
  type FreeFormTriangle,
  type CoonsPatch,
  type TensorPatch,
} from '../../../src/core/meshShading.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numbers(arr: PdfArray): number[] {
  return arr.items.map((item) => {
    expect(item).toBeInstanceOf(PdfNumber);
    return (item as PdfNumber).value;
  });
}

/** Full-byte identity decode for n color components: maps raw v→v. */
function identityDecode(nComponents: number): number[] {
  const d: number[] = [0, 255, 0, 255];
  for (let i = 0; i < nComponents; i++) d.push(0, 255);
  return d;
}

// ---------------------------------------------------------------------------
// Type 4 — free-form Gouraud
// ---------------------------------------------------------------------------

describe('buildFreeFormGouraudShading (type 4)', () => {
  // A single triangle: three vertices, flag 0 for each (independent triangle).
  // DeviceRGB → 3 color components per vertex.
  const tri: FreeFormTriangle = {
    vertices: [
      { flag: 0, x: 10, y: 20, color: [30, 40, 50] },
      { flag: 0, x: 60, y: 70, color: [80, 90, 100] },
      { flag: 0, x: 110, y: 120, color: [130, 140, 150] },
    ] as [MeshVertex & { flag: number }, ...(MeshVertex & { flag: number })[]],
  };

  it('produces a PdfStream whose dict is /ShadingType 4 with the bit keys', () => {
    const stream = buildFreeFormGouraudShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      bitsPerFlag: 8,
      decode: identityDecode(3),
      triangles: [tri],
    });
    expect(stream).toBeInstanceOf(PdfStream);
    const d = stream.dict;
    expect((d.get('/ShadingType') as PdfNumber).value).toBe(4);
    expect((d.get('/BitsPerCoordinate') as PdfNumber).value).toBe(8);
    expect((d.get('/BitsPerComponent') as PdfNumber).value).toBe(8);
    expect((d.get('/BitsPerFlag') as PdfNumber).value).toBe(8);
    expect((d.get('/ColorSpace') as PdfName).value).toBe('/DeviceRGB');
    expect(numbers(d.get('/Decode') as PdfArray)).toEqual(identityDecode(3));
    // Type 4 carries no /VerticesPerRow.
    expect(d.has('/VerticesPerRow')).toBe(false);
  });

  it('packs each vertex as flag,x,y,c1,c2,c3 at byte boundaries (8/8/8 bits)', () => {
    // Each vertex = 8 (flag) + 8+8 (coords) + 8*3 (colors) = 48 bits = 6 bytes.
    // Decode is identity over [0,255] so raw == value.
    // v0: 00 0A 14 1E 28 32 ; v1: 00 3C 46 50 5A 64 ; v2: 00 6E 78 82 8C 96
    const stream = buildFreeFormGouraudShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      bitsPerFlag: 8,
      decode: identityDecode(3),
      triangles: [tri],
    });
    expect(Array.from(stream.data)).toEqual([
      0x00, 0x0a, 0x14, 0x1e, 0x28, 0x32, // v0: flag,10,20,30,40,50
      0x00, 0x3c, 0x46, 0x50, 0x5a, 0x64, // v1: flag,60,70,80,90,100
      0x00, 0x6e, 0x78, 0x82, 0x8c, 0x96, // v2: flag,110,120,130,140,150
    ]);
    expect((stream.dict.get('/Length') as PdfNumber).value).toBe(18);
  });

  it('MSB-first sub-byte packing: bitsPerFlag 2, one parametric vertex → 00 40 80 C0', () => {
    // /Function present ⇒ a single parametric color value t per vertex.
    // One vertex: flag(2b)=00, x(8b)=0x01, y(8b)=0x02, t(8b)=0x03.
    // Total = 2+8+8+8 = 26 bits → rounded up to 32 bits = 4 bytes.
    // Bitstream (MSB-first): 00 | 00000001 | 00000010 | 00000011 | pad 000000
    //   byte0 = 00 000000 = 0x00
    //   byte1 = 01 000000 = 0x40
    //   byte2 = 10 000000 = 0x80
    //   byte3 = 11 000000 = 0xC0
    const fnDict = new PdfDict();
    fnDict.set('/FunctionType', PdfNumber.of(2));
    const oneVertexTri: FreeFormTriangle = {
      vertices: [
        { flag: 0, x: 1, y: 2, color: [3] },
        { flag: 0, x: 1, y: 2, color: [3] },
        { flag: 0, x: 1, y: 2, color: [3] },
      ] as [
        MeshVertex & { flag: number },
        ...(MeshVertex & { flag: number })[],
      ],
    };
    const stream = buildFreeFormGouraudShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      bitsPerFlag: 2,
      // With /Function present, only 1 parametric component: decode has the
      // coordinate range plus a single [tmin,tmax] pair.
      decode: [0, 255, 0, 255, 0, 255],
      function: fnDict,
      triangles: [{ vertices: [oneVertexTri.vertices[0]] as FreeFormTriangle['vertices'] }],
    });
    expect(stream.dict.has('/Function')).toBe(true);
    expect(Array.from(stream.data)).toEqual([0x00, 0x40, 0x80, 0xc0]);
  });
});

// ---------------------------------------------------------------------------
// Type 5 — lattice-form Gouraud
// ---------------------------------------------------------------------------

describe('buildLatticeFormGouraudShading (type 5)', () => {
  it('produces /ShadingType 5 with /VerticesPerRow and no /BitsPerFlag', () => {
    const v = (x: number, y: number): MeshVertex => ({ x, y, color: [x, y, 0] });
    const stream = buildLatticeFormGouraudShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      decode: identityDecode(3),
      verticesPerRow: 2,
      vertices: [v(0, 0), v(1, 0), v(0, 1), v(1, 1)],
    });
    const d = stream.dict;
    expect((d.get('/ShadingType') as PdfNumber).value).toBe(5);
    expect((d.get('/VerticesPerRow') as PdfNumber).value).toBe(2);
    expect(d.has('/BitsPerFlag')).toBe(false);
    // Each vertex = 8+8+8*3 = 40 bits = 5 bytes; 4 vertices ⇒ 20 bytes, no flag.
    expect(stream.data.length).toBe(20);
    expect(Array.from(stream.data.slice(0, 5))).toEqual([0, 0, 0, 0, 0]);
    expect(Array.from(stream.data.slice(5, 10))).toEqual([1, 0, 1, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// Type 6 — Coons patch mesh
// ---------------------------------------------------------------------------

describe('buildCoonsPatchShading (type 6)', () => {
  it('flag-0 patch packs 12 coordinate pairs + 4 colors', () => {
    // 12 control points p1..p12 (x,y), 4 corner colors (RGB).
    const points: [number, number][] = Array.from(
      { length: 12 },
      (_, i) => [i, i] as [number, number],
    );
    const colors: number[][] = [
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
      [100, 110, 120],
    ];
    const patch: CoonsPatch = { flag: 0, points, colors };
    const stream = buildCoonsPatchShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      bitsPerFlag: 8,
      decode: identityDecode(3),
      patches: [patch],
    });
    const d = stream.dict;
    expect((d.get('/ShadingType') as PdfNumber).value).toBe(6);
    expect((d.get('/BitsPerFlag') as PdfNumber).value).toBe(8);
    // bits = flag(8) + 12 pts * (8+8) + 4 colors * 3 * 8
    //      = 8 + 192 + 96 = 296 bits = 37 bytes.
    expect(stream.data.length).toBe(37);
    // First byte = flag 0; bytes 1..24 = the 12 coord pairs 0,0,1,1,...,11,11.
    expect(stream.data[0]).toBe(0);
    expect(Array.from(stream.data.slice(1, 7))).toEqual([0, 0, 1, 1, 2, 2]);
    // Last 12 bytes = the 4 RGB colors.
    expect(Array.from(stream.data.slice(25))).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Type 7 — tensor-product patch mesh
// ---------------------------------------------------------------------------

describe('buildTensorPatchShading (type 7)', () => {
  it('flag-0 patch packs 16 coordinate pairs + 4 colors', () => {
    const points: [number, number][] = Array.from(
      { length: 16 },
      (_, i) => [i, i] as [number, number],
    );
    const colors: number[][] = [
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
      [100, 110, 120],
    ];
    const patch: TensorPatch = { flag: 0, points, colors };
    const stream = buildTensorPatchShading({
      colorSpace: PdfName.of('DeviceRGB'),
      bitsPerCoordinate: 8,
      bitsPerComponent: 8,
      bitsPerFlag: 8,
      decode: identityDecode(3),
      patches: [patch],
    });
    const d = stream.dict;
    expect((d.get('/ShadingType') as PdfNumber).value).toBe(7);
    // bits = flag(8) + 16 pts * 16 + 4 colors * 24 = 8 + 256 + 96 = 360 = 45 bytes.
    expect(stream.data.length).toBe(45);
    expect(stream.data[0]).toBe(0);
    expect(Array.from(stream.data.slice(1, 7))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(Array.from(stream.data.slice(33))).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
  });
});
