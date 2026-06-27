/**
 * @module core/meshShading
 *
 * Mesh shadings — ShadingType 4, 5, 6 and 7 (ISO 32000-2:2020 §8.7.4.5.5–.8).
 *
 * Mesh shadings define colour over a 2-D region by tessellating it into either
 * Gouraud-shaded triangles (types 4 and 5) or parametric patches (types 6 and
 * 7). Unlike the dictionary-only shadings (types 1–3), a mesh shading's data is
 * carried in a **stream** whose body is a packed sequence of binary records.
 *
 * Bit-packing rule (ISO 32000-2 §8.7.4.5.5, "All vertex coordinates and colour
 * values shall be encoded as ... a sequence of bits ... most significant bit
 * first"): every value — flag, coordinate and colour component — is written
 * big-endian, MSB-first, into a continuous bit stream with **no padding between
 * values**. Only the very end of the stream is padded with zero bits up to the
 * next byte boundary. (§8.7.4.5.5 further notes each value may begin at any bit
 * position; there is no per-record byte alignment.)
 *
 * Numeric mapping (ISO 32000-2 §8.7.4.5.5, Table 84 /Decode semantics): a
 * coordinate or colour value is stored as an unsigned integer `v` in the range
 * `[0, 2^bits − 1]` and decoded as
 *   `decoded = Dmin + v · (Dmax − Dmin) / (2^bits − 1)`
 * where `[Dmin, Dmax]` is the matching pair in the shading's /Decode array. The
 * /Decode layout is `[xmin xmax ymin ymax c1min c1max … cnmin cnmax]` (or, when
 * /Function is present, a single `[tmin tmax]` colour pair). The builders here
 * take **decoded** user values and invert that mapping to obtain the raw
 * integers to pack, rounding to nearest.
 *
 * Record layouts verified against ISO 32000-2:2020:
 *  - Type 4 (§8.7.4.5.5): per vertex → flag (BitsPerFlag) · x · y · colour[n].
 *  - Type 5 (§8.7.4.5.6): per vertex → x · y · colour[n]; NO flag; adds
 *    /VerticesPerRow (≥ 2). Vertices are given row by row.
 *  - Type 6 (§8.7.4.5.7): per patch → flag (BitsPerFlag) · coordinate pairs ·
 *    colours. Flag 0 (new patch) = 12 coordinate pairs + 4 colours; flags 1–3
 *    (shared edge) = 8 coordinate pairs + 2 colours.
 *  - Type 7 (§8.7.4.5.8): like type 6 but flag 0 = 16 coordinate pairs +
 *    4 colours; flags 1–3 = 12 coordinate pairs + 2 colours.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  type PdfObject,
} from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Allowed widths for /BitsPerCoordinate (ISO 32000-2 §8.7.4.5.5, Table 84). */
export type BitsPerCoordinate = 8 | 16 | 24 | 32;

/** Allowed widths for /BitsPerComponent (ISO 32000-2 §8.7.4.5.5, Table 84). */
export type BitsPerComponent = 8 | 16;

/** Allowed widths for /BitsPerFlag (ISO 32000-2 §8.7.4.5.5, Table 84). */
export type BitsPerFlag = 2 | 8;

/**
 * A single mesh vertex.
 *
 * `color` holds the **decoded** colour: either `n` components in the shading's
 * /ColorSpace, or a single parametric value `t` when the shading carries a
 * /Function. Coordinates are decoded user-space values, mapped through /Decode
 * at pack time.
 */
export interface MeshVertex {
  /** Decoded x coordinate (mapped through /Decode `[xmin xmax]`). */
  x: number;
  /** Decoded y coordinate (mapped through /Decode `[ymin ymax]`). */
  y: number;
  /** Decoded colour: `n` components, or one parametric value `t`. */
  color: number[];
}

/**
 * A free-form (type 4) triangle: an ordered list of flagged vertices.
 *
 * Each vertex carries an edge flag (ISO 32000-2 §8.7.4.5.5, Table 85):
 *  - `0` — starts a new (independent) triangle; must be followed by two more
 *    flag-0 vertices.
 *  - `1` — shares the (vb, vc) edge of the previous triangle.
 *  - `2` — shares the (va, vc) edge of the previous triangle.
 *
 * A `triangles` entry need not literally be three vertices: callers may emit a
 * run of flagged vertices that the consumer assembles into triangles. The
 * builder simply packs the vertices in order.
 */
export interface FreeFormTriangle {
  /** One or more flagged vertices, packed in order. */
  vertices: [FlaggedVertex, ...FlaggedVertex[]];
}

/** A {@link MeshVertex} carrying a type-4 edge flag (0, 1 or 2). */
export type FlaggedVertex = MeshVertex & { flag: number };

/**
 * A Coons patch (type 6) record (ISO 32000-2 §8.7.4.5.7).
 *
 * `flag` selects the record shape:
 *  - `0` — new patch: `points` = 12 control points, `colors` = 4 corner colours.
 *  - `1`–`3` — shared edge: `points` = 8 control points, `colors` = 2 colours.
 */
export interface CoonsPatch {
  /** Edge flag 0–3. */
  flag: number;
  /** Control points as `[x, y]` pairs (12 for flag 0, 8 for flags 1–3). */
  points: [number, number][];
  /** Corner colours (4 for flag 0, 2 for flags 1–3). */
  colors: number[][];
}

/**
 * A tensor-product patch (type 7) record (ISO 32000-2 §8.7.4.5.8).
 *
 * `flag` selects the record shape:
 *  - `0` — new patch: `points` = 16 control points, `colors` = 4 corner colours.
 *  - `1`–`3` — shared edge: `points` = 12 control points, `colors` = 2 colours.
 */
export interface TensorPatch {
  /** Edge flag 0–3. */
  flag: number;
  /** Control points as `[x, y]` pairs (16 for flag 0, 12 for flags 1–3). */
  points: [number, number][];
  /** Corner colours (4 for flag 0, 2 for flags 1–3). */
  colors: number[][];
}

/**
 * Keys common to every mesh shading dictionary
 * (ISO 32000-2 §8.7.4.5.5, Table 84).
 */
export interface MeshShadingCommon {
  /** The shading colour space (name or array, e.g. an ICCBased ref array). */
  colorSpace: PdfName | PdfArray;
  /** Bits used per coordinate value: 8, 16, 24 or 32. */
  bitsPerCoordinate: BitsPerCoordinate;
  /** Bits used per colour component: 8 or 16. */
  bitsPerComponent: BitsPerComponent;
  /**
   * Bits used per edge flag: 2 or 8. Required for types 4, 6 and 7; ignored for
   * type 5 (which has no flags).
   */
  bitsPerFlag: BitsPerFlag;
  /**
   * The /Decode array `[xmin xmax ymin ymax c1min c1max …]`, or
   * `[xmin xmax ymin ymax tmin tmax]` when {@link MeshShadingCommon.function}
   * is present.
   */
  decode: number[];
  /**
   * Optional colour /Function. When present, each vertex/corner colour is a
   * single parametric value `t`; otherwise it is `n` components.
   */
  function?: PdfDict | PdfArray | undefined;
}

// ---------------------------------------------------------------------------
// Bit packer (MSB-first, big-endian — ISO 32000-2 §8.7.4.5.5)
// ---------------------------------------------------------------------------

/**
 * Accumulates unsigned integer values of arbitrary bit width into a byte
 * stream, big-endian and most-significant-bit-first, with no inter-value
 * padding. The final byte is zero-padded to the byte boundary on
 * {@link BitPacker.finish}.
 *
 * @internal
 */
class BitPacker {
  private readonly bytes: number[] = [];
  /** Bits already filled in the current (pending) byte, 0–7. */
  private bitPos = 0;
  /** The partially filled current byte (high bits set first). */
  private current = 0;

  /**
   * Append `bits`-wide unsigned integer `value`, MSB first.
   *
   * @param value - non-negative integer in `[0, 2^bits − 1]`.
   * @param bits - field width (1–32).
   */
  push(value: number, bits: number): void {
    // Emit from the most-significant bit down to bit 0.
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      this.current = (this.current << 1) | bit;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bytes.push(this.current & 0xff);
        this.current = 0;
        this.bitPos = 0;
      }
    }
  }

  /**
   * Flush the pending partial byte (zero-padded on the low bits) and return the
   * packed buffer.
   */
  finish(): Uint8Array {
    if (this.bitPos > 0) {
      // Left-justify the partial byte: shift the filled high bits up so the
      // padding occupies the low-order bits.
      this.bytes.push((this.current << (8 - this.bitPos)) & 0xff);
      this.current = 0;
      this.bitPos = 0;
    }
    return Uint8Array.from(this.bytes);
  }
}

// ---------------------------------------------------------------------------
// Decode mapping
// ---------------------------------------------------------------------------

/**
 * Invert the /Decode mapping for one value: given a decoded user value and its
 * `[min, max]` pair, return the raw unsigned integer in `[0, 2^bits − 1]`.
 *
 * `raw = round((decoded − min) / (max − min) · (2^bits − 1))`, clamped to the
 * representable range (ISO 32000-2 §8.7.4.5.5, /Decode semantics). A degenerate
 * `min == max` pair maps everything to 0.
 *
 * @internal
 */
function encodeValue(
  decoded: number,
  min: number,
  max: number,
  bits: number,
): number {
  const maxRaw = bits >= 32 ? 0xffffffff : (1 << bits) - 1;
  if (max === min) return 0;
  const t = (decoded - min) / (max - min);
  const raw = Math.round(t * maxRaw);
  if (raw < 0) return 0;
  if (raw > maxRaw) return maxRaw;
  return raw;
}

/**
 * Number of colour components carried per vertex/corner:
 * 1 when a /Function is present (parametric `t`), else the count implied by the
 * colour /Decode pairs.
 *
 * @internal
 */
function colorComponentCount(common: MeshShadingCommon): number {
  if (common.function !== undefined) return 1;
  // /Decode = 4 coordinate bounds + 2 per colour component.
  const colorPairs = (common.decode.length - 4) / 2;
  return Math.max(1, Math.trunc(colorPairs));
}

/**
 * Pack one vertex's coordinates then its colours (no flag) into `packer`.
 *
 * @internal
 */
function packVertexData(
  packer: BitPacker,
  vertex: MeshVertex,
  common: MeshShadingCommon,
  nColor: number,
): void {
  const { decode, bitsPerCoordinate: bpcoord, bitsPerComponent: bpcomp } = common;
  // Coordinates: /Decode[0..3] = xmin xmax ymin ymax.
  packer.push(
    encodeValue(vertex.x, decode[0] ?? 0, decode[1] ?? 1, bpcoord),
    bpcoord,
  );
  packer.push(
    encodeValue(vertex.y, decode[2] ?? 0, decode[3] ?? 1, bpcoord),
    bpcoord,
  );
  // Colours: /Decode[4 + 2k .. 5 + 2k].
  for (let k = 0; k < nColor; k++) {
    const cmin = decode[4 + 2 * k] ?? 0;
    const cmax = decode[5 + 2 * k] ?? 1;
    const comp = vertex.color[k] ?? 0;
    packer.push(encodeValue(comp, cmin, cmax, bpcomp), bpcomp);
  }
}

/**
 * Pack a single `[x, y]` control point (coordinates only) into `packer`.
 *
 * @internal
 */
function packPoint(
  packer: BitPacker,
  point: [number, number],
  common: MeshShadingCommon,
): void {
  const { decode, bitsPerCoordinate: bpcoord } = common;
  packer.push(
    encodeValue(point[0], decode[0] ?? 0, decode[1] ?? 1, bpcoord),
    bpcoord,
  );
  packer.push(
    encodeValue(point[1], decode[2] ?? 0, decode[3] ?? 1, bpcoord),
    bpcoord,
  );
}

/**
 * Pack one colour (n components) into `packer`.
 *
 * @internal
 */
function packColor(
  packer: BitPacker,
  color: number[],
  common: MeshShadingCommon,
  nColor: number,
): void {
  const { decode, bitsPerComponent: bpcomp } = common;
  for (let k = 0; k < nColor; k++) {
    const cmin = decode[4 + 2 * k] ?? 0;
    const cmax = decode[5 + 2 * k] ?? 1;
    const comp = color[k] ?? 0;
    packer.push(encodeValue(comp, cmin, cmax, bpcomp), bpcomp);
  }
}

// ---------------------------------------------------------------------------
// Dict assembly
// ---------------------------------------------------------------------------

/**
 * Build the dictionary shared by every mesh shading and set the common keys.
 *
 * @internal
 */
function buildCommonDict(
  shadingType: number,
  common: MeshShadingCommon,
  includeFlag: boolean,
): PdfDict {
  const dict = new PdfDict();
  dict.set('/ShadingType', PdfNumber.of(shadingType));
  dict.set('/ColorSpace', common.colorSpace);
  dict.set('/BitsPerCoordinate', PdfNumber.of(common.bitsPerCoordinate));
  dict.set('/BitsPerComponent', PdfNumber.of(common.bitsPerComponent));
  if (includeFlag) {
    dict.set('/BitsPerFlag', PdfNumber.of(common.bitsPerFlag));
  }
  dict.set('/Decode', PdfArray.fromNumbers([...common.decode]));
  if (common.function !== undefined) {
    dict.set('/Function', common.function as PdfObject);
  }
  return dict;
}

// ---------------------------------------------------------------------------
// Type 4 — free-form Gouraud-shaded triangle mesh (§8.7.4.5.5)
// ---------------------------------------------------------------------------

/** Options for {@link buildFreeFormGouraudShading}. */
export interface FreeFormGouraudOptions extends MeshShadingCommon {
  /** Triangle runs whose flagged vertices are packed in order. */
  triangles: FreeFormTriangle[];
}

/**
 * Build a free-form Gouraud-shaded triangle mesh shading
 * (ISO 32000-2 §8.7.4.5.5, /ShadingType 4).
 *
 * Each vertex is packed as `flag · x · y · colour[n]`, MSB-first, with the flag
 * `bitsPerFlag` wide.
 *
 * @param options - the common mesh keys plus the triangle/vertex data.
 * @returns a {@link PdfStream} whose dict has /ShadingType 4 and whose body is
 *          the packed vertex stream.
 */
export function buildFreeFormGouraudShading(
  options: FreeFormGouraudOptions,
): PdfStream {
  const dict = buildCommonDict(4, options, true);
  const nColor = colorComponentCount(options);
  const packer = new BitPacker();

  for (const tri of options.triangles) {
    for (const vertex of tri.vertices) {
      packer.push(vertex.flag, options.bitsPerFlag);
      packVertexData(packer, vertex, options, nColor);
    }
  }

  const data = packer.finish();
  return PdfStream.fromBytes(data, dict);
}

// ---------------------------------------------------------------------------
// Type 5 — lattice-form Gouraud-shaded triangle mesh (§8.7.4.5.6)
// ---------------------------------------------------------------------------

/** Options for {@link buildLatticeFormGouraudShading}. */
export interface LatticeFormGouraudOptions
  extends Omit<MeshShadingCommon, 'bitsPerFlag'> {
  /** Number of vertices in each row of the lattice (≥ 2). */
  verticesPerRow: number;
  /** All vertices in row-major order (no flags). */
  vertices: MeshVertex[];
}

/**
 * Build a lattice-form Gouraud-shaded triangle mesh shading
 * (ISO 32000-2 §8.7.4.5.6, /ShadingType 5).
 *
 * Vertices carry **no** flag; the mesh topology is implied by /VerticesPerRow.
 * Each vertex is packed as `x · y · colour[n]`, MSB-first.
 *
 * @param options - the common mesh keys (sans /BitsPerFlag) plus
 *                   /VerticesPerRow and the row-major vertex list.
 * @returns a {@link PdfStream} with /ShadingType 5 and /VerticesPerRow.
 */
export function buildLatticeFormGouraudShading(
  options: LatticeFormGouraudOptions,
): PdfStream {
  // Type 5 has no /BitsPerFlag; synthesise a common record for the shared
  // helpers (the flag width is never consulted).
  const common: MeshShadingCommon = {
    colorSpace: options.colorSpace,
    bitsPerCoordinate: options.bitsPerCoordinate,
    bitsPerComponent: options.bitsPerComponent,
    bitsPerFlag: 8,
    decode: options.decode,
    function: options.function,
  };
  const dict = buildCommonDict(5, common, false);
  dict.set('/VerticesPerRow', PdfNumber.of(options.verticesPerRow));

  const nColor = colorComponentCount(common);
  const packer = new BitPacker();
  for (const vertex of options.vertices) {
    packVertexData(packer, vertex, common, nColor);
  }

  const data = packer.finish();
  return PdfStream.fromBytes(data, dict);
}

// ---------------------------------------------------------------------------
// Type 6 — Coons patch mesh (§8.7.4.5.7)
// ---------------------------------------------------------------------------

/** Options for {@link buildCoonsPatchShading}. */
export interface CoonsPatchOptions extends MeshShadingCommon {
  /** Coons patches packed in order. */
  patches: CoonsPatch[];
}

/**
 * Build a Coons patch mesh shading
 * (ISO 32000-2 §8.7.4.5.7, /ShadingType 6).
 *
 * Each patch is packed as `flag · points · colours`. A flag-0 patch carries 12
 * control points and 4 corner colours; flags 1–3 carry 8 control points and 2
 * colours (the rest are inherited from the shared edge of the previous patch).
 *
 * @param options - the common mesh keys plus the patch list.
 * @returns a {@link PdfStream} with /ShadingType 6.
 */
export function buildCoonsPatchShading(
  options: CoonsPatchOptions,
): PdfStream {
  const dict = buildCommonDict(6, options, true);
  const nColor = colorComponentCount(options);
  const packer = new BitPacker();

  for (const patch of options.patches) {
    packer.push(patch.flag, options.bitsPerFlag);
    for (const point of patch.points) {
      packPoint(packer, point, options);
    }
    for (const color of patch.colors) {
      packColor(packer, color, options, nColor);
    }
  }

  const data = packer.finish();
  return PdfStream.fromBytes(data, dict);
}

// ---------------------------------------------------------------------------
// Type 7 — tensor-product patch mesh (§8.7.4.5.8)
// ---------------------------------------------------------------------------

/** Options for {@link buildTensorPatchShading}. */
export interface TensorPatchOptions extends MeshShadingCommon {
  /** Tensor-product patches packed in order. */
  patches: TensorPatch[];
}

/**
 * Build a tensor-product patch mesh shading
 * (ISO 32000-2 §8.7.4.5.8, /ShadingType 7).
 *
 * Identical packing to type 6 but a flag-0 patch carries 16 control points (the
 * 4 internal tensor points in addition to the 12 boundary points) plus 4 corner
 * colours; flags 1–3 carry 12 control points and 2 colours.
 *
 * @param options - the common mesh keys plus the patch list.
 * @returns a {@link PdfStream} with /ShadingType 7.
 */
export function buildTensorPatchShading(
  options: TensorPatchOptions,
): PdfStream {
  const dict = buildCommonDict(7, options, true);
  const nColor = colorComponentCount(options);
  const packer = new BitPacker();

  for (const patch of options.patches) {
    packer.push(patch.flag, options.bitsPerFlag);
    for (const point of patch.points) {
      packPoint(packer, point, options);
    }
    for (const color of patch.colors) {
      packColor(packer, color, options, nColor);
    }
  }

  const data = packer.finish();
  return PdfStream.fromBytes(data, dict);
}
