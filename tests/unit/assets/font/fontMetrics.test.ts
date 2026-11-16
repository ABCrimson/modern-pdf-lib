/**
 * Errors of the TrueType metrics reader.
 */

import { describe, it, expect } from 'vitest';
import { extractMetrics } from '../../../../src/assets/font/fontMetrics.js';
import { MalformedInputError } from '../../../../src/errors.js';

describe('extractMetrics typed errors', () => {
  it('throws MalformedInputError of format sfnt when a required table is missing', () => {
    // A 12-byte sfnt header that declares no tables, so `head` cannot be found.
    const noTables = new Uint8Array(12);
    noTables.set([0x00, 0x01, 0x00, 0x00], 0);
    let error: unknown;
    try {
      extractMetrics(noTables);
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(MalformedInputError);
    expect(error).toMatchObject({
      code: 'malformed-input',
      format: 'sfnt',
      message: "Required TrueType table 'head' not found",
    });
  });
});
