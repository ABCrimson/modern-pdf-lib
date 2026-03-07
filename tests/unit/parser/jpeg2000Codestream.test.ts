/**
 * Tests for the JPEG2000 codestream / JP2 container parsing utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isJpeg2000Codestream,
  isJp2Container,
  isJpeg2000,
  extractCodestream,
  parseJp2Boxes,
  findBox,
  findAllBoxes,
  parseImageHeader,
  JP2_BOX_TYPES,
} from '../../../src/parser/jpeg2000Codestream.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a JP2 signature box (12 bytes). */
function buildSignatureBox(): Uint8Array {
  return new Uint8Array([
    0x00, 0x00, 0x00, 0x0C, // length = 12
    0x6A, 0x50, 0x20, 0x20, // type = 'jP  '
    0x0D, 0x0A, 0x87, 0x0A, // JP2 magic
  ]);
}

/** Build a minimal JP2 box with the given type and payload. */
function buildBox(type: string, payload: Uint8Array): Uint8Array {
  const totalLength = 8 + payload.length;
  const box = new Uint8Array(totalLength);

  // Length (big-endian)
  box[0] = (totalLength >>> 24) & 0xFF;
  box[1] = (totalLength >>> 16) & 0xFF;
  box[2] = (totalLength >>> 8) & 0xFF;
  box[3] = totalLength & 0xFF;

  // Type (4 ASCII chars)
  for (let i = 0; i < 4; i++) {
    box[4 + i] = type.charCodeAt(i);
  }

  // Payload
  box.set(payload, 8);

  return box;
}

/** Build a minimal ihdr box payload (14 bytes). */
function buildIhdrPayload(
  width: number,
  height: number,
  components: number,
  bpc: number = 8,
): Uint8Array {
  const data = new Uint8Array(14);
  const view = new DataView(data.buffer);
  view.setUint32(0, height, false);
  view.setUint32(4, width, false);
  view.setUint16(8, components, false);
  data[10] = (bpc - 1) & 0x7F; // bpc stored as value - 1
  data[11] = 7; // Compression type (always 7 for JP2)
  data[12] = 0; // Colorspace unknown = false
  data[13] = 0; // IP flag = false
  return data;
}

/** Build a minimal JP2 file with signature, ftyp, and jp2c boxes. */
function buildMinimalJp2(codestreamData: Uint8Array): Uint8Array {
  const sig = buildSignatureBox();
  const ftyp = buildBox('ftyp', new Uint8Array([
    0x6A, 0x70, 0x32, 0x20, // brand 'jp2 '
    0x00, 0x00, 0x00, 0x00, // minor version
  ]));
  const jp2c = buildBox('jp2c', codestreamData);

  const result = new Uint8Array(sig.length + ftyp.length + jp2c.length);
  result.set(sig, 0);
  result.set(ftyp, sig.length);
  result.set(jp2c, sig.length + ftyp.length);
  return result;
}

/** Build a minimal raw J2K codestream (SOC + EOC). */
function buildMinimalCodestream(): Uint8Array {
  return new Uint8Array([0xFF, 0x4F, 0xFF, 0xD9]); // SOC + EOC
}

// ---------------------------------------------------------------------------
// Detection tests
// ---------------------------------------------------------------------------

describe('JPEG2000 format detection', () => {
  it('isJpeg2000Codestream detects SOC marker (FF 4F)', () => {
    const data = new Uint8Array([0xFF, 0x4F, 0xFF, 0x51]);
    expect(isJpeg2000Codestream(data)).toBe(true);
  });

  it('isJpeg2000Codestream rejects non-J2K data', () => {
    expect(isJpeg2000Codestream(new Uint8Array([0xFF, 0xD8]))).toBe(false); // JPEG
    expect(isJpeg2000Codestream(new Uint8Array([0x89, 0x50]))).toBe(false); // PNG
    expect(isJpeg2000Codestream(new Uint8Array([]))).toBe(false);
    expect(isJpeg2000Codestream(new Uint8Array([0xFF]))).toBe(false);
  });

  it('isJp2Container detects JP2 signature', () => {
    const jp2 = buildMinimalJp2(buildMinimalCodestream());
    expect(isJp2Container(jp2)).toBe(true);
  });

  it('isJp2Container rejects non-JP2 data', () => {
    expect(isJp2Container(new Uint8Array([0xFF, 0x4F]))).toBe(false);
    expect(isJp2Container(new Uint8Array([0xFF, 0xD8]))).toBe(false);
    expect(isJp2Container(new Uint8Array([]))).toBe(false);
    expect(isJp2Container(new Uint8Array(11))).toBe(false); // too short
  });

  it('isJpeg2000 detects both JP2 and J2K', () => {
    expect(isJpeg2000(new Uint8Array([0xFF, 0x4F]))).toBe(true);
    expect(isJpeg2000(buildMinimalJp2(buildMinimalCodestream()))).toBe(true);
    expect(isJpeg2000(new Uint8Array([0xFF, 0xD8]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Box parsing tests
// ---------------------------------------------------------------------------

describe('JP2 box parsing', () => {
  it('parses a single box', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const box = buildBox('test', payload);
    const boxes = parseJp2Boxes(box);

    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.type).toBe('test');
    expect(boxes[0]!.length).toBe(12); // 8 header + 4 payload
    expect(boxes[0]!.offset).toBe(0);
    expect(boxes[0]!.data).toEqual(payload);
  });

  it('parses multiple boxes', () => {
    const box1 = buildBox('aaaa', new Uint8Array([10]));
    const box2 = buildBox('bbbb', new Uint8Array([20, 30]));
    const combined = new Uint8Array(box1.length + box2.length);
    combined.set(box1, 0);
    combined.set(box2, box1.length);

    const boxes = parseJp2Boxes(combined);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.type).toBe('aaaa');
    expect(boxes[0]!.data).toEqual(new Uint8Array([10]));
    expect(boxes[1]!.type).toBe('bbbb');
    expect(boxes[1]!.data).toEqual(new Uint8Array([20, 30]));
    expect(boxes[1]!.offset).toBe(box1.length);
  });

  it('parses JP2 signature box correctly', () => {
    const jp2 = buildMinimalJp2(buildMinimalCodestream());
    const boxes = parseJp2Boxes(jp2);

    expect(boxes.length).toBeGreaterThanOrEqual(3);
    expect(boxes[0]!.type).toBe('jP  ');
    expect(boxes[1]!.type).toBe('ftyp');
    expect(boxes[2]!.type).toBe('jp2c');
  });

  it('handles box with length 0 (extends to EOF)', () => {
    // Build a box where length = 0 (rest of file)
    const data = new Uint8Array(20);
    // Box length = 0
    data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 0;
    // Box type = 'test'
    data[4] = 0x74; data[5] = 0x65; data[6] = 0x73; data[7] = 0x74;
    // Payload
    for (let i = 8; i < 20; i++) data[i] = i;

    const boxes = parseJp2Boxes(data);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.type).toBe('test');
    expect(boxes[0]!.length).toBe(20);
    expect(boxes[0]!.data.length).toBe(12); // 20 - 8 header
  });

  it('handles empty data gracefully', () => {
    expect(parseJp2Boxes(new Uint8Array(0))).toEqual([]);
  });

  it('handles data shorter than a box header', () => {
    expect(parseJp2Boxes(new Uint8Array(4))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Box search helpers
// ---------------------------------------------------------------------------

describe('Box search helpers', () => {
  it('findBox returns the first matching box', () => {
    const box1 = buildBox('aaaa', new Uint8Array([1]));
    const box2 = buildBox('bbbb', new Uint8Array([2]));
    const box3 = buildBox('aaaa', new Uint8Array([3]));
    const combined = new Uint8Array(box1.length + box2.length + box3.length);
    combined.set(box1, 0);
    combined.set(box2, box1.length);
    combined.set(box3, box1.length + box2.length);

    const boxes = parseJp2Boxes(combined);
    const found = findBox(boxes, 'aaaa');
    expect(found).toBeDefined();
    expect(found!.data).toEqual(new Uint8Array([1]));
  });

  it('findBox returns undefined for missing type', () => {
    const boxes = parseJp2Boxes(buildBox('aaaa', new Uint8Array([1])));
    expect(findBox(boxes, 'zzzz')).toBeUndefined();
  });

  it('findAllBoxes returns all matching boxes', () => {
    const box1 = buildBox('aaaa', new Uint8Array([1]));
    const box2 = buildBox('bbbb', new Uint8Array([2]));
    const box3 = buildBox('aaaa', new Uint8Array([3]));
    const combined = new Uint8Array(box1.length + box2.length + box3.length);
    combined.set(box1, 0);
    combined.set(box2, box1.length);
    combined.set(box3, box1.length + box2.length);

    const boxes = parseJp2Boxes(combined);
    const found = findAllBoxes(boxes, 'aaaa');
    expect(found).toHaveLength(2);
    expect(found[0]!.data).toEqual(new Uint8Array([1]));
    expect(found[1]!.data).toEqual(new Uint8Array([3]));
  });

  it('findAllBoxes returns empty array for no matches', () => {
    const boxes = parseJp2Boxes(buildBox('aaaa', new Uint8Array([1])));
    expect(findAllBoxes(boxes, 'zzzz')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Codestream extraction
// ---------------------------------------------------------------------------

describe('Codestream extraction', () => {
  it('extracts codestream from JP2 container', () => {
    const cs = buildMinimalCodestream();
    const jp2 = buildMinimalJp2(cs);
    const extracted = extractCodestream(jp2);

    expect(extracted).toEqual(cs);
  });

  it('returns raw codestream as-is', () => {
    const cs = new Uint8Array([0xFF, 0x4F, 0xFF, 0x51, 0x00, 0x00]);
    const extracted = extractCodestream(cs);
    expect(extracted).toBe(cs); // Same reference
  });

  it('throws when JP2 has no jp2c box', () => {
    const sig = buildSignatureBox();
    const ftyp = buildBox('ftyp', new Uint8Array(8));
    // No jp2c box
    const data = new Uint8Array(sig.length + ftyp.length);
    data.set(sig, 0);
    data.set(ftyp, sig.length);

    expect(() => extractCodestream(data)).toThrow('no codestream box');
  });
});

// ---------------------------------------------------------------------------
// Image header parsing
// ---------------------------------------------------------------------------

describe('Image header parsing', () => {
  it('parses ihdr box correctly', () => {
    const ihdr = buildIhdrPayload(1920, 1080, 3, 8);
    const result = parseImageHeader(ihdr);

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.components).toBe(3);
    expect(result.bitsPerComponent).toBe(8);
    expect(result.compressionType).toBe(7);
    expect(result.colorspaceUnknown).toBe(false);
    expect(result.intellectualProperty).toBe(false);
  });

  it('parses 16-bit ihdr correctly', () => {
    const ihdr = buildIhdrPayload(512, 512, 1, 16);
    const result = parseImageHeader(ihdr);

    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.components).toBe(1);
    expect(result.bitsPerComponent).toBe(16);
  });

  it('parses 4-component ihdr', () => {
    const ihdr = buildIhdrPayload(100, 200, 4, 12);
    const result = parseImageHeader(ihdr);

    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(result.components).toBe(4);
    expect(result.bitsPerComponent).toBe(12);
  });

  it('throws for too-short ihdr data', () => {
    expect(() => parseImageHeader(new Uint8Array(10))).toThrow('too short');
  });
});

// ---------------------------------------------------------------------------
// JP2_BOX_TYPES constants
// ---------------------------------------------------------------------------

describe('JP2_BOX_TYPES', () => {
  it('has correct signature type', () => {
    expect(JP2_BOX_TYPES.SIGNATURE).toBe('jP  ');
  });

  it('has correct codestream type', () => {
    expect(JP2_BOX_TYPES.CODESTREAM).toBe('jp2c');
  });

  it('has correct image header type', () => {
    expect(JP2_BOX_TYPES.IMAGE_HEADER).toBe('ihdr');
  });

  it('has correct channel definition type', () => {
    expect(JP2_BOX_TYPES.CHANNEL_DEFINITION).toBe('cdef');
  });

  it('has all expected box types', () => {
    const expectedTypes = [
      'SIGNATURE', 'FILE_TYPE', 'JP2_HEADER', 'CODESTREAM',
      'COLOR', 'IMAGE_HEADER', 'BITS_PER_COMPONENT', 'PALETTE',
      'COMPONENT_MAPPING', 'CHANNEL_DEFINITION', 'RESOLUTION',
      'UUID', 'UUID_INFO',
    ];
    for (const key of expectedTypes) {
      expect(JP2_BOX_TYPES).toHaveProperty(key);
    }
  });
});
