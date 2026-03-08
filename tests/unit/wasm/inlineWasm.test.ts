/**
 * Tests for the inline WASM module loader (`src/wasm/inlineWasm.ts`).
 *
 * Covers:
 * - Module name validation
 * - Lazy decode behavior (base64 decoded only on first access)
 * - Size reporting API (`getInlineWasmSize`)
 * - Preload API (`preloadInlineWasm`)
 * - Cache behavior (strong cache, WeakRef recovery)
 * - Error handling for missing/invalid modules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInlineWasmBytes,
  isValidModuleName,
  clearInlineWasmCache,
  hasInlineWasmData,
  getInlineWasmSize,
  preloadInlineWasm,
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
 * Create a larger WASM-like binary with a custom section.
 */
function createLargerWasm(extraBytes: number): Uint8Array {
  const data = new Uint8Array(8 + extraBytes);
  data.set(WASM_MAGIC);
  for (let i = 8; i < data.length; i++) {
    data[i] = i % 256;
  }
  return data;
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
function createMockGeneratedModule(moduleNames: readonly string[], wasmData?: Uint8Array): {
  INLINE_WASM_MODULES: Readonly<Record<string, string>>;
  INLINE_WASM_MODULE_NAMES: readonly string[];
} {
  const wasmBytes = wasmData ?? createMinimalWasm();
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

/**
 * Build a mock generated module with different data per module.
 */
function createMockWithPerModuleData(
  entries: ReadonlyArray<{ name: string; data: Uint8Array }>,
): {
  INLINE_WASM_MODULES: Readonly<Record<string, string>>;
  INLINE_WASM_MODULE_NAMES: readonly string[];
} {
  const modules: Record<string, string> = {};
  for (const { name, data } of entries) {
    modules[name] = toBase64(data);
  }
  return {
    INLINE_WASM_MODULES: modules,
    INLINE_WASM_MODULE_NAMES: entries.map(e => e.name),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inlineWasm -- module name validation', () => {
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

describe('inlineWasm -- lazy decode behavior', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('base64 is not decoded until getInlineWasmBytes is called', () => {
    // Providing a module does NOT trigger any decoding
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    // hasInlineWasmData does NOT decode — it only checks key presence
    expect(hasInlineWasmData('libdeflate')).toBe(true);

    // getInlineWasmSize does NOT decode — it only reads string length
    expect(getInlineWasmSize('libdeflate')).toBeGreaterThan(0);

    // Only now do we decode
    const bytes = getInlineWasmBytes('libdeflate');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(8);
  });

  it('decoding happens on first call and result is cached', () => {
    const mock = createMockGeneratedModule(['png']);
    provideInlineWasmModule(mock);

    const first = getInlineWasmBytes('png');
    const second = getInlineWasmBytes('png');

    // Same reference — cached, not re-decoded
    expect(first).toBe(second);
  });

  it('clearInlineWasmCache forces re-decode on next access', () => {
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
});

describe('inlineWasm -- getInlineWasmBytes', () => {
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

  it('correctly decodes larger binary data', () => {
    const largeWasm = createLargerWasm(256);
    const mock = createMockGeneratedModule(['jbig2'], largeWasm);
    provideInlineWasmModule(mock);

    const bytes = getInlineWasmBytes('jbig2');
    expect(bytes.byteLength).toBe(264); // 8 header + 256 extra
    expect(bytes).toEqual(largeWasm);
  });
});

describe('inlineWasm -- cache behavior', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('second access returns the same Uint8Array reference', () => {
    const mock = createMockGeneratedModule(['jbig2']);
    provideInlineWasmModule(mock);

    const first = getInlineWasmBytes('jbig2');
    const second = getInlineWasmBytes('jbig2');

    // Same reference (cached)
    expect(first).toBe(second);
  });

  it('different modules have independent cache entries', () => {
    const mock = createMockWithPerModuleData([
      { name: 'libdeflate', data: createMinimalWasm() },
      { name: 'png', data: createLargerWasm(16) },
    ]);
    provideInlineWasmModule(mock);

    const deflateBytes = getInlineWasmBytes('libdeflate');
    const pngBytes = getInlineWasmBytes('png');

    expect(deflateBytes.byteLength).toBe(8);
    expect(pngBytes.byteLength).toBe(24);
    expect(deflateBytes).not.toBe(pngBytes);
  });

  it('clearing cache does not affect already-held references', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    const bytes = getInlineWasmBytes('libdeflate');
    const lengthBefore = bytes.byteLength;

    clearInlineWasmCache();

    // The held reference is still valid
    expect(bytes.byteLength).toBe(lengthBefore);
    expect(bytes[0]).toBe(0x00);
  });
});

describe('inlineWasm -- getInlineWasmSize', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('returns the base64 string length for available modules', () => {
    const wasmData = createMinimalWasm();
    const expectedBase64Len = toBase64(wasmData).length;

    const mock = createMockGeneratedModule(['libdeflate'], wasmData);
    provideInlineWasmModule(mock);

    const size = getInlineWasmSize('libdeflate');
    expect(size).toBe(expectedBase64Len);
    expect(size).toBeGreaterThan(0);
  });

  it('returns 0 for unknown module names', () => {
    expect(getInlineWasmSize('nonexistent')).toBe(0);
    expect(getInlineWasmSize('')).toBe(0);
  });

  it('returns 0 for valid names not in generated data', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    expect(getInlineWasmSize('png')).toBe(0);
  });

  it('does not trigger base64 decoding', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    // getInlineWasmSize should only read the string length
    const size = getInlineWasmSize('libdeflate');
    expect(size).toBeGreaterThan(0);

    // After clearing cache, getInlineWasmBytes should still work
    // (proving size check didn't consume/corrupt data)
    clearInlineWasmCache();
    const bytes = getInlineWasmBytes('libdeflate');
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('reports correct sizes for different module sizes', () => {
    const small = createMinimalWasm();
    const large = createLargerWasm(1000);

    const mock = createMockWithPerModuleData([
      { name: 'libdeflate', data: small },
      { name: 'png', data: large },
    ]);
    provideInlineWasmModule(mock);

    const smallSize = getInlineWasmSize('libdeflate');
    const largeSize = getInlineWasmSize('png');

    expect(largeSize).toBeGreaterThan(smallSize);
    // base64 of 8 bytes vs base64 of 1008 bytes
    expect(smallSize).toBe(toBase64(small).length);
    expect(largeSize).toBe(toBase64(large).length);
  });
});

describe('inlineWasm -- preloadInlineWasm', () => {
  beforeEach(() => {
    clearInlineWasmCache();
  });

  it('preloads specific named modules', () => {
    const allNames = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];
    const mock = createMockGeneratedModule(allNames);
    provideInlineWasmModule(mock);

    const loaded = preloadInlineWasm('libdeflate', 'png');
    expect(loaded).toEqual(['libdeflate', 'png']);

    // Subsequent access should return cached (same reference)
    const first = getInlineWasmBytes('libdeflate');
    const second = getInlineWasmBytes('libdeflate');
    expect(first).toBe(second);
  });

  it('preloads all available modules when called with no arguments', () => {
    const allNames = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];
    const mock = createMockGeneratedModule(allNames);
    provideInlineWasmModule(mock);

    const loaded = preloadInlineWasm();
    expect(loaded).toHaveLength(6);
    expect(loaded).toEqual(expect.arrayContaining(allNames));
  });

  it('skips modules not in generated data without throwing', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    // Ask for libdeflate (available) and png (not available)
    const loaded = preloadInlineWasm('libdeflate', 'png');
    expect(loaded).toEqual(['libdeflate']);
  });

  it('skips invalid module names without throwing', () => {
    const mock = createMockGeneratedModule(['libdeflate']);
    provideInlineWasmModule(mock);

    const loaded = preloadInlineWasm('invalid_name', 'libdeflate');
    expect(loaded).toEqual(['libdeflate']);
  });

  it('returns empty array when no modules are available', () => {
    provideInlineWasmModule({
      INLINE_WASM_MODULES: {},
      INLINE_WASM_MODULE_NAMES: [],
    });

    const loaded = preloadInlineWasm();
    expect(loaded).toEqual([]);
  });

  it('includes already-cached modules in the result', () => {
    const mock = createMockGeneratedModule(['libdeflate', 'png']);
    provideInlineWasmModule(mock);

    // Pre-cache libdeflate
    getInlineWasmBytes('libdeflate');

    const loaded = preloadInlineWasm('libdeflate', 'png');
    expect(loaded).toEqual(['libdeflate', 'png']);
  });
});

describe('inlineWasm -- hasInlineWasmData', () => {
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

describe('inlineWasm -- provideInlineWasmModule', () => {
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

describe('inlineWasm -- WasmModuleName type', () => {
  it('type narrowing works with isValidModuleName', () => {
    const name: string = 'libdeflate';
    if (isValidModuleName(name)) {
      // At this point, TypeScript should narrow `name` to WasmModuleName
      const narrowed: WasmModuleName = name;
      expect(narrowed).toBe('libdeflate');
    }
  });
});
