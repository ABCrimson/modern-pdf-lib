/**
 * @module assets/font/variableFont
 *
 * OpenType variable-font axis/instance model parsing — the 'fvar' (font
 * variations) and 'avar' (axis variations) tables.
 *
 * This module exposes the *variation model* of an OpenType variable font:
 *   - the design-variation axes ('fvar' VariationAxisRecord array),
 *   - the named instances ('fvar' InstanceRecord array),
 *   - coordinate normalization from user scale to the normalized [-1, 0, +1]
 *     scale, optionally refined by an 'avar' segment map.
 *
 * SCOPE NOTE — explicitly OUT OF SCOPE for this module:
 *   Actual glyph-outline instancing (baking 'gvar'/'cvar' deltas into a static
 *   font at a chosen coordinate, or interpolating 'glyf' outlines) is NOT
 *   performed here. This module only models axes/instances and normalizes
 *   coordinates, which is the foundation those operations build on.
 *
 * NAME RESOLUTION NOTE:
 *   The human-readable axis/instance names live in the 'name' table. Decoding
 *   them is optional per the task; this module does NOT resolve them and leaves
 *   `name` undefined, preserving the numeric name IDs (`axisNameID` /
 *   `subfamilyNameID` / `postScriptNameID`) so a caller can resolve them later.
 *
 * Spec references (OpenType 1.9.1, Microsoft Typography):
 *   - 'fvar': https://learn.microsoft.com/en-us/typography/opentype/spec/fvar
 *   - 'avar': https://learn.microsoft.com/en-us/typography/opentype/spec/avar
 *   - Data types (Fixed, F2DOT14, Tag, Offset16):
 *       https://learn.microsoft.com/en-us/typography/opentype/spec/otff#data-types
 *   - Normalization pseudocode:
 *       https://learn.microsoft.com/en-us/typography/opentype/spec/otvaroverview#coordinate-scales-and-normalization
 *
 * No external dependencies. No Buffer — Uint8Array + DataView only. Big-endian.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single design-variation axis from the 'fvar' VariationAxisRecord.
 *
 * Coordinate values (`minValue`, `defaultValue`, `maxValue`) are in *user
 * scale* (the scale specific to the axis tag, e.g. 100..900 for 'wght').
 */
export interface VariationAxis {
  /** Four-character axis tag, e.g. 'wght', 'wdth', 'ital', 'opsz', 'slnt'. */
  tag: string;
  /** Minimum user-scale coordinate value. */
  minValue: number;
  /** Default user-scale coordinate value (the default instance). */
  defaultValue: number;
  /** Maximum user-scale coordinate value. */
  maxValue: number;
  /**
   * Human-readable axis name resolved from the 'name' table via `axisNameID`.
   * Not resolved by this module — always `undefined` here.
   */
  name?: string | undefined;
  /** Axis qualifier flags. Bit 0 (0x0001) = HIDDEN_AXIS; others reserved. */
  flags: number;
}

/**
 * A named instance (named design position) from an 'fvar' InstanceRecord.
 */
export interface NamedInstance {
  /**
   * Human-readable subfamily name resolved from the 'name' table via `nameId`.
   * Not resolved by this module — always `undefined` here.
   */
  name?: string | undefined;
  /** Axis tag → user-scale coordinate for this instance. */
  coordinates: Record<string, number>;
  /** The 'name' table name ID for this instance's subfamily name. */
  nameId: number;
  /**
   * Optional 'name' table name ID for this instance's PostScript name.
   * Present only when the font's InstanceRecord size includes it
   * (instanceSize == axisCount*4 + 6). A value of 0xFFFF means "ignore"
   * and is normalized to `undefined`.
   */
  postScriptNameId?: number | undefined;
}

/**
 * A single 'avar' segment map for one axis: an ordered list of
 * (fromCoordinate, toCoordinate) pairs in normalized [-1, 1] space.
 */
export type AvarSegmentMap = ReadonlyArray<{
  /** Default-normalized input coordinate (F2DOT14, in [-1, 1]). */
  fromCoordinate: number;
  /** Modified normalized output coordinate (F2DOT14, in [-1, 1]). */
  toCoordinate: number;
}>;

/**
 * The parsed variable-font model.
 */
export interface VariableFontInfo {
  /** True iff the font has an 'fvar' table with at least one axis. */
  isVariable: boolean;
  /** The design-variation axes, in 'fvar' order. */
  axes: VariationAxis[];
  /** The named instances, in 'fvar' order. */
  namedInstances: NamedInstance[];
  /**
   * Parsed 'avar' segment maps, one per axis in 'fvar' order, if an 'avar'
   * table is present and well-formed. Undefined when there is no 'avar' table.
   */
  avar?: AvarSegmentMap[] | undefined;
}

// ---------------------------------------------------------------------------
// Minimal big-endian sfnt table-directory reader
// ---------------------------------------------------------------------------
//
// The sfnt offset table is at byte 0:
//   uint32 sfntVersion (0x00010000 TrueType, 'OTTO' CFF, 'true', 'ttcf'...)
//   uint16 numTables
//   uint16 searchRange / entrySelector / rangeShift
// The table directory starts at offset 12: numTables records of 16 bytes:
//   { tag[4], checkSum[4], offset[4], length[4] } — all big-endian.
// (See OpenType spec "Organization of an OpenType font".)

interface TableRecord {
  offset: number;
  length: number;
}

function readTableDirectory(data: Uint8Array): Map<string, TableRecord> | null {
  if (data.length < 12) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4, false);

  const dirEnd = 12 + numTables * 16;
  if (numTables === 0 || dirEnd > data.length) return null;

  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = String.fromCharCode(
      data[recOff]!,
      data[recOff + 1]!,
      data[recOff + 2]!,
      data[recOff + 3]!,
    );
    const offset = view.getUint32(recOff + 8, false);
    const length = view.getUint32(recOff + 12, false);
    tables.set(tag, { offset, length });
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Fixed-point readers (verified against OpenType Data Types)
// ---------------------------------------------------------------------------

/**
 * Read a Fixed (16.16 signed) value: a big-endian int32 divided by 65536.
 * Used by 'fvar' for axis min/default/max and instance coordinates.
 */
function readFixed(view: DataView, off: number): number {
  return view.getInt32(off, false) / 65536;
}

/**
 * Read an F2DOT14 (2.14 signed) value: a big-endian int16 divided by 16384.
 * Used by 'avar' for AxisValueMap from/to coordinates.
 */
function readF2Dot14(view: DataView, off: number): number {
  return view.getInt16(off, false) / 16384;
}

// ---------------------------------------------------------------------------
// 'avar' parsing
// ---------------------------------------------------------------------------
//
// 'avar' header (8 bytes):
//   uint16 majorVersion (=1), uint16 minorVersion (=0),
//   uint16 reserved (=0),     uint16 axisCount
// Then axisCount SegmentMaps records, each:
//   uint16 positionMapCount
//   AxisValueMap[positionMapCount] — each { F2DOT14 fromCoordinate, F2DOT14 toCoordinate }

function parseAvar(
  data: Uint8Array,
  rec: TableRecord,
  expectedAxisCount: number,
): AvarSegmentMap[] | undefined {
  // Need at least the 8-byte header.
  if (rec.offset + 8 > data.length) return undefined;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const majorVersion = view.getUint16(rec.offset, false);
  if (majorVersion !== 1) return undefined; // only version 1.x is defined
  const axisCount = view.getUint16(rec.offset + 6, false);

  // axisCount in 'avar' must match 'fvar'; if it disagrees, do not apply avar.
  if (axisCount !== expectedAxisCount) return undefined;

  const segmentMaps: AvarSegmentMap[] = [];
  let cursor = rec.offset + 8;
  const tableEnd = rec.offset + rec.length;

  for (let a = 0; a < axisCount; a++) {
    if (cursor + 2 > data.length || cursor + 2 > tableEnd) return undefined;
    const positionMapCount = view.getUint16(cursor, false);
    cursor += 2;

    const recordsBytes = positionMapCount * 4;
    if (cursor + recordsBytes > data.length || cursor + recordsBytes > tableEnd) {
      return undefined;
    }

    const maps: Array<{ fromCoordinate: number; toCoordinate: number }> = [];
    for (let i = 0; i < positionMapCount; i++) {
      const from = readF2Dot14(view, cursor);
      const to = readF2Dot14(view, cursor + 2);
      maps.push({ fromCoordinate: from, toCoordinate: to });
      cursor += 4;
    }
    segmentMaps.push(maps);
  }

  return segmentMaps;
}

// ---------------------------------------------------------------------------
// 'fvar' parsing
// ---------------------------------------------------------------------------
//
// 'fvar' header (16 bytes):
//   uint16   majorVersion   (=1)
//   uint16   minorVersion   (=0)
//   Offset16 axesArrayOffset (from start of table to the axes array)
//   uint16   reserved       (permanently reserved; =2)
//   uint16   axisCount
//   uint16   axisSize       (=20 for this version)
//   uint16   instanceCount
//   uint16   instanceSize   (= axisCount*sizeof(Fixed)+4, or +6 with PS name)
// VariationAxisRecord (20 bytes):
//   Tag   axisTag
//   Fixed minValue, defaultValue, maxValue
//   uint16 flags, uint16 axisNameID
// InstanceRecord:
//   uint16 subfamilyNameID
//   uint16 flags
//   Fixed  coordinates[axisCount]            (UserTuple)
//   uint16 postScriptNameID                  (optional)

/**
 * Parse the variable-font model from raw OpenType/TrueType font bytes.
 *
 * If the font has no 'fvar' table (or it is malformed / has zero axes), the
 * font is treated as non-variable and
 * `{ isVariable: false, axes: [], namedInstances: [] }` is returned.
 *
 * @param fontData Raw font file bytes (sfnt: TrueType 0x00010000 or 'OTTO' CFF).
 * @returns The parsed {@link VariableFontInfo}.
 */
export function parseVariableFont(fontData: Uint8Array): VariableFontInfo {
  const notVariable: VariableFontInfo = {
    isVariable: false,
    axes: [],
    namedInstances: [],
  };

  const tables = readTableDirectory(fontData);
  if (!tables) return notVariable;

  const fvar = tables.get('fvar');
  if (!fvar) return notVariable;

  // The fvar header is 16 bytes; bail out if the table is truncated.
  if (fvar.offset + 16 > fontData.length) return notVariable;

  const view = new DataView(fontData.buffer, fontData.byteOffset, fontData.byteLength);

  const majorVersion = view.getUint16(fvar.offset, false);
  if (majorVersion !== 1) return notVariable; // only fvar version 1.x is defined

  const axesArrayOffset = view.getUint16(fvar.offset + 4, false);
  const axisCount = view.getUint16(fvar.offset + 8, false);
  const axisSize = view.getUint16(fvar.offset + 10, false);
  const instanceCount = view.getUint16(fvar.offset + 12, false);
  const instanceSize = view.getUint16(fvar.offset + 14, false);

  // axisCount == 0 means the font is not functional as a variable font.
  if (axisCount === 0) return notVariable;

  // axisSize must be at least 20 (the defined VariationAxisRecord size). The
  // spec allows future minor versions to extend the record; we read the first
  // 20 bytes of each record and skip the remainder using axisSize.
  if (axisSize < 20) return notVariable;

  // ---- Parse axes ----
  const axes: VariationAxis[] = [];
  const axesStart = fvar.offset + axesArrayOffset;
  const axesBytes = axisCount * axisSize;
  if (axesStart + axesBytes > fontData.length) return notVariable;

  for (let i = 0; i < axisCount; i++) {
    const recOff = axesStart + i * axisSize;
    const tag = String.fromCharCode(
      view.getUint8(recOff),
      view.getUint8(recOff + 1),
      view.getUint8(recOff + 2),
      view.getUint8(recOff + 3),
    );
    const minValue = readFixed(view, recOff + 4);
    const defaultValue = readFixed(view, recOff + 8);
    const maxValue = readFixed(view, recOff + 12);
    const flags = view.getUint16(recOff + 16, false);
    // axisNameID at recOff + 18 — preserved as flags+name model only; the
    // human-readable name is not resolved (see module header). We deliberately
    // leave `name` undefined and do not surface the numeric axisNameID on the
    // axis interface (the task's VariationAxis shape has no axisNameID field).
    axes.push({ tag, minValue, defaultValue, maxValue, flags, name: undefined });
  }

  // ---- Parse named instances ----
  // The instances array directly follows the axes array.
  // Determine whether postScriptNameID is present from instanceSize:
  //   axisCount*4 + 6 => present; axisCount*4 + 4 => absent.
  const coordsBytes = axisCount * 4; // axisCount Fixed values
  const baseInstanceSize = coordsBytes + 4; // subfamilyNameID + flags + coords
  const hasPostScriptName = instanceSize >= baseInstanceSize + 2;

  const namedInstances: NamedInstance[] = [];
  const instancesStart = axesStart + axesBytes;

  // Only parse instances if instanceSize is sane and the data is present.
  if (instanceSize >= baseInstanceSize) {
    const instancesBytes = instanceCount * instanceSize;
    if (instancesStart + instancesBytes <= fontData.length) {
      for (let i = 0; i < instanceCount; i++) {
        const recOff = instancesStart + i * instanceSize;
        const subfamilyNameID = view.getUint16(recOff, false);
        // recOff + 2: flags (reserved, ignored)
        const coordinates: Record<string, number> = {};
        for (let a = 0; a < axisCount; a++) {
          const value = readFixed(view, recOff + 4 + a * 4);
          const axis = axes[a]!;
          coordinates[axis.tag] = value;
        }

        const instance: NamedInstance = {
          nameId: subfamilyNameID,
          coordinates,
          name: undefined,
        };

        if (hasPostScriptName) {
          const psNameId = view.getUint16(recOff + 4 + coordsBytes, false);
          // 0xFFFF means "no PostScript name" per spec → treat as absent.
          instance.postScriptNameId = psNameId === 0xffff ? undefined : psNameId;
        }

        namedInstances.push(instance);
      }
    }
  }

  // ---- Parse optional 'avar' table ----
  let avar: AvarSegmentMap[] | undefined;
  const avarRec = tables.get('avar');
  if (avarRec) {
    avar = parseAvar(fontData, avarRec, axisCount);
  }

  const info: VariableFontInfo = {
    isVariable: true,
    axes,
    namedInstances,
  };
  if (avar) info.avar = avar;
  return info;
}

// ---------------------------------------------------------------------------
// Coordinate normalization
// ---------------------------------------------------------------------------

/**
 * Apply an 'avar' segment map to a default-normalized coordinate.
 *
 * The segment map is an ordered list of (from, to) pairs in normalized space.
 * The input is located between two consecutive `fromCoordinate` nodes and the
 * output is linearly interpolated between the corresponding `toCoordinate`
 * values. Per spec, a valid map includes the mandatory nodes (-1,-1), (0,0),
 * (1,1); if it does not span the input, the input is clamped to the map's
 * endpoints.
 */
function applyAvarSegmentMap(value: number, segmentMap: AvarSegmentMap): number {
  const n = segmentMap.length;
  if (n === 0) return value;

  // The spec requires the maps to be sorted by ascending fromCoordinate and to
  // include at least the three identity nodes when any map is present. We do
  // not re-sort; we rely on the spec ordering and find the bracketing segment.

  const first = segmentMap[0]!;
  if (value <= first.fromCoordinate) return first.toCoordinate;

  const last = segmentMap[n - 1]!;
  if (value >= last.fromCoordinate) return last.toCoordinate;

  for (let i = 1; i < n; i++) {
    const lo = segmentMap[i - 1]!;
    const hi = segmentMap[i]!;
    if (value >= lo.fromCoordinate && value <= hi.fromCoordinate) {
      const span = hi.fromCoordinate - lo.fromCoordinate;
      if (span <= 0) return lo.toCoordinate; // degenerate segment
      const t = (value - lo.fromCoordinate) / span;
      return lo.toCoordinate + t * (hi.toCoordinate - lo.toCoordinate);
    }
  }

  // Unreachable given the endpoint guards above, but keep it total.
  return value;
}

/**
 * Normalize a user-scale coordinate for an axis to the normalized [-1, 0, +1]
 * scale, per the OpenType default-normalization algorithm.
 *
 * Steps:
 *  1. Clamp `userValue` to the axis's [minValue, maxValue].
 *  2. Map to normalized space: minValue→-1, defaultValue→0, maxValue→+1, with
 *     linear interpolation on each side of the default (note: the slopes on the
 *     two sides differ unless the default is exactly centered).
 *  3. If an 'avar' `segmentMap` is supplied, apply it to the result; otherwise
 *     no avar adjustment is made (the caller can pass `info.avar[axisIndex]`).
 *
 * @param axis       The axis whose user-scale bounds define the normalization.
 * @param userValue  The user-scale coordinate (e.g. 250 for a 'wght' axis).
 * @param avar       Optional 'avar' segment map for this axis.
 * @returns The normalized coordinate in [-1, 1].
 */
export function normalizeAxisCoordinate(
  axis: VariationAxis,
  userValue: number,
  avar?: AvarSegmentMap | undefined,
): number {
  const { minValue, defaultValue, maxValue } = axis;

  // Step 1: clamp to [min, max].
  let v = userValue;
  if (v < minValue) v = minValue;
  else if (v > maxValue) v = maxValue;

  // Step 2: default normalization (OpenType pseudocode).
  let normalized: number;
  if (v < defaultValue) {
    const denom = defaultValue - minValue;
    normalized = denom === 0 ? 0 : -(defaultValue - v) / denom;
  } else if (v > defaultValue) {
    const denom = maxValue - defaultValue;
    normalized = denom === 0 ? 0 : (v - defaultValue) / denom;
  } else {
    normalized = 0;
  }

  // Guard against tiny FP drift outside [-1, 1].
  if (normalized < -1) normalized = -1;
  else if (normalized > 1) normalized = 1;

  // Step 3: optional avar adjustment.
  if (avar && avar.length > 0) {
    normalized = applyAvarSegmentMap(normalized, avar);
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Instance coordinate resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a named instance's coordinates against the font's axes.
 *
 * Produces a complete axis-tag → user-scale-coordinate map covering every axis
 * in the font: any axis the instance does not specify is filled with that
 * axis's `defaultValue`, and any specified coordinate is clamped to the axis's
 * [minValue, maxValue] range (per the fvar "Variation Instance Selection"
 * rules). Coordinates for tags not present on any axis are ignored.
 *
 * @param info     The parsed variable-font model.
 * @param instance The named instance to resolve.
 * @returns A validated axis-tag → user-scale coordinate map.
 */
export function resolveInstanceCoordinates(
  info: VariableFontInfo,
  instance: NamedInstance,
): Record<string, number> {
  const resolved: Record<string, number> = {};

  for (const axis of info.axes) {
    const provided = instance.coordinates[axis.tag];
    let value = provided ?? axis.defaultValue;

    // Clamp to the axis range per the fvar instance-selection rules.
    if (value < axis.minValue) value = axis.minValue;
    else if (value > axis.maxValue) value = axis.maxValue;

    resolved[axis.tag] = value;
  }

  return resolved;
}
