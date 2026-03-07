/**
 * Tests for QR code encoding and PDF operator generation (ISO 18004).
 */

import { describe, it, expect } from 'vitest';
import {
  encodeQrCode,
  qrCodeToOperators,
} from '../../src/barcode/qr.js';
import type { QrCodeMatrix, QrCodeOptions } from '../../src/barcode/qr.js';
import { rgb, grayscale } from '../../src/core/operators/color.js';
import { createPdf } from '../../src/core/pdfDocument.js';

describe('QR Code Encoder', () => {
  // -----------------------------------------------------------------------
  // 1. Version 1 produces a 21x21 matrix
  // -----------------------------------------------------------------------
  it('returns correct matrix size for version 1 (21x21)', () => {
    // Short data that fits in version 1 with EC level L
    const matrix = encodeQrCode('1', 'L');
    expect(matrix.version).toBe(1);
    expect(matrix.size).toBe(21); // version 1 = 4*1 + 17 = 21
    expect(matrix.modules.length).toBe(21 * 21);
  });

  // -----------------------------------------------------------------------
  // 2. Auto-selects version based on data length
  // -----------------------------------------------------------------------
  it('auto-selects version based on data length', () => {
    const short = encodeQrCode('Hi', 'L');
    const long = encodeQrCode('A'.repeat(100), 'L');
    expect(long.version).toBeGreaterThan(short.version);
    expect(long.size).toBeGreaterThan(short.size);
  });

  // -----------------------------------------------------------------------
  // 3. Handles all 4 EC levels
  // -----------------------------------------------------------------------
  it('handles all 4 error correction levels', () => {
    const data = 'Hello, World!';
    const matrixL = encodeQrCode(data, 'L');
    const matrixM = encodeQrCode(data, 'M');
    const matrixQ = encodeQrCode(data, 'Q');
    const matrixH = encodeQrCode(data, 'H');

    // All produce valid matrices
    for (const m of [matrixL, matrixM, matrixQ, matrixH]) {
      expect(m.size).toBeGreaterThanOrEqual(21);
      expect(m.modules.length).toBe(m.size * m.size);
      expect(m.version).toBeGreaterThanOrEqual(1);
    }

    // Higher EC may require larger version for same data
    expect(matrixH.version).toBeGreaterThanOrEqual(matrixL.version);
  });

  // -----------------------------------------------------------------------
  // 4. Finder patterns present (7x7 in three corners)
  // -----------------------------------------------------------------------
  it('has correct finder patterns in corners', () => {
    const matrix = encodeQrCode('Test', 'M');
    const { size, modules } = matrix;

    // Helper to get module at (row, col)
    const get = (r: number, c: number) => modules[r * size + c];

    // Top-left finder: row 0, cols 0-6 should have the pattern
    // First row of finder: all dark
    for (let c = 0; c < 7; c++) {
      expect(get(0, c)).toBe(true);
    }
    // Second row: dark, 5 light, dark -> dark at 0 and 6, light at 1-5
    expect(get(1, 0)).toBe(true);
    expect(get(1, 1)).toBe(false);
    expect(get(1, 5)).toBe(false);
    expect(get(1, 6)).toBe(true);

    // Top-right finder: row 0, cols (size-7) to (size-1)
    const trCol = size - 7;
    for (let c = trCol; c < size; c++) {
      expect(get(0, c)).toBe(true);
    }

    // Bottom-left finder: row (size-7), cols 0-6
    const blRow = size - 7;
    for (let c = 0; c < 7; c++) {
      expect(get(blRow, c)).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 5. Timing patterns present
  // -----------------------------------------------------------------------
  it('has timing patterns on row 6 and column 6', () => {
    const matrix = encodeQrCode('Test', 'M');
    const { size, modules } = matrix;
    const get = (r: number, c: number) => modules[r * size + c];

    // Horizontal timing: row 6, cols 8 to (size-9) should alternate
    for (let c = 8; c < size - 8; c++) {
      const expected = c % 2 === 0; // even cols are dark
      expect(get(6, c)).toBe(expected);
    }

    // Vertical timing: col 6, rows 8 to (size-9) should alternate
    for (let r = 8; r < size - 8; r++) {
      const expected = r % 2 === 0; // even rows are dark
      expect(get(r, 6)).toBe(expected);
    }
  });

  // -----------------------------------------------------------------------
  // 6. Handles numeric data
  // -----------------------------------------------------------------------
  it('handles numeric data', () => {
    const matrix = encodeQrCode('0123456789', 'M');
    expect(matrix.version).toBeGreaterThanOrEqual(1);
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    // All modules are boolean
    for (const m of matrix.modules) {
      expect(typeof m).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 7. Handles alphanumeric data
  // -----------------------------------------------------------------------
  it('handles alphanumeric data', () => {
    const matrix = encodeQrCode('HELLO WORLD', 'M');
    expect(matrix.version).toBeGreaterThanOrEqual(1);
    expect(matrix.modules.length).toBe(matrix.size * matrix.size);
  });

  // -----------------------------------------------------------------------
  // 8. Handles byte mode (UTF-8)
  // -----------------------------------------------------------------------
  it('handles byte mode with special characters', () => {
    const matrix = encodeQrCode('hello@world.com', 'M');
    expect(matrix.version).toBeGreaterThanOrEqual(1);
    expect(matrix.modules.length).toBe(matrix.size * matrix.size);
  });

  // -----------------------------------------------------------------------
  // 9. Handles very short data (single character)
  // -----------------------------------------------------------------------
  it('handles very short data', () => {
    const matrix = encodeQrCode('A', 'L');
    expect(matrix.version).toBe(1);
    expect(matrix.size).toBe(21);
    expect(matrix.modules.length).toBe(441); // 21*21
  });

  // -----------------------------------------------------------------------
  // 10. Max capacity for version 1 EC-L (byte mode: 17 bytes)
  // -----------------------------------------------------------------------
  it('handles max capacity for version 1 with EC-L in byte mode', () => {
    // Version 1, EC L has 19 data codewords.
    // Byte mode overhead: 4 (mode) + 8 (count) = 12 bits.
    // 19*8 - 12 = 140 bits = 17 bytes of data + 4 bits remaining (not enough for another byte)
    // So max 17 ASCII chars in byte mode for V1-L
    const data = 'ABCDEFGHIJKLMNOPQ'; // 17 chars, all lowercase would be byte mode; uppercase is alphanumeric
    const matrixByteMode = encodeQrCode('abcdefghijklmnopq', 'L'); // lowercase forces byte mode
    expect(matrixByteMode.version).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 11. qrCodeToOperators generates valid PDF operators
  // -----------------------------------------------------------------------
  it('generates valid PDF operators', () => {
    const matrix = encodeQrCode('Test', 'M');
    const ops = qrCodeToOperators(matrix, 50, 100);

    // Should contain PDF operator keywords
    expect(ops).toContain('q\n');   // saveState
    expect(ops).toContain('Q\n');   // restoreState
    expect(ops).toContain(' re\n'); // rectangle
    expect(ops).toContain('f\n');   // fill
  });

  // -----------------------------------------------------------------------
  // 12. qrCodeToOperators includes saveState/restoreState
  // -----------------------------------------------------------------------
  it('wraps operators in saveState/restoreState', () => {
    const matrix = encodeQrCode('X', 'L');
    const ops = qrCodeToOperators(matrix, 0, 0);

    // Starts with 'q\n' and ends with 'Q\n'
    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.trimEnd().endsWith('Q')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 13. qrCodeToOperators uses correct module size
  // -----------------------------------------------------------------------
  it('uses correct module size', () => {
    const matrix = encodeQrCode('A', 'L');
    const ops3 = qrCodeToOperators(matrix, 0, 0, { moduleSize: 3 });
    const ops5 = qrCodeToOperators(matrix, 0, 0, { moduleSize: 5 });

    // Module size 3: rectangles should be "3 3 re"
    expect(ops3).toContain('3 3 re\n');

    // Module size 5: rectangles should be "5 5 re"
    expect(ops5).toContain('5 5 re\n');
  });

  // -----------------------------------------------------------------------
  // 14. qrCodeToOperators handles custom colours
  // -----------------------------------------------------------------------
  it('handles custom colours', () => {
    const matrix = encodeQrCode('Color', 'L');
    const ops = qrCodeToOperators(matrix, 0, 0, {
      color: rgb(1, 0, 0),           // red foreground
      backgroundColor: rgb(1, 1, 0), // yellow background
    });

    // Should contain the RGB fill operators
    expect(ops).toContain('1 1 0 rg\n'); // yellow background
    expect(ops).toContain('1 0 0 rg\n'); // red foreground
  });

  // -----------------------------------------------------------------------
  // 15. drawQrCode on PdfPage generates operators
  // -----------------------------------------------------------------------
  it('drawQrCode on PdfPage generates operators', () => {
    const doc = createPdf();
    const page = doc.addPage([400, 400]);
    page.drawQrCode('https://example.com', {
      x: 50,
      y: 50,
      moduleSize: 3,
      errorCorrection: 'H',
    });

    // The page should have content (ops is internal, but we can verify
    // the page builds successfully by finalizing it)
    const pageEntry = page.finalize();
    expect(pageEntry).toBeDefined();
    expect(pageEntry.width).toBe(400);
    expect(pageEntry.height).toBe(400);
  });

  // -----------------------------------------------------------------------
  // 16. Default EC level is M
  // -----------------------------------------------------------------------
  it('defaults to EC level M', () => {
    const matrixDefault = encodeQrCode('test data');
    const matrixM = encodeQrCode('test data', 'M');
    // Same EC level should produce identical matrices
    expect(matrixDefault.version).toBe(matrixM.version);
    expect(matrixDefault.size).toBe(matrixM.size);
    expect(matrixDefault.modules).toEqual(matrixM.modules);
  });

  // -----------------------------------------------------------------------
  // 17. Quiet zone affects total rendered size
  // -----------------------------------------------------------------------
  it('quiet zone affects total rendered size', () => {
    const matrix = encodeQrCode('QZ', 'L');
    const ops4 = qrCodeToOperators(matrix, 0, 0, { quietZone: 4, moduleSize: 1 });
    const ops0 = qrCodeToOperators(matrix, 0, 0, { quietZone: 0, moduleSize: 1 });

    // With quiet zone = 4, total size = (size + 8) * moduleSize
    // With quiet zone = 0, total size = size * moduleSize
    // The background rectangle should differ
    const totalWith4 = matrix.size + 8;
    const totalWith0 = matrix.size;

    expect(ops4).toContain(`${totalWith4} ${totalWith4} re\n`);
    expect(ops0).toContain(`${totalWith0} ${totalWith0} re\n`);
  });

  // -----------------------------------------------------------------------
  // 18. Matrix modules are all boolean
  // -----------------------------------------------------------------------
  it('all modules are boolean values', () => {
    const matrix = encodeQrCode('boolean check', 'Q');
    for (const mod of matrix.modules) {
      expect(typeof mod).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 19. Higher EC versions for same data
  // -----------------------------------------------------------------------
  it('higher EC levels may require higher versions', () => {
    // A string that is near version boundary
    const data = 'X'.repeat(15);
    const mL = encodeQrCode(data, 'L');
    const mH = encodeQrCode(data, 'H');
    expect(mH.version).toBeGreaterThanOrEqual(mL.version);
  });

  // -----------------------------------------------------------------------
  // 20. Grayscale default colours
  // -----------------------------------------------------------------------
  it('uses grayscale defaults (black on white)', () => {
    const matrix = encodeQrCode('gs', 'L');
    const ops = qrCodeToOperators(matrix, 10, 20);

    // Default: background is white (1 g), foreground is black (0 g)
    expect(ops).toContain('1 g\n'); // white background
    expect(ops).toContain('0 g\n'); // black foreground
  });
});
