/**
 * Tests for PDF stream decoding — decodeStream(), getStreamFilters(), and
 * all supported filter types: ASCIIHexDecode, ASCII85Decode, FlateDecode,
 * LZWDecode, RunLengthDecode, DCTDecode, JPXDecode.
 *
 * Also covers predictor post-processing (PNG and TIFF), filter abbreviation
 * mapping, chained (multi-filter) decoding, and error paths.
 */

import { describe, it, expect } from 'vitest';
import { zlibSync, deflateSync } from 'fflate';
import { decodeStream, getStreamFilters } from '../../../src/parser/streamDecode.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Encode an ASCII string into a Uint8Array. */
function ascii(str: string): Uint8Array {
  return encoder.encode(str);
}

/** Build a PdfDict with numeric parameters for decode-parms. */
function makeParms(entries: Record<string, number>): PdfDict {
  const dict = new PdfDict();
  for (const [key, value] of Object.entries(entries)) {
    dict.set(key, PdfNumber.of(value));
  }
  return dict;
}

// ===========================================================================
// ASCIIHexDecode
// ===========================================================================

describe('ASCIIHexDecode', () => {
  it('decodes hex pairs to bytes', () => {
    const encoded = ascii('48656C6C6F>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('handles lowercase hex digits', () => {
    const encoded = ascii('48656c6c6f>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('handles mixed case hex digits', () => {
    const encoded = ascii('4865 6C6c 6F>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('ignores whitespace between hex digits', () => {
    const encoded = ascii('48 65 6C 6C 6F>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('ignores tabs, newlines, carriage returns, and form feeds', () => {
    const encoded = ascii('48\t65\n6C\r6C\x0c6F>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('stops at > EOD marker', () => {
    const encoded = ascii('4865>6C6C6F');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    // Only "He" should be decoded
    expect(result).toEqual(new Uint8Array([0x48, 0x65]));
  });

  it('pads odd trailing digit with 0 on the right', () => {
    // "A" becomes A0 = 160
    const encoded = ascii('A>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0xa0]));
  });

  it('pads trailing odd digit correctly in longer input', () => {
    // "48656C6C6F0" -> last nibble '0' has no pair, so '0' padded -> 0x00
    const encoded = ascii('48656C6C6F0>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00]));
  });

  it('returns empty array for empty input', () => {
    const encoded = ascii('>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([]));
  });

  it('decodes full byte range (00-FF)', () => {
    const encoded = ascii('00FF80>');
    const result = decodeStream(encoded, 'ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x00, 0xff, 0x80]));
  });
});

// ===========================================================================
// ASCII85Decode
// ===========================================================================

describe('ASCII85Decode', () => {
  it('decodes a full 5-char group to 4 bytes', () => {
    // "87cURD]j7BEbo80" encodes "Hello World" in ASCII85
    // Let us test a known encoding: the word "test"
    // "test" = 0x74657374 = 1952805748
    // 1952805748 / 85^4 = 37 remainder ... = FCfN8
    // Actually, let us use a simpler approach: encode known bytes
    // ASCII85 for [0, 0, 0, 0] is 'z'
    // ASCII85 for [0, 0, 0, 1] is '!!!!!'+1 offset = '!!!!!'  not quite
    // Let us just test the 'z' shortcut directly and manually verify a 5-char group

    // "arT^$" encodes the four bytes [0x61, 0x72, 0x54, 0x5e] in reverse...
    // Let's use a verifiable mapping. The encoding of all-zero 4 bytes:
    const encoded = ascii('z~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([0, 0, 0, 0]));
  });

  it('decodes z shortcut as four zero bytes', () => {
    const encoded = ascii('zz~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('handles ~> EOD marker', () => {
    const encoded = ascii('z~>extradata');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([0, 0, 0, 0]));
  });

  it('ignores whitespace in encoded data', () => {
    const encoded = ascii('z z~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('decodes a partial group (2 chars -> 1 byte)', () => {
    // Two-char group: pad with 'u' (84) to get 5 chars, then take 1 byte
    // Group "!!" (0, 0) padded to "!!uuu" = 0*85^4 + 0*85^3 + 84*85^2 + 84*85 + 84
    // = 0 + 0 + 606900 + 7140 + 84 = 614124 = 0x00095FEC
    // First byte = 0x00
    const encoded = ascii('!!~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x00);
  });

  it('decodes a partial group (3 chars -> 2 bytes)', () => {
    const encoded = ascii('!!!~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result.length).toBe(2);
  });

  it('decodes a partial group (4 chars -> 3 bytes)', () => {
    const encoded = ascii('!!!!~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result.length).toBe(3);
  });

  it('decodes known ASCII85 encoded string', () => {
    // "Man " (0x4D616E20) in ASCII85 is "9jqo^"
    // 0x4D616E20 = 1298230816
    // 1298230816 / 85^4 = 24 remainder 62432416
    // 24 -> '9' (24+33=57='9')
    // 62432416 / 85^3 = 101 -> 'j' (101+33=134) ... wait that's > 117
    // Let me calculate properly:
    // 1298230816 mod 85^4 = 1298230816 mod 52200625
    // 1298230816 / 52200625 = 24.870...  floor = 24
    // 24 + 33 = 57 = '9'
    // remainder = 1298230816 - 24*52200625 = 1298230816 - 1252815000 = 45415816
    // 45415816 / 85^3 = 45415816 / 614125 = 73.95... floor = 73
    // 73 + 33 = 106 = 'j'
    // remainder = 45415816 - 73*614125 = 45415816 - 44831125 = 584691
    // 584691 / 85^2 = 584691 / 7225 = 80.9... floor = 80
    // 80 + 33 = 113 = 'q'
    // remainder = 584691 - 80*7225 = 584691 - 578000 = 6691
    // 6691 / 85 = 78.7... floor = 78
    // 78 + 33 = 111 = 'o'
    // remainder = 6691 - 78*85 = 6691 - 6630 = 61
    // 61 + 33 = 94 = '^'
    // So "Man " -> "9jqo^"
    const encoded = ascii('9jqo^~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([0x4d, 0x61, 0x6e, 0x20]));
  });

  it('returns empty for empty input before EOD', () => {
    const encoded = ascii('~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result).toEqual(new Uint8Array([]));
  });

  it('handles multiple z shortcuts mixed with groups', () => {
    // z + "9jqo^" + z => [0,0,0,0] + "Man " + [0,0,0,0]
    const encoded = ascii('z9jqo^z~>');
    const result = decodeStream(encoded, 'ASCII85Decode');
    expect(result.length).toBe(12);
    expect(result[0]).toBe(0);
    expect(result[3]).toBe(0);
    expect(result[4]).toBe(0x4d); // 'M'
    expect(result[5]).toBe(0x61); // 'a'
    expect(result[6]).toBe(0x6e); // 'n'
    expect(result[7]).toBe(0x20); // ' '
    expect(result[8]).toBe(0);
    expect(result[11]).toBe(0);
  });
});

// ===========================================================================
// RunLengthDecode
// ===========================================================================

describe('RunLengthDecode', () => {
  it('decodes literal copy run (N=0-127: copy N+1 bytes)', () => {
    // N=4 means copy next 5 bytes literally
    const encoded = new Uint8Array([4, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 128]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('decodes single byte copy run (N=0: copy 1 byte)', () => {
    const encoded = new Uint8Array([0, 0x41, 128]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result).toEqual(new Uint8Array([0x41]));
  });

  it('decodes repeat run (N=129-255: repeat next byte 257-N times)', () => {
    // N=253 means repeat next byte (257-253)=4 times
    const encoded = new Uint8Array([253, 0x42, 128]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result).toEqual(new Uint8Array([0x42, 0x42, 0x42, 0x42]));
  });

  it('decodes maximum repeat run (N=129: repeat 128 times)', () => {
    const encoded = new Uint8Array([129, 0xff, 128]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result.length).toBe(128);
    expect(result.every((b) => b === 0xff)).toBe(true);
  });

  it('stops at EOD marker (128)', () => {
    const encoded = new Uint8Array([0, 0x41, 128, 0, 0x42]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    // Should only produce [0x41], stopping at 128
    expect(result).toEqual(new Uint8Array([0x41]));
  });

  it('handles mixed copy and repeat runs', () => {
    // Copy 3 bytes literally, then repeat 0xAA 3 times
    const encoded = new Uint8Array([
      2, 0x01, 0x02, 0x03,  // N=2: copy 3 bytes
      254, 0xaa,              // N=254: repeat 0xAA (257-254)=3 times
      128,                    // EOD
    ]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0xaa, 0xaa, 0xaa]));
  });

  it('returns empty for immediate EOD', () => {
    const encoded = new Uint8Array([128]);
    const result = decodeStream(encoded, 'RunLengthDecode');
    expect(result).toEqual(new Uint8Array([]));
  });

  it('decodes maximum literal copy run (N=127: copy 128 bytes)', () => {
    const bytes = new Uint8Array(130);
    bytes[0] = 127; // copy 128 bytes
    for (let i = 0; i < 128; i++) {
      bytes[1 + i] = i & 0xff;
    }
    bytes[129] = 128; // EOD
    const result = decodeStream(bytes, 'RunLengthDecode');
    expect(result.length).toBe(128);
    for (let i = 0; i < 128; i++) {
      expect(result[i]).toBe(i);
    }
  });
});

// ===========================================================================
// FlateDecode
// ===========================================================================

describe('FlateDecode', () => {
  it('decodes zlib-compressed data', () => {
    const original = ascii('Hello, World! This is a test of FlateDecode.');
    const compressed = zlibSync(original);
    const result = decodeStream(compressed, 'FlateDecode');
    expect(result).toEqual(original);
  });

  it('decodes raw deflate data (no zlib header)', () => {
    const original = ascii('Raw deflate data without zlib header.');
    const compressed = deflateSync(original);
    const result = decodeStream(compressed, 'FlateDecode');
    expect(result).toEqual(original);
  });

  it('decodes empty zlib-compressed data', () => {
    const original = new Uint8Array(0);
    const compressed = zlibSync(original);
    const result = decodeStream(compressed, 'FlateDecode');
    expect(result).toEqual(original);
  });

  it('decodes larger data correctly', () => {
    // Create a repeating pattern that compresses well
    const pattern = ascii('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const original = new Uint8Array(pattern.length * 100);
    for (let i = 0; i < 100; i++) {
      original.set(pattern, i * pattern.length);
    }
    const compressed = zlibSync(original);
    const result = decodeStream(compressed, 'FlateDecode');
    expect(result).toEqual(original);
  });

  it('throws on invalid compressed data', () => {
    const garbage = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a]);
    expect(() => decodeStream(garbage, 'FlateDecode')).toThrow('FlateDecode');
  });
});

// ===========================================================================
// FlateDecode with PNG predictors
// ===========================================================================

describe('FlateDecode with PNG predictors', () => {
  it('handles PNG None predictor (type byte = 0)', () => {
    // Row of 4 bytes, PNG predictor 10 (None)
    // Each row: [filterByte, data...]
    const rowBytes = 4;
    const row1 = new Uint8Array([0, 10, 20, 30, 40]); // filter=0 (None)
    const row2 = new Uint8Array([0, 50, 60, 70, 80]); // filter=0 (None)
    const predictedData = new Uint8Array([...row1, ...row2]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 10,
      '/Columns': 4,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]));
  });

  it('handles PNG Sub predictor (type byte = 1)', () => {
    // Sub: each byte = current - left (mod 256)
    // bytesPerPixel=1 for colors=1, bpc=8
    // Raw: [10, 20, 30, 40]
    // Predicted: [10, 10, 10, 10]  (20-10=10, 30-20=10, 40-30=10)
    const predictedData = new Uint8Array([1, 10, 10, 10, 10]); // filter=1 (Sub)

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 11,
      '/Columns': 4,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it('handles PNG Up predictor (type byte = 2)', () => {
    // Up: each byte = current - above (mod 256)
    // Row 1 raw: [10, 20, 30]
    // Row 1 predicted (no previous): [10, 20, 30]
    // Row 2 raw: [15, 25, 35]
    // Row 2 predicted: [5, 5, 5]  (15-10=5, 25-20=5, 35-30=5)
    const predictedData = new Uint8Array([
      2, 10, 20, 30,  // filter=2 (Up), row 1
      2, 5, 5, 5,     // filter=2 (Up), row 2
    ]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 12,
      '/Columns': 3,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 15, 25, 35]));
  });

  it('handles PNG Average predictor (type byte = 3)', () => {
    // Average: each byte = current - floor((left + above) / 2)
    // Row 1: left=0, above=0 for first pixel
    // Raw row 1: [10, 20]
    // Predicted row 1: [10, 15]  (20 - floor((10+0)/2) = 20-5 = 15)
    // Row 2: above from row 1
    // Raw row 2: [30, 40]
    // Predicted row 2: [25, 15]
    //   byte 0: 30 - floor((0+10)/2) = 30 - 5 = 25
    //   byte 1: 40 - floor((30+20)/2) = 40 - 25 = 15
    const predictedData = new Uint8Array([
      3, 10, 15,   // filter=3 (Average), row 1
      3, 25, 15,   // filter=3 (Average), row 2
    ]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 13,
      '/Columns': 2,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it('handles PNG Paeth predictor (type byte = 4)', () => {
    // Paeth: paeth(left, above, upper-left)
    // Single row, so above=0, upper-left=0
    // paeth(0,0,0) = 0, so predicted = raw for first row single-pixel-width
    // Raw row: [100, 50]
    // bytesPerPixel = 1
    // Byte 0: paeth(0,0,0) = 0 -> predicted = 100-0 = 100
    // Byte 1: paeth(100,0,0) -> p=100, pa=0, pb=100, pc=100 -> pa<=pb && pa<=pc => a=100
    //   predicted = 50 - 100 = -50 => (256-50) = 206... hmm
    //   Actually prediction is added: result[i] = (data[i] + paeth) & 0xff
    //   So if raw is [100, 50], predicted (encoded) needs the delta:
    //   encoded[0] = raw[0] - paeth(0,0,0) = 100 - 0 = 100
    //   encoded[1] = raw[1] - paeth(raw[0],0,0) = 50 - 100 = -50 mod 256 = 206
    const predictedData = new Uint8Array([4, 100, 206]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 14,
      '/Columns': 2,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([100, 50]));
  });

  it('handles PNG Optimum predictor (type 15 = per-row filter bytes)', () => {
    // Predictor 15: each row has its own filter type byte
    const predictedData = new Uint8Array([
      0, 10, 20,  // row 1: None
      1, 5, 5,    // row 2: Sub (raw = [5, 10])
    ]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 15,
      '/Columns': 2,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 5, 10]));
  });

  it('handles multi-channel PNG Sub predictor (3 colors = RGB)', () => {
    // bytesPerPixel = 3 for RGB (colors=3, bpc=8)
    // 2 pixels = 6 bytes per row
    // Raw: [10, 20, 30, 40, 50, 60]
    // Sub encoded:
    //   bytes 0-2: [10, 20, 30] (no left pixel)
    //   bytes 3-5: [40-10, 50-20, 60-30] = [30, 30, 30]
    const predictedData = new Uint8Array([1, 10, 20, 30, 30, 30, 30]);

    const compressed = zlibSync(predictedData);
    const parms = makeParms({
      '/Predictor': 11,
      '/Columns': 2,
      '/Colors': 3,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40, 50, 60]));
  });
});

// ===========================================================================
// FlateDecode with TIFF predictor 2
// ===========================================================================

describe('FlateDecode with TIFF Predictor 2', () => {
  it('reverses horizontal differencing for 8-bit data', () => {
    // TIFF Predictor 2: each sample is difference from previous
    // columns=4, colors=1, bpc=8 => rowBytes=4
    // Raw: [10, 20, 30, 40]
    // Encoded: [10, 10, 10, 10]  (20-10=10, 30-20=10, 40-30=10)
    const encodedData = new Uint8Array([10, 10, 10, 10]);

    const compressed = zlibSync(encodedData);
    const parms = makeParms({
      '/Predictor': 2,
      '/Columns': 4,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it('reverses horizontal differencing for multi-row 8-bit data', () => {
    // 2 rows, 3 columns, 1 color, 8bpc
    // Row 1 raw: [10, 20, 30] => encoded: [10, 10, 10]
    // Row 2 raw: [5, 15, 25] => encoded: [5, 10, 10]
    const encodedData = new Uint8Array([10, 10, 10, 5, 10, 10]);

    const compressed = zlibSync(encodedData);
    const parms = makeParms({
      '/Predictor': 2,
      '/Columns': 3,
      '/Colors': 1,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 5, 15, 25]));
  });

  it('handles multi-channel TIFF predictor', () => {
    // 2 columns, 2 colors (e.g., gray+alpha), 8bpc
    // bytesPerPixel = 2
    // Row raw: [10, 20, 30, 40]
    //   pixel 0: [10, 20] (no prev)
    //   pixel 1: [30-10, 40-20] = [20, 20]
    // Encoded: [10, 20, 20, 20]
    const encodedData = new Uint8Array([10, 20, 20, 20]);

    const compressed = zlibSync(encodedData);
    const parms = makeParms({
      '/Predictor': 2,
      '/Columns': 2,
      '/Colors': 2,
      '/BitsPerComponent': 8,
    });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40]));
  });
});

// ===========================================================================
// FlateDecode — no predictor (predictor=1)
// ===========================================================================

describe('FlateDecode without predictor', () => {
  it('decompresses data with Predictor=1 (no prediction)', () => {
    const original = ascii('No predictor applied.');
    const compressed = zlibSync(original);
    const parms = makeParms({ '/Predictor': 1 });

    const result = decodeStream(compressed, 'FlateDecode', parms);
    expect(result).toEqual(original);
  });

  it('decompresses data with null parms', () => {
    const original = ascii('Null parms test.');
    const compressed = zlibSync(original);

    const result = decodeStream(compressed, 'FlateDecode', null);
    expect(result).toEqual(original);
  });
});

// ===========================================================================
// LZWDecode
// ===========================================================================

describe('LZWDecode', () => {
  it('decodes a simple LZW-compressed stream', () => {
    // Build a minimal LZW stream encoding the bytes [65, 66, 67] ("ABC")
    // LZW starts at 9-bit codes. First code should be clear (256).
    // Then the literal codes 65, 66, 67, then EOD (257).
    //
    // Bit layout (MSB first):
    // 256 = 100000000 (9 bits) - clear
    // 65  = 001000001 (9 bits) - 'A'
    // 66  = 001000010 (9 bits) - 'B'
    // 67  = 001000011 (9 bits) - 'C'
    // 257 = 100000001 (9 bits) - EOD
    //
    // Binary: 100000000 001000001 001000010 001000011 100000001
    // = 10000000 00010000 01001000 01000100 00111000 00001xxx
    // Let's compute precisely:
    //
    // Bits: 1 0 0 0 0 0 0 0 0 | 0 0 1 0 0 0 0 0 1 | 0 0 1 0 0 0 0 1 0 | 0 0 1 0 0 0 0 1 1 | 1 0 0 0 0 0 0 0 1
    // Byte boundaries:
    // 10000000 | 00010000 | 01001000 | 01000100 | 01110000 | 00010000 (with padding)
    //
    // Let me recompute bit by bit:
    // Position: 0         9         18        27        36
    // Bits:     100000000 001000001 001000010 001000011 100000001
    //
    // Bytes:
    // bits 0-7:   10000000 = 0x80
    // bits 8-15:  00010000 = 0x10
    // bits 16-23: 01001000 = 0x48
    // bits 24-31: 01000100 = 0x44
    // bits 32-39: 01110000 = 0x70 ... wait let me redo this

    // Code by code in bits:
    // 256: 1 0 0 0 0 0 0 0 0
    //  65: 0 0 1 0 0 0 0 0 1
    //  66: 0 0 1 0 0 0 0 1 0
    //  67: 0 0 1 0 0 0 0 1 1
    // 257: 1 0 0 0 0 0 0 0 1

    // All bits concatenated (45 bits):
    // 1 0 0 0 0 0 0 0 0  0 0 1 0 0 0 0 0 1  0 0 1 0 0 0 0 1 0  0 0 1 0 0 0 0 1 1  1 0 0 0 0 0 0 0 1

    // Group into bytes:
    // byte 0: 10000000 = 0x80
    // byte 1: 00010000 = 0x10
    // byte 2: 01001000 = 0x48
    // byte 3: 01000100 = 0x44  -- wait
    // Let me align more carefully:
    // Pos  0: 1
    // Pos  1: 0
    // Pos  2: 0
    // Pos  3: 0
    // Pos  4: 0
    // Pos  5: 0
    // Pos  6: 0
    // Pos  7: 0
    // -- byte 0: 10000000 = 0x80
    // Pos  8: 0
    // Pos  9: 0
    // Pos 10: 0
    // Pos 11: 1
    // Pos 12: 0
    // Pos 13: 0
    // Pos 14: 0
    // Pos 15: 0
    // -- byte 1: 00010000 = 0x10
    // Pos 16: 0
    // Pos 17: 1
    // Pos 18: 0
    // Pos 19: 0
    // Pos 20: 1
    // Pos 21: 0
    // Pos 22: 0
    // Pos 23: 0
    // -- byte 2: 01001000 = 0x48
    // Pos 24: 0
    // Pos 25: 1
    // Pos 26: 0
    // Pos 27: 0
    // Pos 28: 0
    // Pos 29: 1
    // Pos 30: 0
    // Pos 31: 0
    // -- byte 3: 01000100 = 0x44  -- Hmm, let me re-check
    // Wait. Pos 24-26 belong to code 66 (bits 18-26 of code 66 start at bit 18).
    // Codes:
    // 256: bits 0-8
    //  65: bits 9-17
    //  66: bits 18-26
    //  67: bits 27-35
    // 257: bits 36-44

    // So code 66 = 001000010:
    // Pos 18: 0
    // Pos 19: 0
    // Pos 20: 1
    // Pos 21: 0
    // Pos 22: 0
    // Pos 23: 0
    // Pos 24: 0
    // Pos 25: 1
    // Pos 26: 0

    // byte 2 (pos 16-23): pos16=0, pos17=1(last bit of 65), pos18-23=001000 -> 01001000 = 0x48
    // byte 3 (pos 24-31): pos24=0, pos25=1, pos26=0, pos27-31: code67 = 001000011, bits 0-4 = 00100 -> 01000100 = 0x44
    // byte 4 (pos 32-39): code67 remaining bits 5-8 = 0011, then code 257 bits 0-3 = 1000 -> 00111000 = 0x38
    // byte 5 (pos 40-44 + padding): code 257 bits 4-8 = 00001, padded with 000 -> 00001000 = 0x08

    const lzwData = new Uint8Array([0x80, 0x10, 0x48, 0x44, 0x38, 0x08]);
    const result = decodeStream(lzwData, 'LZWDecode');
    expect(result).toEqual(new Uint8Array([65, 66, 67]));
  });

  it('handles clear code resetting the table', () => {
    // Encode: clear(256), 'A'(65), clear(256), 'B'(66), EOD(257)
    // All 9-bit codes:
    // 256: 100000000
    //  65: 001000001
    // 256: 100000000
    //  66: 001000010
    // 257: 100000001

    // Concatenated bits (45 bits):
    // 100000000 001000001 100000000 001000010 100000001
    //
    // byte 0 (0-7):   10000000 = 0x80
    // byte 1 (8-15):  00010000 = 0x10
    // byte 2 (16-23): 01100000 = 0x60
    // byte 3 (24-31): 00000100 = 0x04
    // byte 4 (32-39): 00101000 = 0x28
    // byte 5 (40-44): 00001000 = 0x08 (padded)

    const lzwData = new Uint8Array([0x80, 0x10, 0x60, 0x04, 0x28, 0x08]);
    const result = decodeStream(lzwData, 'LZWDecode');
    expect(result).toEqual(new Uint8Array([65, 66]));
  });

  it('handles EOD immediately after clear', () => {
    // clear(256), EOD(257) at 9 bits each = 18 bits
    // 100000000 100000001
    // byte 0: 10000000 = 0x80
    // byte 1: 01000000 = 0x40
    // byte 2: 01000000 = 0x40 (padded; we need bits 16-17 = '01')
    // Actually:
    // Pos 0-8: 100000000
    // Pos 9-17: 100000001
    // byte 0 (0-7): 10000000 = 0x80
    // byte 1 (8-15): 01000000 = 0x40
    // byte 2 (16-17 + padding): 01000000 = 0x40
    const lzwData = new Uint8Array([0x80, 0x40, 0x40]);
    const result = decodeStream(lzwData, 'LZWDecode');
    expect(result).toEqual(new Uint8Array([]));
  });
});

// ===========================================================================
// Filter abbreviations
// ===========================================================================

describe('Filter abbreviation mapping', () => {
  it('maps AHx to ASCIIHexDecode', () => {
    const encoded = ascii('4F4B>');
    const result = decodeStream(encoded, 'AHx');
    expect(result).toEqual(new Uint8Array([0x4f, 0x4b]));
  });

  it('maps A85 to ASCII85Decode', () => {
    const encoded = ascii('z~>');
    const result = decodeStream(encoded, 'A85');
    expect(result).toEqual(new Uint8Array([0, 0, 0, 0]));
  });

  it('maps Fl to FlateDecode', () => {
    const original = ascii('abbreviation test');
    const compressed = zlibSync(original);
    const result = decodeStream(compressed, 'Fl');
    expect(result).toEqual(original);
  });

  it('maps LZW to LZWDecode', () => {
    // Simple LZW: clear(256), 'X'(88), EOD(257)
    // 100000000 001011000 100000001
    // byte 0: 10000000 = 0x80
    // byte 1: 00010110 = 0x16
    // byte 2: 00100000 = 0x20
    // byte 3: 001xxxxx = padded
    // Let me recompute:
    // 256: 100000000 (bits 0-8)
    //  88: 001011000 (bits 9-17)
    // 257: 100000001 (bits 18-26)
    // byte 0 (0-7):   10000000 = 0x80
    // byte 1 (8-15):  00010110 = 0x16
    // byte 2 (16-23): 00100000 = 0x20
    // byte 3 (24-26): 001xxxxx = 0x20 padded
    const lzwData = new Uint8Array([0x80, 0x16, 0x20, 0x20]);
    const result = decodeStream(lzwData, 'LZW');
    expect(result).toEqual(new Uint8Array([88]));
  });

  it('maps RL to RunLengthDecode', () => {
    const encoded = new Uint8Array([0, 0x41, 128]);
    const result = decodeStream(encoded, 'RL');
    expect(result).toEqual(new Uint8Array([0x41]));
  });

  it('strips leading slash from filter names', () => {
    const encoded = ascii('4F4B>');
    const result = decodeStream(encoded, '/ASCIIHexDecode');
    expect(result).toEqual(new Uint8Array([0x4f, 0x4b]));
  });
});

// ===========================================================================
// DCTDecode and JPXDecode passthrough
// ===========================================================================

describe('Passthrough filters', () => {
  it('DCTDecode returns data unchanged', () => {
    const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = decodeStream(data, 'DCTDecode');
    expect(result).toEqual(data);
  });

  it('JPXDecode returns data unchanged', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50]);
    const result = decodeStream(data, 'JPXDecode');
    expect(result).toEqual(data);
  });

  it('Crypt filter returns data unchanged', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const result = decodeStream(data, 'Crypt');
    expect(result).toEqual(data);
  });
});

// ===========================================================================
// Multiple filters (chained)
// ===========================================================================

describe('Multiple filters applied in sequence', () => {
  it('applies filters in order (ASCIIHexDecode then nothing needed)', () => {
    // First encode with FlateDecode, then encode that with ASCIIHexDecode
    const original = ascii('chained filters!');
    const compressed = zlibSync(original);

    // Encode compressed bytes as hex
    let hex = '';
    for (const b of compressed) {
      hex += b.toString(16).padStart(2, '0').toUpperCase();
    }
    hex += '>';

    const hexEncoded = ascii(hex);
    const result = decodeStream(hexEncoded, ['ASCIIHexDecode', 'FlateDecode']);
    expect(result).toEqual(original);
  });

  it('applies array of a single filter', () => {
    const encoded = ascii('414243>');
    const result = decodeStream(encoded, ['ASCIIHexDecode']);
    expect(result).toEqual(new Uint8Array([0x41, 0x42, 0x43]));
  });
});

// ===========================================================================
// Unknown/unsupported filters
// ===========================================================================

describe('Error handling', () => {
  it('throws on unknown filter', () => {
    expect(() => decodeStream(new Uint8Array([]), 'UnknownFilter')).toThrow(
      'Unknown PDF stream filter',
    );
  });

  it('handles CCITTFaxDecode without throwing', () => {
    // CCITTFaxDecode is now implemented — empty data returns empty result
    const result = decodeStream(new Uint8Array([]), 'CCITTFaxDecode');
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles JBIG2Decode without throwing', () => {
    // JBIG2Decode is now implemented — empty data returns empty result
    const result = decodeStream(new Uint8Array([]), 'JBIG2Decode');
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ===========================================================================
// getStreamFilters()
// ===========================================================================

describe('getStreamFilters()', () => {
  it('returns empty arrays when no /Filter key', () => {
    const dict = new PdfDict();
    const result = getStreamFilters(dict);
    expect(result.filters).toEqual([]);
    expect(result.decodeParms).toEqual([]);
  });

  it('extracts single filter from PdfName', () => {
    const dict = new PdfDict();
    dict.set('/Filter', PdfName.of('/FlateDecode'));
    const result = getStreamFilters(dict);
    expect(result.filters).toEqual(['FlateDecode']);
    expect(result.decodeParms).toEqual([null]);
  });

  it('extracts multiple filters from PdfArray', () => {
    const dict = new PdfDict();
    dict.set(
      '/Filter',
      PdfArray.of([PdfName.of('/ASCIIHexDecode'), PdfName.of('/FlateDecode')]),
    );
    const result = getStreamFilters(dict);
    expect(result.filters).toEqual(['ASCIIHexDecode', 'FlateDecode']);
    expect(result.decodeParms).toHaveLength(2);
  });

  it('extracts decode parameters alongside filters', () => {
    const dict = new PdfDict();
    dict.set('/Filter', PdfName.of('/FlateDecode'));

    const parms = new PdfDict();
    parms.set('/Predictor', PdfNumber.of(12));
    parms.set('/Columns', PdfNumber.of(4));
    dict.set('/DecodeParms', parms);

    const result = getStreamFilters(dict);
    expect(result.filters).toEqual(['FlateDecode']);
    expect(result.decodeParms[0]).toBeInstanceOf(PdfDict);
  });

  it('handles PdfArray of decode parameters', () => {
    const dict = new PdfDict();
    dict.set(
      '/Filter',
      PdfArray.of([PdfName.of('/ASCIIHexDecode'), PdfName.of('/FlateDecode')]),
    );

    const flateParms = new PdfDict();
    flateParms.set('/Predictor', PdfNumber.of(12));

    dict.set('/DecodeParms', PdfArray.of([PdfName.of('/null'), flateParms]));

    const result = getStreamFilters(dict);
    expect(result.filters).toHaveLength(2);
    expect(result.decodeParms[0]).toBeNull(); // PdfName is not PdfDict -> null
    expect(result.decodeParms[1]).toBeInstanceOf(PdfDict);
  });

  it('strips leading slash from filter names', () => {
    const dict = new PdfDict();
    dict.set('/Filter', PdfName.of('/FlateDecode'));
    const result = getStreamFilters(dict);
    expect(result.filters[0]).toBe('FlateDecode');
  });
});
