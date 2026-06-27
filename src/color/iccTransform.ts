/**
 * @module color/iccTransform
 *
 * Apply an ICC profile's **matrix/TRC** colour model to transform device
 * colour into the Profile Connection Space (PCS), for the common
 * RGB-display and grayscale cases, plus the CIE L\*a\*b\* conversion.
 *
 * Two ICC profile shapes can describe a display/input transform:
 *
 *  - **Matrix/TRC** — three (RGB) or one (gray) one-dimensional tone-response
 *    curves followed by a 3×3 colorant matrix. This is what virtually every
 *    monitor (`mntr`) RGB profile and most gray profiles use. This module
 *    implements exactly this model.
 *  - **LUT-based** — `mft1`/`mft2` (`lut8`/`lut16`) or `mAB `/`mBA `
 *    (`lutAtoBType`/`lutBtoAType`) multidimensional tables (A2B0/B2A0 …). These
 *    cannot be evaluated as a matrix/TRC and are explicitly **rejected** rather
 *    than silently mis-computed.
 *
 * For a matrix/TRC RGB profile the forward device→PCS transform is
 * (ICC.1:2010 §E.1.1, "RGB Device to PCS"):
 *
 * ```
 *   [ X ]   [ rX gX bX ] [ TRC_r(r) ]
 *   [ Y ] = [ rY gY bY ] [ TRC_g(g) ]
 *   [ Z ]   [ rZ gZ bZ ] [ TRC_b(b) ]
 * ```
 *
 * where the matrix columns are the `rXYZ`/`gXYZ`/`bXYZ` colorant tags and each
 * `TRC_*` is the linearising tone-response curve from `rTRC`/`gTRC`/`bTRC`
 * (`kTRC` for gray). The resulting XYZ is **D50-relative**, matching the ICC
 * PCS reference illuminant (ICC.1:2010 §6.3.4.3, PCS = CIEXYZ relative to D50 =
 * `[0.9642, 1.0000, 0.8249]`).
 *
 * Spec references (ICC.1:2010-12, "Image technology colour management —
 * Architecture, profile format and data structure"):
 *  - §7.2  profile header layout (version o8, deviceClass o12, colour space
 *          o16, PCS o20).
 *  - §7.3  tag table (o128: u32 count, then 12-byte records {sig, offset, size}).
 *  - §4.2  s15Fixed16Number = signed int32 / 65536.
 *  - §10.6 curveType ('curv': u32 count; 0 = identity, 1 = u8Fixed8 gamma,
 *          n≥2 = uInt16 sampled curve over the domain [0,1]).
 *  - §10.18 parametricCurveType ('para': u16 function type + s15Fixed16 params).
 *  - §10.31 XYZType ('XYZ ': reserved + n × (3 × s15Fixed16)).
 *
 * No Buffer — uses `Uint8Array` / `DataView` exclusively.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Summary of an ICC profile header plus whether it carries a usable
 * matrix/TRC model.
 */
export interface IccTransformInfo {
  /**
   * Raw profile version word from header offset 8 (big-endian u32). For
   * example `0x02100000` = v2.1, `0x04300000` = v4.3.
   */
  readonly version: number;
  /** Device class signature from offset 12 (e.g. `'mntr'`, `'prtr'`, `'scnr'`). */
  readonly deviceClass: string;
  /** Data colour space signature from offset 16 (e.g. `'RGB '`, `'GRAY'`, `'CMYK'`). */
  readonly colorSpace: string;
  /** Profile Connection Space signature from offset 20 (`'XYZ '` or `'Lab '`). */
  readonly pcs: string;
  /**
   * `true` when the profile carries a complete matrix/TRC model:
   *  - RGB: `rXYZ` + `gXYZ` + `bXYZ` and `rTRC` + `gTRC` + `bTRC` all present.
   *  - GRAY: `kTRC` present (the gray-colorant matrix degenerates to the
   *    white point).
   */
  readonly hasMatrixTrc: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * ICC PCS reference white, D50, in XYZ (ICC.1:2010 §6.3.4.3 / Annex A,
 * encoded white point `[0.9642, 1.0000, 0.8249]`).
 */
const D50_WHITE: readonly [number, number, number] = [0.9642, 1.0, 0.8249];

/** CIE L\*a\*b\* threshold δ = 6/29 (CIE 15:2004 §8.2.1). */
const LAB_DELTA = 6 / 29;
/** δ³ — the f(t) breakpoint in the t domain. */
const LAB_DELTA_CUBED = LAB_DELTA * LAB_DELTA * LAB_DELTA;
/** 1 / (3·δ²) — slope of the linear segment of f(t). */
const LAB_LINEAR_SLOPE = 1 / (3 * LAB_DELTA * LAB_DELTA);
/** 4/29 — intercept of the linear segment of f(t). */
const LAB_LINEAR_INTERCEPT = 4 / 29;

const HEADER_SIZE = 128;
const TAG_COUNT_OFFSET = 128;
const TAG_TABLE_OFFSET = 132;
const TAG_RECORD_SIZE = 12;

// ---------------------------------------------------------------------------
// Header / tag-table parsing
// ---------------------------------------------------------------------------

/** Decode a 4-byte ASCII signature at `off`. */
function readSig(data: Uint8Array, off: number): string {
  return String.fromCharCode(
    data[off]!,
    data[off + 1]!,
    data[off + 2]!,
    data[off + 3]!,
  );
}

/** s15Fixed16Number → JS number (ICC.1:2010 §4.2): signed int32 / 65536. */
function readS15Fixed16(view: DataView, off: number): number {
  return view.getInt32(off, false) / 65536;
}

interface TagRecord {
  readonly offset: number;
  readonly size: number;
}

/**
 * Read the tag table into a `sig → {offset,size}` map.
 *
 * @throws if the profile is shorter than a header + tag count, or the tag
 *         table extends past the end of the data.
 */
function readTagTable(data: Uint8Array): Map<string, TagRecord> {
  if (data.length < TAG_TABLE_OFFSET) {
    throw new Error(
      `ICC profile too short: ${data.length} bytes (need at least ${TAG_TABLE_OFFSET}).`,
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(TAG_COUNT_OFFSET, false);
  const tableEnd = TAG_TABLE_OFFSET + count * TAG_RECORD_SIZE;
  if (tableEnd > data.length) {
    throw new Error(
      `ICC tag table (${count} tags) overruns profile of ${data.length} bytes.`,
    );
  }
  const table = new Map<string, TagRecord>();
  for (let i = 0; i < count; i++) {
    const rec = TAG_TABLE_OFFSET + i * TAG_RECORD_SIZE;
    const sig = readSig(data, rec);
    const offset = view.getUint32(rec + 4, false);
    const size = view.getUint32(rec + 8, false);
    table.set(sig, { offset, size });
  }
  return table;
}

/**
 * Parse the matrix/TRC-relevant header fields and detect whether the profile
 * carries a complete matrix/TRC model.
 *
 * Reads the 128-byte ICC header (ICC.1:2010 §7.2): version (offset 8),
 * deviceClass (offset 12), data colour space (offset 16) and PCS (offset 20),
 * then inspects the tag table (§7.3) for the colorant + TRC tags.
 *
 * @param profile - Raw ICC profile bytes.
 * @returns Parsed {@link IccTransformInfo}.
 * @throws if the profile is too short to contain a header and tag table.
 *
 * @example
 * ```ts
 * import { parseIccTransform } from 'modern-pdf-lib';
 *
 * const info = parseIccTransform(profileBytes);
 * if (info.hasMatrixTrc && info.colorSpace === 'RGB ') {
 *   // safe to call deviceRgbToXyz
 * }
 * ```
 */
export function parseIccTransform(profile: Uint8Array): IccTransformInfo {
  if (profile.length < HEADER_SIZE) {
    throw new Error(
      `ICC profile too short: ${profile.length} bytes (need at least ${HEADER_SIZE}).`,
    );
  }
  const view = new DataView(
    profile.buffer,
    profile.byteOffset,
    profile.byteLength,
  );
  const version = view.getUint32(8, false);
  const deviceClass = readSig(profile, 12);
  const colorSpace = readSig(profile, 16);
  const pcs = readSig(profile, 20);

  const table = readTagTable(profile);

  let hasMatrixTrc: boolean;
  if (colorSpace === 'GRAY') {
    // Gray matrix/TRC: a single kTRC curve (the colorant "matrix" is the
    // media white point). ICC.1:2010 §8.3.2 (Monochrome Input/Display).
    hasMatrixTrc = table.has('kTRC');
  } else {
    hasMatrixTrc =
      table.has('rXYZ') &&
      table.has('gXYZ') &&
      table.has('bXYZ') &&
      table.has('rTRC') &&
      table.has('gTRC') &&
      table.has('bTRC');
  }

  return { version, deviceClass, colorSpace, pcs, hasMatrixTrc };
}

// ---------------------------------------------------------------------------
// Tone-response curve (TRC) evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a TRC tag (`curv` or `para`) at a normalised input `x ∈ [0,1]`,
 * returning the linearised value in `[0,1]`.
 *
 *  - `curv` (ICC.1:2010 §10.6): `count` u16 follows the 8-byte type header.
 *    `count == 0` → identity; `count == 1` → a single u8Fixed8Number gamma
 *    (Y = X^g); `count >= 2` → a uInt16 sampled curve over the input domain
 *    [0,1], linearly interpolated, output normalised by 65535.
 *  - `para` (ICC.1:2010 §10.18): a u16 function type + s15Fixed16 parameters.
 *    Implements function types 0–4 from the spec.
 *
 * @throws if the tag type is neither `curv` nor `para`, or is truncated.
 */
function evalTrc(data: Uint8Array, tag: TagRecord, x: number): number {
  const start = tag.offset;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = readSig(data, start);

  // Clamp input to the curve domain.
  const xi = x < 0 ? 0 : x > 1 ? 1 : x;

  if (type === 'curv') {
    const count = view.getUint32(start + 8, false);
    if (count === 0) {
      // Identity curve.
      return xi;
    }
    if (count === 1) {
      // Single u8Fixed8Number gamma: Y = X^g.
      const g = view.getUint16(start + 12, false) / 256;
      return xi ** g;
    }
    // count >= 2: sampled uInt16 curve over [0,1], linear interpolation.
    const lutStart = start + 12;
    const pos = xi * (count - 1);
    const i0 = Math.floor(pos);
    const i1 = i0 >= count - 1 ? count - 1 : i0 + 1;
    const frac = pos - i0;
    const v0 = view.getUint16(lutStart + i0 * 2, false);
    const v1 = view.getUint16(lutStart + i1 * 2, false);
    return (v0 + (v1 - v0) * frac) / 65535;
  }

  if (type === 'para') {
    // parametricCurveType: funcType at offset 8 (u16), reserved u16,
    // then s15Fixed16 params g, a, b, c, d, e, f (as many as the type needs).
    const funcType = view.getUint16(start + 8, false);
    const p = (i: number): number => readS15Fixed16(view, start + 12 + i * 4);
    const g = p(0);
    switch (funcType) {
      case 0:
        // Y = X^g
        return xi ** g;
      case 1: {
        // Y = (a·X + b)^g for X >= -b/a, else 0
        const a = p(1);
        const b = p(2);
        return a * xi + b >= 0 ? (a * xi + b) ** g : 0;
      }
      case 2: {
        // Y = (a·X + b)^g + c for X >= -b/a, else c
        const a = p(1);
        const b = p(2);
        const c = p(3);
        return (a * xi + b >= 0 ? (a * xi + b) ** g : 0) + c;
      }
      case 3: {
        // Y = (a·X + b)^g for X >= d, else c·X
        const a = p(1);
        const b = p(2);
        const c = p(3);
        const d = p(4);
        return xi >= d ? (a * xi + b) ** g : c * xi;
      }
      case 4: {
        // Y = (a·X + b)^g + e for X >= d, else c·X + f
        const a = p(1);
        const b = p(2);
        const c = p(3);
        const d = p(4);
        const e = p(5);
        const f = p(6);
        return xi >= d ? (a * xi + b) ** g + e : c * xi + f;
      }
      default:
        throw new Error(
          `Unsupported parametricCurveType function type ${funcType} (ICC.1:2010 §10.18 defines 0–4).`,
        );
    }
  }

  throw new Error(
    `Unsupported TRC tag type '${type}': only 'curv' and 'para' are matrix/TRC curves (got a LUT/other type).`,
  );
}

// ---------------------------------------------------------------------------
// Device → PCS XYZ
// ---------------------------------------------------------------------------

/** Read a 3-component colorant XYZ from an 'XYZ ' tag. */
function readXyzTag(data: Uint8Array, tag: TagRecord): [number, number, number] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = readSig(data, tag.offset);
  if (type !== 'XYZ ') {
    throw new Error(
      `Expected an 'XYZ ' colorant tag but found '${type}' (ICC.1:2010 §10.31).`,
    );
  }
  // sig(4) + reserved(4) then X,Y,Z s15Fixed16.
  return [
    readS15Fixed16(view, tag.offset + 8),
    readS15Fixed16(view, tag.offset + 12),
    readS15Fixed16(view, tag.offset + 16),
  ];
}

/**
 * Transform a device colour through a **matrix/TRC** ICC profile into the
 * D50-relative PCS XYZ.
 *
 * For RGB (`colorSpace === 'RGB '`): each channel is linearised through its
 * `rTRC`/`gTRC`/`bTRC` curve, then multiplied by the colorant matrix whose
 * columns are the `rXYZ`/`gXYZ`/`bXYZ` tags (ICC.1:2010 §E.1.1).
 *
 * For GRAY (`colorSpace === 'GRAY'`): the single value is linearised through
 * `kTRC` and scaled by the media white point (`wtpt`, defaulting to D50).
 *
 * The result is **D50-relative XYZ**, matching the ICC PCS reference
 * illuminant; feed it directly to {@link xyzToLab} (whose default white point
 * is D50).
 *
 * @param profile - Raw ICC profile bytes.
 * @param rgb     - Device colour in `[0,1]`. For gray profiles only the first
 *                  component is used.
 * @returns PCS XYZ `[X, Y, Z]`, D50-relative.
 * @throws if the profile is **not** matrix/TRC (i.e. it is LUT-based —
 *         `mft1`/`mft2`/`mAB `/`mBA `), or its colour space is unsupported.
 *
 * @example
 * ```ts
 * import { deviceRgbToXyz } from 'modern-pdf-lib';
 *
 * const xyz = deviceRgbToXyz(srgbProfileBytes, [1, 1, 1]);
 * // ~ [0.9642, 1.0, 0.8249]  (D50 white)
 * ```
 */
export function deviceRgbToXyz(
  profile: Uint8Array,
  rgb: [number, number, number],
): [number, number, number] {
  const info = parseIccTransform(profile);
  const table = readTagTable(profile);

  if (info.colorSpace === 'GRAY') {
    const kTrc = table.get('kTRC');
    if (!kTrc) {
      throw new Error(
        "Gray ICC profile lacks a 'kTRC' tag; not a matrix/TRC profile.",
      );
    }
    const lin = evalTrc(profile, kTrc, rgb[0]);
    const wtptRec = table.get('wtpt');
    const white = wtptRec
      ? readXyzTag(profile, wtptRec)
      : ([D50_WHITE[0], D50_WHITE[1], D50_WHITE[2]] as [number, number, number]);
    return [lin * white[0], lin * white[1], lin * white[2]];
  }

  if (info.colorSpace !== 'RGB ') {
    throw new Error(
      `deviceRgbToXyz supports 'RGB ' and 'GRAY' profiles; got '${info.colorSpace}'.`,
    );
  }

  if (!info.hasMatrixTrc) {
    throw new Error(
      'ICC profile is not matrix/TRC (LUT-based: mft1/mft2/mAB /mBA ); ' +
        'matrix/TRC transform cannot be applied. Use a CMM/LUT evaluator instead.',
    );
  }

  const rTrc = table.get('rTRC')!;
  const gTrc = table.get('gTRC')!;
  const bTrc = table.get('bTRC')!;
  const rLin = evalTrc(profile, rTrc, rgb[0]);
  const gLin = evalTrc(profile, gTrc, rgb[1]);
  const bLin = evalTrc(profile, bTrc, rgb[2]);

  const rCol = readXyzTag(profile, table.get('rXYZ')!);
  const gCol = readXyzTag(profile, table.get('gXYZ')!);
  const bCol = readXyzTag(profile, table.get('bXYZ')!);

  // Column matrix: XYZ = rCol·rLin + gCol·gLin + bCol·bLin.
  return [
    rCol[0] * rLin + gCol[0] * gLin + bCol[0] * bLin,
    rCol[1] * rLin + gCol[1] * gLin + bCol[1] * bLin,
    rCol[2] * rLin + gCol[2] * gLin + bCol[2] * bLin,
  ];
}

// ---------------------------------------------------------------------------
// XYZ → CIE L*a*b*
// ---------------------------------------------------------------------------

/**
 * CIE L\*a\*b\* nonlinearity f(t) (CIE 15:2004 §8.2.1.1):
 *
 * ```
 *   f(t) = t^(1/3)                       for t >  δ³
 *   f(t) = t / (3·δ²) + 4/29             for t <= δ³,   δ = 6/29
 * ```
 */
function labF(t: number): number {
  return t > LAB_DELTA_CUBED
    ? Math.cbrt(t)
    : t * LAB_LINEAR_SLOPE + LAB_LINEAR_INTERCEPT;
}

/**
 * Convert PCS XYZ to CIE L\*a\*b\* (CIE 15:2004 §8.2.1 / ICC PCS):
 *
 * ```
 *   L* = 116·f(Y/Yn) − 16
 *   a* = 500·(f(X/Xn) − f(Y/Yn))
 *   b* = 200·(f(Y/Yn) − f(Z/Zn))
 * ```
 *
 * with f as in {@link labF}. The default reference white is **D50**
 * `[0.9642, 1.0000, 0.8249]`, matching the ICC PCS (ICC.1:2010 §6.3.4.3), so
 * XYZ produced by {@link deviceRgbToXyz} maps straight through.
 *
 * @param xyz        - XYZ tristimulus, relative to `whitePoint`.
 * @param whitePoint - Reference white `[Xn, Yn, Zn]`. Defaults to D50.
 * @returns `[L*, a*, b*]`.
 *
 * @example
 * ```ts
 * import { xyzToLab } from 'modern-pdf-lib';
 *
 * xyzToLab([0.9642, 1.0, 0.8249]); // ~ [100, 0, 0]  (D50 white)
 * ```
 */
export function xyzToLab(
  xyz: [number, number, number],
  whitePoint: [number, number, number] = [
    D50_WHITE[0],
    D50_WHITE[1],
    D50_WHITE[2],
  ],
): [number, number, number] {
  const fx = labF(xyz[0] / whitePoint[0]);
  const fy = labF(xyz[1] / whitePoint[1]);
  const fz = labF(xyz[2] / whitePoint[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
