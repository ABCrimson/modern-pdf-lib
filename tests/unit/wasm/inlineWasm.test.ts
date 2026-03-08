/**
 * Tests for the inline WASM module loader (`src/wasm/inlineWasm.ts`).
 *
 * Since WASM binaries may not be compiled in the test environment, these
 * tests verify the module's API shape, validation logic, caching behavior,
 * and integration with provided/mock generated data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInlineWasmBytes,
  isValidModuleName,
  clearInlineWasmCache,
  hasInlineWasmData,
  WASM_MODULE_NAMES,
  provideInlineWasmModule,
  loadInlineWasmModule,
} from '../../../src/wasm/inlineWasm.js';
import type { WasmModuleName } from '../../../src/wasm/inlineWasm.js';

// ---------------------------------------------------------------------------
// Valid WASM header (first 8 bytes of any valid .wasm binary)
// Magic: \0asm (0x00 0x61 0x73 0x6D)
// Version: 1 (0x01 0x00 0x00 0x00)
// ---------------------------------------------------------------------------

const WASM_MAGIC = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/**
 * Create a minimal valid WASM binary (just the 8-byte header).
 * This is enough to pass WASM header validation but not enough
 * to compile. Sufficient for testing inline encoding/decoding.
 */
function createMinimalWasm(): Uint8Array {
  return new Uint8Array(WASM_MAGIC);
}

/**
 * Base64-encode a Uint8Array for use as mock generated data.
 */
function toBase64(data: Uint8Array): string {
  return data.toBase64();
}

// ---------------------------------------------------------------------------
// Mock generated module
// ---------------------------------------------------------------------------

/**
 * Build a mock generated module that simulates the output of
 * `scripts/generate-inline-wasm.ts`.
 */
function createMockGeneratedModule(moduleNames: readonly string[]): {
  INLINE_WASM_MODULES: Readonly<Record<string, string>>;
  INLINE_WASM_MODULE_NAMES: readonly string[];
} {
  const wasmBytes = createMinimalWasm();
  const base64 = toBase64(wasmBytes);
  const modules: Record<string, string> = {};
  for (const name of moduleNames) {
    modules[name] = base64;
  }
  return {
    INLINE_WASM_MODULES: modules,
    INLINE_WASM_MODULE_NAMES: moduleNames,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inlineWasm — module name validation', () => {
  it('isValidModuleName returns true for all 6 known module names', () => {
    const expected = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];
    for (const name of expected) {
      expect(isValidModuleName(name)).toBe(true);
    }
  });

  it('isValidModuleName returns false for unknown names', () => {
    expect(isValidModuleName('unknown')).toBe(false);
    expect(isValidModuleName('')).toBe(false);
    expect(isValidModuleName('LIBDEFLATE')).toBe(false);
    expect(isValidModuleName('wasm')).toBe(false);
  });

  it('WASM_MODULE_NAMES contains exactly 6 entries', () => {
    expect(WASM_MODULE_NAMES).toHaveLength(6);
    expect(WASM_MODULE_NAMES).toContain('libdeflate');
    expect(WASM_MODULE_NAMES).toContain('png');
    expect(WASM_MODULE_NAMES).toContain('ttf');
    expect(WASM_MODULE_NAMES).toContain('shaping');
    expect(WASM_MODULE_NAMES).toContain('jbig2');
    expect(WASM_MODULE_NAMES).toContain('jpeg');
  });
});

describe('inlineWasm — getInlineWasmBytes', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('throws for an unknown module name', () => {
    expect(() => getInlineWasmBytes('nonexistent')).toThrow(
      /Unknown WASM module: "nonexistent"/,
    );
  });

  it('throws descriptive error mentioning valid module names', () => {
    expect(() => getInlineWasmBytes('invalid')).toThrow(
      /Valid modules: libdeflate, png, ttf, shaping, jbig2, jpeg/,
    );
  });

  it('returns Uint8Array when generated data is provided', () => {
    const mock = createMockGeneratedModule(['libdeflate', 'png']);
    provideInlineWasmModule(mock);

    const bytes = getInlineWasmBytes('libdeflate');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('decoded bytes contain valid WASM magic header', () => {
    const mock = createMockGeneratedModule(['png']);
    provideInlineWasmModule(mock);

    const bytes = getInlineWasmBytes('png');

    // First 4 bytes: \0asm
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x61);
    expect(bytes[2]).toBe(0x73);
    expect(bytes[3]).toBe(0x6d);

    // Next 4 bytes: version 1
    expect(bytes[4]).toBe(0x01);
    expect(bytes[5]).toBe(0x00);
    expect(bytes[6]).toBe(0x00);
    expect(bytes[7]).toBe(0x00);
  });

  it('caches decoded bytes on subsequent calls', () => {
    const mock = createMockGeneratedModule(['jbig2']);
    provideInlineWasmModule(mock);

    const first = getInlineWasmBytes('jbig2');
    const second = getInlineWasmBytes('jbig2');

    // Same reference (cached)
    expect(first).toBe(second);
  });

  it('clearInlineWasmCache causes re-decode on next call', () => {
    const mock = createMockGeneratedModule(['ttf']);
    provideInlineWasmModule(mock);

    const first = getInlineWasmBytes('ttf');
    clearInlineWasmCache();
    const second = getInlineWasmBytes('ttf');

    // Different references (re-decoded)
    expect(first).not.toBe(second);
    // But same content
    expect(first).toEqual(second);
  });

  it('supports all 6 module names when generated data includes them', () => {
    const allNames = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];
    const mock = createMockGeneratedModule(allNames);
    provideInlineWasmModule(mock);

    for (const name of allNames) {
      const bytes = getInlineWasmBytes(name);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBe(8); // Minimal WASM header
    }
  });

  it('throws when module exists in names but not in generated data', () => {
    // Provide a module with only 'libdeflate'
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    // 'png' is a valid name but not in the generated data
    expect(() => getInlineWasmBytes('png')).toThrow(
      /not available in the generated inline data/,
    );
  });
});

describe('inlineWasm — hasInlineWasmData', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('returns true for modules present in generated data', () => {
    const mock = createMockGeneratedModule(['libdeflate', 'jpeg']);
    provideInlineWasmModule(mock);

    expect(hasInlineWasmData('libdeflate')).toBe(true);
    expect(hasInlineWasmData('jpeg')).toBe(true);
  });

  it('returns false for unknown module names', () => {
    expect(hasInlineWasmData('nonexistent')).toBe(false);
    expect(hasInlineWasmData('')).toBe(false);
  });

  it('returns false for valid names not in generated data', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    expect(hasInlineWasmData('shaping')).toBe(false);
  });
});

describe('inlineWasm — provideInlineWasmModule', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('allows replacing the generated module at runtime', () => {
    // First, provide a module with only libdeflate
    provideInlineWasmModule(createMockGeneratedModule(['libdeflate']));
    expect(hasInlineWasmData('libdeflate')).toBe(true);
    expect(hasInlineWasmData('png')).toBe(false);

    // Replace with a module that has png
    provideInlineWasmModule(createMockGeneratedModule(['png']));
    expect(hasInlineWasmData('png')).toBe(true);
  });

  it('accepts custom base64 data and decodes correctly', () => {
    // Create a custom WASM-like binary (larger than just the header)
    const customData = new Uint8Array(16);
    customData.set(WASM_MAGIC);
    customData[8] = 0x01; // Custom section marker
    customData[9] = 0x04; // Section size
    customData[10] = 0x02; // Name length
    customData[11] = 0x68; // 'h'
    customData[12] = 0x69; // 'i'
    customData[13] = 0x00; // Section body

    const base64 = toBase64(customData);
    provideInlineWasmModule({
      INLINE_WASM_MODULES: { libdeflate: base64 },
      INLINE_WASM_MODULE_NAMES: ['libdeflate'],
    });

    const bytes = getInlineWasmBytes('libdeflate');
    expect(bytes.byteLength).toBe(16);
    expect(bytes[0]).toBe(0x00); // WASM magic
    expect(bytes[8]).toBe(0x01); // Custom section
    expect(bytes[11]).toBe(0x68); // 'h'
  });
});

describe('inlineWasm — WasmModuleName type', () => {
  it('type narrowing works with isValidModuleName', () => {
    const name: string = 'libdeflate';
    if (isValidModuleName(name)) {
      // At this point, TypeScript should narrow `name` to WasmModuleName
      const narrowed: WasmModuleName = name;
      expect(narrowed).toBe('libdeflate');
    }
  });
});
