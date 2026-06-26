/**
 * Tests for halftone dictionaries and transfer functions
 * (ISO 32000-2 §10.5 / §10.6).
 *
 * Covers:
 * - buildType1Halftone() — /Type /Halftone, /HalftoneType 1, numeric
 *   Frequency/Angle, /SpotFunction name, optional /AccurateScreens
 * - buildThresholdHalftone() — stream with /HalftoneType 6/10/16,
 *   /Width, /Height, and the raw byte data + /Length
 * - buildType5Halftone() — /HalftoneType 5 with colorant keys + /Default
 * - STANDARD_SPOT_FUNCTIONS — known names present
 * - identityTransferFunction / buildSampledTransferFunction / nameHalftone
 */

import { describe, it, expect } from 'vitest';
import {
  buildType1Halftone,
  buildThresholdHalftone,
  buildType5Halftone,
  identityTransferFunction,
  buildSampledTransferFunction,
  nameHalftone,
  STANDARD_SPOT_FUNCTIONS,
} from '../../../src/core/halftone.js';
import {
  PdfArray,
  PdfBool,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfString,
  type ByteWriter,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  let out = '';
  const writer: ByteWriter = {
    write(data: Uint8Array): void {
      out += new TextDecoder('latin1').decode(data);
    },
    writeString(str: string): void {
      out += str;
    },
  };
  obj.serialize(writer);
  return out;
}

// ---------------------------------------------------------------------------
// Type 1 halftone
// ---------------------------------------------------------------------------

describe('buildType1Halftone()', () => {
  it('emits /Type /Halftone /HalftoneType 1 with Frequency/Angle/SpotFunction', () => {
    const ht = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });

    expect(ht).toBeInstanceOf(PdfDict);
    expect(ht.get('/Type')).toBe(PdfName.of('Halftone'));
    expect(ht.get('/HalftoneType')).toEqual(PdfNumber.of(1));

    const freq = ht.get('/Frequency');
    const angle = ht.get('/Angle');
    expect(freq).toBeInstanceOf(PdfNumber);
    expect(angle).toBeInstanceOf(PdfNumber);
    expect((freq as PdfNumber).value).toBe(60);
    expect((angle as PdfNumber).value).toBe(45);

    expect(ht.get('/SpotFunction')).toBe(PdfName.of('Round'));
    // AccurateScreens omitted when not requested.
    expect(ht.has('/AccurateScreens')).toBe(false);
  });

  it('serializes to valid PDF with the spot function as a name', () => {
    const ht = buildType1Halftone({
      frequency: 53.5,
      angle: 30,
      spotFunction: 'Ellipse',
    });
    const s = serialize(ht);
    expect(s).toContain('/Type /Halftone');
    expect(s).toContain('/HalftoneType 1');
    expect(s).toContain('/Frequency 53.5');
    expect(s).toContain('/Angle 30');
    expect(s).toContain('/SpotFunction /Ellipse');
  });

  it('emits /AccurateScreens true when requested', () => {
    const ht = buildType1Halftone({
      frequency: 75,
      angle: 0,
      spotFunction: 'SimpleDot',
      accurateScreens: true,
    });
    expect(ht.get('/AccurateScreens')).toBe(PdfBool.TRUE);
    expect(serialize(ht)).toContain('/AccurateScreens true');
  });

  it('emits /AccurateScreens false when explicitly disabled', () => {
    const ht = buildType1Halftone({
      frequency: 75,
      angle: 0,
      spotFunction: 'Line',
      accurateScreens: false,
    });
    expect(ht.get('/AccurateScreens')).toBe(PdfBool.FALSE);
  });
});

// ---------------------------------------------------------------------------
// Threshold halftones
// ---------------------------------------------------------------------------

describe('buildThresholdHalftone()', () => {
  it('emits a Type 6 stream with Width/Height and byte data', () => {
    const data = new Uint8Array([0, 64, 128, 192, 255, 32, 96, 160]);
    const ht = buildThresholdHalftone(6, 4, 2, data);

    expect(ht).toBeInstanceOf(PdfStream);
    expect(ht.dict.get('/Type')).toBe(PdfName.of('Halftone'));
    expect(ht.dict.get('/HalftoneType')).toEqual(PdfNumber.of(6));
    expect((ht.dict.get('/Width') as PdfNumber).value).toBe(4);
    expect((ht.dict.get('/Height') as PdfNumber).value).toBe(2);
    expect(ht.data).toBe(data);
    expect((ht.dict.get('/Length') as PdfNumber).value).toBe(8);

    const s = serialize(ht);
    expect(s).toContain('/HalftoneType 6');
    expect(s).toContain('/Width 4');
    expect(s).toContain('/Height 2');
    expect(s).toContain('stream');
    expect(s).toContain('endstream');
  });

  it('supports Type 10 threshold streams', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const ht = buildThresholdHalftone(10, 2, 2, data);
    expect((ht.dict.get('/HalftoneType') as PdfNumber).value).toBe(10);
    expect(ht.data.length).toBe(4);
  });

  it('supports Type 16 (16-bit) threshold streams', () => {
    // 2x1 with 16-bit samples => 4 bytes.
    const data = new Uint8Array([0x00, 0x80, 0xff, 0x00]);
    const ht = buildThresholdHalftone(16, 2, 1, data);
    expect((ht.dict.get('/HalftoneType') as PdfNumber).value).toBe(16);
    expect((ht.dict.get('/Length') as PdfNumber).value).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Type 5 halftone
// ---------------------------------------------------------------------------

describe('buildType5Halftone()', () => {
  it('emits /HalftoneType 5, colorant keys and /Default', () => {
    const cyan = buildType1Halftone({
      frequency: 60,
      angle: 15,
      spotFunction: 'Round',
    });
    const magenta = buildType1Halftone({
      frequency: 60,
      angle: 75,
      spotFunction: 'Round',
    });
    const def = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });

    const ht = buildType5Halftone({ Cyan: cyan, Magenta: magenta }, def);

    expect(ht).toBeInstanceOf(PdfDict);
    expect(ht.get('/Type')).toBe(PdfName.of('Halftone'));
    expect(ht.get('/HalftoneType')).toEqual(PdfNumber.of(5));
    expect(ht.get('/Cyan')).toBe(cyan);
    expect(ht.get('/Magenta')).toBe(magenta);
    expect(ht.get('/Default')).toBe(def);

    const s = serialize(ht);
    expect(s).toContain('/HalftoneType 5');
    expect(s).toContain('/Cyan');
    expect(s).toContain('/Magenta');
    expect(s).toContain('/Default');
  });

  it('ignores a colorant named Default in favour of the explicit default', () => {
    const def = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });
    const bogus = buildType1Halftone({
      frequency: 1,
      angle: 1,
      spotFunction: 'Line',
    });
    const ht = buildType5Halftone({ Default: bogus, Black: def }, def);
    expect(ht.get('/Default')).toBe(def);
    expect(ht.get('/Default')).not.toBe(bogus);
    expect(ht.get('/Black')).toBe(def);
  });

  it('accepts threshold halftones (streams) as colorant values', () => {
    const thresh = buildThresholdHalftone(6, 2, 2, new Uint8Array([0, 1, 2, 3]));
    const def = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });
    // A PdfStream is a valid PdfObject; the dict stores it under /Spot.
    const ht = new PdfDict();
    ht.set('/Type', PdfName.of('Halftone'));
    ht.set('/HalftoneType', PdfNumber.of(5));
    ht.set('/Spot', thresh);
    ht.set('/Default', def);
    expect(ht.get('/Spot')).toBeInstanceOf(PdfStream);
  });
});

// ---------------------------------------------------------------------------
// Standard spot functions
// ---------------------------------------------------------------------------

describe('STANDARD_SPOT_FUNCTIONS', () => {
  it('includes the common predefined spot functions', () => {
    expect(STANDARD_SPOT_FUNCTIONS).toContain('SimpleDot');
    expect(STANDARD_SPOT_FUNCTIONS).toContain('Round');
    expect(STANDARD_SPOT_FUNCTIONS).toContain('Ellipse');
    expect(STANDARD_SPOT_FUNCTIONS).toContain('Line');
    expect(STANDARD_SPOT_FUNCTIONS).toContain('Diamond');
  });

  it('has no duplicate names', () => {
    const set = new Set(STANDARD_SPOT_FUNCTIONS);
    expect(set.size).toBe(STANDARD_SPOT_FUNCTIONS.length);
  });
});

// ---------------------------------------------------------------------------
// Transfer functions
// ---------------------------------------------------------------------------

describe('transfer functions', () => {
  it('identityTransferFunction() returns /Identity', () => {
    const id = identityTransferFunction();
    expect(id).toBe(PdfName.of('Identity'));
    expect(serialize(id)).toBe('/Identity');
  });

  it('buildSampledTransferFunction() emits a Type 0 function stream', () => {
    const samples = new Uint8Array([0, 85, 170, 255]);
    const fn = buildSampledTransferFunction(samples);

    expect(fn).toBeInstanceOf(PdfStream);
    expect((fn.dict.get('/FunctionType') as PdfNumber).value).toBe(0);
    expect((fn.dict.get('/BitsPerSample') as PdfNumber).value).toBe(8);
    expect(fn.dict.get('/Domain')).toBeInstanceOf(PdfArray);
    expect(fn.dict.get('/Range')).toBeInstanceOf(PdfArray);

    const size = fn.dict.get('/Size') as PdfArray;
    expect(size.length).toBe(1);
    expect((size.items[0] as PdfNumber).value).toBe(4);
    expect((fn.dict.get('/Length') as PdfNumber).value).toBe(4);
  });

  it('buildSampledTransferFunction() rejects an empty sample table', () => {
    expect(() => buildSampledTransferFunction(new Uint8Array())).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// nameHalftone
// ---------------------------------------------------------------------------

describe('nameHalftone()', () => {
  it('sets /HalftoneName as a literal string when given a name', () => {
    const ht = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });
    const named = nameHalftone(ht, 'MyScreen');
    expect(named).toBe(ht);
    const hn = ht.get('/HalftoneName');
    expect(hn).toBeInstanceOf(PdfString);
    expect((hn as PdfString).value).toBe('MyScreen');
  });

  it('leaves the halftone untouched when no name is given', () => {
    const ht = buildType1Halftone({
      frequency: 60,
      angle: 45,
      spotFunction: 'Round',
    });
    nameHalftone(ht);
    expect(ht.has('/HalftoneName')).toBe(false);
  });
});
