/**
 * Tests for the JBIG2 WASM bridge — initialization, availability checks,
 * graceful fallback behavior, and the async decode path.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  initJBIG2Wasm,
  isJBIG2WasmAvailable,
  disposeJBIG2Wasm,
} from '../../../src/parser/jbig2WasmBridge.js';
import {
  decodeJBIG2Async,
  resetJBIG2WasmBridge,
} from '../../../src/parser/jbig2Decode.js';
import { PdfDict } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  disposeJBIG2Wasm();
  resetJBIG2WasmBridge();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a 32-bit big-endian unsigned integer into a byte array at the
 * given offset.
 */
function writeUint32BE(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/**
 * Build a minimal JBIG2 segment header.
 */
function buildSegmentHeader(
  segmentNumber: number,
  segmentType: number,
  pageAssociation: number,
  dataLength: number,
): number[] {
  const header: number[] = [];

  // Segment number (4 bytes)
  writeUint32BE(header, 0, segmentNumber);

  // Flags byte: type in bits 0-5
  header[4] = segmentType & 0x3f;

  // Referred-to count: 0 (top 3 bits of byte = count if < 5)
  header[5] = 0;

  // Page association (1 byte)
  header[6] = pageAssociation & 0xff;

  // Data length (4 bytes)
  writeUint32BE(header, 7, dataLength);

  return header;
}

/**
 * Build a minimal JBIG2 data stream with a page info segment
 * and an end-of-page segment.
 */
function buildMinimalJbig2(width: number, height: number): Uint8Array {
  const segments: number[] = [];

  // Page information segment (type 48, 19 bytes of data)
  const pageInfoHeader = buildSegmentHeader(0, 48, 1, 19);
  segments.push(...pageInfoHeader);

  // Page information data (19 bytes)
  const pageInfoData: number[] = new Array(19).fill(0);
  writeUint32BE(pageInfoData, 0, width);   // width
  writeUint32BE(pageInfoData, 4, height);  // height
  writeUint32BE(pageInfoData, 8, 72);      // x resolution
  writeUint32BE(pageInfoData, 12, 72);     // y resolution
  pageInfoData[16] = 0;                     // flags: default=white, op=OR
  pageInfoData[17] = 0;
  pageInfoData[18] = 0;
  segments.push(...pageInfoData);

  // End of page segment (type 49, 0 bytes of data)
  const endPageHeader = buildSegmentHeader(1, 49, 1, 0);
  segments.push(...endPageHeader);

  // End of file segment (type 51, 0 bytes of data)
  const endFileHeader = buildSegmentHeader(2, 51, 0, 0);
  segments.push(...endFileHeader);

  return new Uint8Array(segments);
}

// ---------------------------------------------------------------------------
// Availability checks
// ---------------------------------------------------------------------------

describe('JBIG2 WASM bridge — availability', () => {
  it('isJBIG2WasmAvailable() returns false before initialization', () => {
    expect(isJBIG2WasmAvailable()).toBe(false);
  });

  it('isJBIG2WasmAvailable() returns false after dispose', async () => {
    // Try to init (may fail without WASM binary, that's OK)
    try {
      await initJBIG2Wasm();
    } catch {
      // Expected — WASM binary not available in test environment
    }

    disposeJBIG2Wasm();
    expect(isJBIG2WasmAvailable()).toBe(false);
  });

  it('initJBIG2Wasm() throws when WASM binary is not available', async () => {
    // Without providing bytes or having the binary on disk, init should fail
    await expect(initJBIG2Wasm()).rejects.toThrow();
    expect(isJBIG2WasmAvailable()).toBe(false);
  });

  it('initJBIG2Wasm() throws for invalid WASM bytes', async () => {
    const invalidBytes = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    await expect(initJBIG2Wasm(invalidBytes)).rejects.toThrow();
    expect(isJBIG2WasmAvailable()).toBe(false);
  });

  it('initJBIG2Wasm() is idempotent after first attempt', async () => {
    // First attempt fails
    try {
      await initJBIG2Wasm();
    } catch {
      // Expected
    }

    // Second attempt should be a no-op (doesn't throw again)
    await initJBIG2Wasm();
    expect(isJBIG2WasmAvailable()).toBe(false);
  });

  it('dispose allows re-initialization', async () => {
    // First attempt
    try {
      await initJBIG2Wasm();
    } catch {
      // Expected
    }

    // Dispose resets the state
    disposeJBIG2Wasm();

    // New attempt should try again (and fail again)
    try {
      await initJBIG2Wasm();
    } catch {
      // Expected
    }
    expect(isJBIG2WasmAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Async decode with fallback
// ---------------------------------------------------------------------------

describe('JBIG2 WASM bridge — async decode with fallback', () => {
  it('decodeJBIG2Async falls back to JS when WASM unavailable', async () => {
    // Build a minimal JBIG2 with just page info (empty bitmap)
    const jbig2Data = buildMinimalJbig2(8, 4);

    // This should fall back to the JS decoder since WASM is not loaded
    const result = await decodeJBIG2Async(jbig2Data, null);
    expect(result).toBeInstanceOf(Uint8Array);
    // 8 pixels wide * 4 rows = 4 bytes (1 byte per row for 8-pixel width)
    expect(result.length).toBeGreaterThan(0);
  });

  it('decodeJBIG2Async works with null parms', async () => {
    const jbig2Data = buildMinimalJbig2(16, 8);
    const result = await decodeJBIG2Async(jbig2Data, null);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('decodeJBIG2Async works with empty parms dict', async () => {
    const jbig2Data = buildMinimalJbig2(8, 8);
    const parms = new PdfDict();
    const result = await decodeJBIG2Async(jbig2Data, parms);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('JBIG2 WASM bridge — module exports', () => {
  it('exports initJBIG2Wasm function', () => {
    expect(typeof initJBIG2Wasm).toBe('function');
  });

  it('exports isJBIG2WasmAvailable function', () => {
    expect(typeof isJBIG2WasmAvailable).toBe('function');
  });

  it('exports disposeJBIG2Wasm function', () => {
    expect(typeof disposeJBIG2Wasm).toBe('function');
  });

  it('exports decodeJBIG2Async function', () => {
    expect(typeof decodeJBIG2Async).toBe('function');
  });

  it('exports resetJBIG2WasmBridge function', () => {
    expect(typeof resetJBIG2WasmBridge).toBe('function');
  });
});
