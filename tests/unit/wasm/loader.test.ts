/**
 * @module tests/unit/wasm/loader
 *
 * The WASM loader rejects a module name it does not know before it looks for a file.
 */

import { describe, expect, it } from 'vitest';
import { loadWasmModule } from '../../../src/wasm/loader.js';

describe('loadWasmModule', () => {
  it('rejects a module name it does not know', async () => {
    await expect(loadWasmModule('no-such-crate')).rejects.toThrow(
      'Unknown WASM module: "no-such-crate"',
    );
  });
});
