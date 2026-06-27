/**
 * Tests for OpenType variable-font axis/instance parsing (variableFont.ts).
 *
 * Verifies:
 * 1. A NON-variable font (no 'fvar' table) → { isVariable: false, axes: [], namedInstances: [] }.
 * 2. A hand-built minimal variable font (1 'wght' axis 100..400..900, 1 named
 *    instance) parses with correct axis bounds, flags, nameIds, and instance
 *    coordinates.
 * 3. normalizeAxisCoordinate maps user values into normalized [-1, 0, +1]
 *    per the OpenType default-normalization algorithm.
 * 4. An 'avar' segment map further modifies the normalized coordinate.
 * 5. resolveInstanceCoordinates passes through / validates instance coords.
 *
 * --- HAND-BUILT FIXTURE DOCUMENTATION ---
 *
 * The fvar fixture is built per the OpenType 'fvar' spec
 * (https://learn.microsoft.com/en-us/typography/opentype/spec/fvar):
 *
 *   fvar header (16 bytes):
 *     majorVersion=1 (uint16), minorVersion=0 (uint16),
 *     axesArrayOffset=16 (Offset16), reserved=2 (uint16),
 *     axisCount=1 (uint16), axisSize=20 (uint16),
 *     instanceCount=1 (uint16), instanceSize=axisCount*4+6=10 (uint16)
 *       (instanceSize 10 => postScriptNameID IS present)
 *
 *   VariationAxisRecord (20 bytes):
 *     axisTag='wght' (Tag/4 bytes),
 *     minValue=100.0, defaultValue=400.0, maxValue=900.0 (each Fixed 16.16),
 *     flags=0x0000 (uint16), axisNameID=256 (uint16)
 *
 *   InstanceRecord (10 bytes, since instanceSize = 1*4 + 6):
 *     subfamilyNameID=257 (uint16), flags=0 (uint16),
 *     coordinates[0]=400.0 (Fixed 16.16), postScriptNameID=258 (uint16)
 *
 * Fixed 16.16 encoding: value * 65536, stored big-endian as int32.
 *   100.0  => 0x00640000
 *   400.0  => 0x01900000
 *   900.0  => 0x03840000
 *
 * The fvar table is wrapped in a minimal sfnt (offset table + table directory)
 * with a single 'fvar' table record. sfnt version 0x00010000 (TrueType).
 *
 * The avar fixture (https://learn.microsoft.com/en-us/typography/opentype/spec/avar):
 *   header: majorVersion=1, minorVersion=0, reserved=0, axisCount=1 (each uint16)
 *   SegmentMaps[0]: positionMapCount=5 (uint16), then 5 AxisValueMap records.
 *   AxisValueMap: fromCoordinate (F2DOT14), toCoordinate (F2DOT14).
 *   F2DOT14 encoding: value * 16384, stored big-endian as int16.
 *   Maps: (-1,-1) (0,0) (1,1) are mandatory; we add (-0.5 -> -0.75) to bend
 *   the lower half so a default-normalized -0.5 maps to -0.75.
 */

import { describe, it, expect } from 'vitest';
import {
  parseVariableFont,
  normalizeAxisCoordinate,
  resolveInstanceCoordinates,
  type VariationAxis,
} from '../../../../src/assets/font/variableFont.js';

// ---------------------------------------------------------------------------
// Fixed-point encoding helpers (verified against OpenType Data Types)
// ---------------------------------------------------------------------------

/** Encode a number as Fixed (16.16): value * 65536 as a big-endian int32. */
function fixed(view: DataView, off: number, value: number): void {
  view.setInt32(off, Math.round(value * 65536), false);
}

/** Encode a number as F2DOT14: value * 16384 as a big-endian int16. */
function f2dot14(view: DataView, off: number, value: number): void {
  view.setInt16(off, Math.round(value * 16384), false);
}

function writeTag(buf: Uint8Array, off: number, tag: string): void {
  for (let i = 0; i < 4; i++) buf[off + i] = tag.charCodeAt(i);
}

// ---------------------------------------------------------------------------
// Build the raw 'fvar' table bytes (no sfnt wrapper)
// ---------------------------------------------------------------------------

interface FvarFixtureOptions {
  /** If true, write instanceSize without postScriptNameID (axisCount*4 + 4). */
  omitPostScriptNameId?: boolean;
}

function buildFvarTable(opts: FvarFixtureOptions = {}): Uint8Array {
  const axisCount = 1;
  const axisSize = 20;
  const withPsName = !opts.omitPostScriptNameId;
  const instanceSize = axisCount * 4 + (withPsName ? 6 : 4); // 10 or 8
  const instanceCount = 1;

  const headerSize = 16;
  const axesSize = axisCount * axisSize; // 20
  const instancesSize = instanceCount * instanceSize;
  const total = headerSize + axesSize + instancesSize;

  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);

  // --- fvar header (16 bytes) ---
  view.setUint16(0, 1, false); // majorVersion
  view.setUint16(2, 0, false); // minorVersion
  view.setUint16(4, headerSize, false); // axesArrayOffset = 16
  view.setUint16(6, 2, false); // reserved (spec: set to 2)
  view.setUint16(8, axisCount, false); // axisCount
  view.setUint16(10, axisSize, false); // axisSize = 20
  view.setUint16(12, instanceCount, false); // instanceCount
  view.setUint16(14, instanceSize, false); // instanceSize

  // --- VariationAxisRecord (20 bytes) at offset 16 ---
  const axisOff = headerSize;
  writeTag(buf, axisOff, 'wght'); // axisTag
  fixed(view, axisOff + 4, 100); // minValue
  fixed(view, axisOff + 8, 400); // defaultValue
  fixed(view, axisOff + 12, 900); // maxValue
  view.setUint16(axisOff + 16, 0x0000, false); // flags
  view.setUint16(axisOff + 18, 256, false); // axisNameID

  // --- InstanceRecord at offset 36 ---
  const instOff = headerSize + axesSize;
  view.setUint16(instOff, 257, false); // subfamilyNameID
  view.setUint16(instOff + 2, 0, false); // flags
  fixed(view, instOff + 4, 400); // coordinates[0] = 400
  if (withPsName) {
    view.setUint16(instOff + 8, 258, false); // postScriptNameID
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Build the raw 'avar' table bytes
// ---------------------------------------------------------------------------

function buildAvarTable(): Uint8Array {
  // axisCount=1, segment map with 5 records:
  //   (-1,-1) (-0.5,-0.75) (0,0) (0.5,0.5) (1,1)
  const positionMapCount = 5;
  const headerSize = 8; // major, minor, reserved, axisCount
  const segMapSize = 2 + positionMapCount * 4; // count + records (4 bytes each)
  const total = headerSize + segMapSize;

  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);

  view.setUint16(0, 1, false); // majorVersion
  view.setUint16(2, 0, false); // minorVersion
  view.setUint16(4, 0, false); // reserved
  view.setUint16(6, 1, false); // axisCount

  let off = headerSize;
  view.setUint16(off, positionMapCount, false);
  off += 2;
  const maps: Array<[number, number]> = [
    [-1, -1],
    [-0.5, -0.75],
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ];
  for (const [from, to] of maps) {
    f2dot14(view, off, from);
    f2dot14(view, off + 2, to);
    off += 4;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Wrap one or more tables in a minimal sfnt (offset table + table directory)
// ---------------------------------------------------------------------------

function wrapSfnt(tables: Array<{ tag: string; data: Uint8Array }>): Uint8Array {
  const numTables = tables.length;
  const headerSize = 12;
  const dirSize = numTables * 16;
  let totalSize = headerSize + dirSize;
  for (const t of tables) totalSize += (t.data.length + 3) & ~3;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Offset table
  view.setUint32(0, 0x00010000, false); // sfnt version (TrueType)
  view.setUint16(4, numTables, false);
  // searchRange / entrySelector / rangeShift
  let sr = 1, es = 0;
  while (sr * 2 <= numTables) { sr *= 2; es++; }
  sr *= 16;
  view.setUint16(6, sr, false);
  view.setUint16(8, es, false);
  view.setUint16(10, numTables * 16 - sr, false);

  let recordOff = headerSize;
  let dataOff = headerSize + dirSize;
  for (const t of tables) {
    writeTag(buf, recordOff, t.tag);
    view.setUint32(recordOff + 4, 0, false); // checksum (unused for parsing)
    view.setUint32(recordOff + 8, dataOff, false);
    view.setUint32(recordOff + 12, t.data.length, false);
    buf.set(t.data, dataOff);
    recordOff += 16;
    dataOff += (t.data.length + 3) & ~3;
  }

  return buf;
}

// A font with no 'fvar' table — minimal sfnt with only a 'cmap' placeholder.
function buildNonVariableFont(): Uint8Array {
  const placeholder = new Uint8Array(8); // arbitrary non-fvar table bytes
  return wrapSfnt([{ tag: 'cmap', data: placeholder }]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseVariableFont', () => {
  it('returns isVariable=false for a non-variable font (no fvar table)', () => {
    const info = parseVariableFont(buildNonVariableFont());
    expect(info.isVariable).toBe(false);
    expect(info.axes).toEqual([]);
    expect(info.namedInstances).toEqual([]);
  });

  it('returns isVariable=false for too-small / garbage input', () => {
    expect(parseVariableFont(new Uint8Array(2)).isVariable).toBe(false);
    const garbage = new Uint8Array(64);
    for (let i = 0; i < garbage.length; i++) garbage[i] = i;
    expect(parseVariableFont(garbage).isVariable).toBe(false);
  });

  it('parses axis bounds, flags, and name IDs from a hand-built fvar', () => {
    const font = wrapSfnt([{ tag: 'fvar', data: buildFvarTable() }]);
    const info = parseVariableFont(font);

    expect(info.isVariable).toBe(true);
    expect(info.axes).toHaveLength(1);

    const axis = info.axes[0]!;
    expect(axis.tag).toBe('wght');
    expect(axis.minValue).toBeCloseTo(100, 5);
    expect(axis.defaultValue).toBeCloseTo(400, 5);
    expect(axis.maxValue).toBeCloseTo(900, 5);
    expect(axis.flags).toBe(0);
    // name not resolved (no name table) → undefined
    expect(axis.name).toBeUndefined();
  });

  it('parses the named instance coordinates and name IDs', () => {
    const font = wrapSfnt([{ tag: 'fvar', data: buildFvarTable() }]);
    const info = parseVariableFont(font);

    expect(info.namedInstances).toHaveLength(1);
    const inst = info.namedInstances[0]!;
    expect(inst.nameId).toBe(257);
    expect(inst.postScriptNameId).toBe(258);
    expect(inst.coordinates).toEqual({ wght: 400 });
  });

  it('omits postScriptNameId when instanceSize = axisCount*4 + 4', () => {
    const font = wrapSfnt([
      { tag: 'fvar', data: buildFvarTable({ omitPostScriptNameId: true }) },
    ]);
    const info = parseVariableFont(font);

    expect(info.namedInstances).toHaveLength(1);
    const inst = info.namedInstances[0]!;
    expect(inst.nameId).toBe(257);
    expect(inst.postScriptNameId).toBeUndefined();
    expect(inst.coordinates).toEqual({ wght: 400 });
  });
});

describe('normalizeAxisCoordinate', () => {
  const wght: VariationAxis = {
    tag: 'wght',
    minValue: 100,
    defaultValue: 400,
    maxValue: 900,
    flags: 0,
  };

  it('maps default value to 0', () => {
    expect(normalizeAxisCoordinate(wght, 400)).toBeCloseTo(0, 6);
  });

  it('maps min value to -1 and max value to +1', () => {
    expect(normalizeAxisCoordinate(wght, 100)).toBeCloseTo(-1, 6);
    expect(normalizeAxisCoordinate(wght, 900)).toBeCloseTo(1, 6);
  });

  it('maps wght=250 into (-1, 0) per default normalization', () => {
    // 250 < default(400): -(400-250)/(400-100) = -150/300 = -0.5
    const n = normalizeAxisCoordinate(wght, 250);
    expect(n).toBeCloseTo(-0.5, 6);
    expect(n).toBeGreaterThan(-1);
    expect(n).toBeLessThan(0);
  });

  it('maps a value above default into (0, 1)', () => {
    // 700 > default(400): (700-400)/(900-400) = 300/500 = 0.6
    expect(normalizeAxisCoordinate(wght, 700)).toBeCloseTo(0.6, 6);
  });

  it('clamps out-of-range user values to [min, max]', () => {
    expect(normalizeAxisCoordinate(wght, 50)).toBeCloseTo(-1, 6);
    expect(normalizeAxisCoordinate(wght, 5000)).toBeCloseTo(1, 6);
  });

  it('applies an avar segment map when provided', () => {
    // Parse the avar table into the structure the function expects.
    const font = wrapSfnt([
      { tag: 'fvar', data: buildFvarTable() },
      { tag: 'avar', data: buildAvarTable() },
    ]);
    const info = parseVariableFont(font);
    expect(info.avar).toBeDefined();

    const axis = info.axes[0]!;
    const segMap = info.avar![0];

    // wght=250 default-normalizes to -0.5, which the avar maps to -0.75.
    const n = normalizeAxisCoordinate(axis, 250, segMap);
    expect(n).toBeCloseTo(-0.75, 5);

    // wght=400 (default) stays 0 -> 0.
    expect(normalizeAxisCoordinate(axis, 400, segMap)).toBeCloseTo(0, 5);

    // A point between avar nodes interpolates linearly:
    // default-normalized -0.25 lies between (-0.5,-0.75) and (0,0):
    //   t = (-0.25 - -0.5)/(0 - -0.5) = 0.5; to = -0.75 + 0.5*(0 - -0.75) = -0.375
    // wght value for default-norm -0.25: 400 + (-0.25 * 300) = 325
    expect(normalizeAxisCoordinate(axis, 325, segMap)).toBeCloseTo(-0.375, 5);
  });
});

describe('resolveInstanceCoordinates', () => {
  it('returns instance coordinates filled out for all axes', () => {
    const font = wrapSfnt([{ tag: 'fvar', data: buildFvarTable() }]);
    const info = parseVariableFont(font);
    const inst = info.namedInstances[0]!;

    const coords = resolveInstanceCoordinates(info, inst);
    expect(coords).toEqual({ wght: 400 });
  });

  it('fills missing axis coordinates with the axis default value', () => {
    const font = wrapSfnt([{ tag: 'fvar', data: buildFvarTable() }]);
    const info = parseVariableFont(font);

    // An instance missing the wght coordinate should fall back to default (400).
    const partial = { nameId: 999, coordinates: {} };
    const coords = resolveInstanceCoordinates(info, partial);
    expect(coords).toEqual({ wght: 400 });
  });
});
