/**
 * Tests for barcode styling utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  renderStyledBarcode,
  calculateBarcodeDimensions,
} from '../../src/barcode/style.js';
import type { StyledBarcodeOptions } from '../../src/barcode/style.js';
import { encodeCode128 } from '../../src/barcode/code128.js';
import { encodeEan13 } from '../../src/barcode/ean.js';
import type { BarcodeMatrix } from '../../src/barcode/types.js';
import { rgb, grayscale } from '../../src/core/operators/color.js';

// Helper: create a simple test matrix
function testMatrix(): BarcodeMatrix {
  return encodeCode128('TEST');
}

describe('Barcode Styling', () => {
  // -----------------------------------------------------------------------
  // 1. renderStyledBarcode generates valid operators with defaults
  // -----------------------------------------------------------------------
  it('generates valid operators with default options', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 10, 20, 'TEST');

    // Must start with save state and end with restore state
    expect(ops).toMatch(/^q\n/);
    expect(ops).toMatch(/Q\n$/);

    // Must contain fill commands (background + bars)
    expect(ops).toContain(' re\n');
    expect(ops).toContain('f\n');
  });

  // -----------------------------------------------------------------------
  // 2. Includes background rectangle
  // -----------------------------------------------------------------------
  it('includes background rectangle', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'TEST');

    // The first rectangle after q and color set is the background.
    // Default background is white (1 g)
    expect(ops).toContain('1 g\n');
  });

  // -----------------------------------------------------------------------
  // 3. Includes background with custom backgroundColor
  // -----------------------------------------------------------------------
  it('applies custom background color', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'TEST', {
      backgroundColor: rgb(1, 1, 0.8),
    });

    // Should contain the RGB fill color for background
    expect(ops).toContain('1 1 0.8 rg\n');
  });

  // -----------------------------------------------------------------------
  // 4. Includes border when border option is true
  // -----------------------------------------------------------------------
  it('includes border when border option is true', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'TEST', {
      border: true,
    });

    // Should contain stroke operator for the border
    expect(ops).toContain('S\n');
    // Should set line width (default 0.5)
    expect(ops).toContain('0.5 w\n');
  });

  // -----------------------------------------------------------------------
  // 5. Border uses custom color and width
  // -----------------------------------------------------------------------
  it('applies custom border color and width', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'TEST', {
      border: true,
      borderWidth: 2,
      borderColor: rgb(1, 0, 0),
    });

    // Should contain the custom line width
    expect(ops).toContain('2 w\n');
    // Should contain the red stroke color
    expect(ops).toContain('1 0 0 RG\n');
    // Should have a stroke
    expect(ops).toContain('S\n');
  });

  // -----------------------------------------------------------------------
  // 6. Does not include border when border option is false/default
  // -----------------------------------------------------------------------
  it('does not include border by default', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'TEST');

    // Should not contain stroke operator (S is only from border)
    // The ops should have 'f\n' for fill but not standalone 'S\n' for stroke
    const lines = ops.split('\n');
    const strokeLines = lines.filter((l) => l.trim() === 'S');
    expect(strokeLines.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 7. Includes human-readable text when showText is true
  // -----------------------------------------------------------------------
  it('includes human-readable text when showText is true', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'HELLO', {
      showText: true,
    });

    // Should contain text operators
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');
    expect(ops).toContain('(HELLO) Tj\n');
  });

  // -----------------------------------------------------------------------
  // 8. Text uses correct font name and size
  // -----------------------------------------------------------------------
  it('text uses specified font name and size', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'DATA', {
      showText: true,
      fontName: 'Courier',
      fontSize: 14,
    });

    // Should set the font
    expect(ops).toContain('/Courier 14 Tf\n');
  });

  // -----------------------------------------------------------------------
  // 9. Text uses default font (Helvetica) and size (10)
  // -----------------------------------------------------------------------
  it('text uses default font when not specified', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'DATA', {
      showText: true,
    });

    expect(ops).toContain('/Helvetica 10 Tf\n');
  });

  // -----------------------------------------------------------------------
  // 10. Custom bar and text colors applied
  // -----------------------------------------------------------------------
  it('applies custom bar color and text color', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'DATA', {
      showText: true,
      color: rgb(0, 0, 0.5),
      textColor: rgb(0.2, 0.2, 0.2),
    });

    // Bar color: dark blue
    expect(ops).toContain('0 0 0.5 rg\n');
    // Text color: dark gray
    expect(ops).toContain('0.2 0.2 0.2 rg\n');
  });

  // -----------------------------------------------------------------------
  // 11. No text when showText is false (default)
  // -----------------------------------------------------------------------
  it('does not include text when showText is false', () => {
    const matrix = testMatrix();
    const ops = renderStyledBarcode(matrix, 0, 0, 'DATA');

    expect(ops).not.toContain('BT\n');
    expect(ops).not.toContain('Tj\n');
  });

  // -----------------------------------------------------------------------
  // 12. calculateBarcodeDimensions returns correct defaults
  // -----------------------------------------------------------------------
  it('calculateBarcodeDimensions returns correct dimensions with defaults', () => {
    const matrix = testMatrix();
    const dims = calculateBarcodeDimensions(matrix);

    // Default: moduleWidth=1, quietZone=10, height=50, no border, no text, no padding
    expect(dims.width).toBe(matrix.width + 20); // modules + 2*quietZone
    expect(dims.height).toBe(50); // just bar height
  });

  // -----------------------------------------------------------------------
  // 13. calculateBarcodeDimensions accounts for showText
  // -----------------------------------------------------------------------
  it('calculateBarcodeDimensions accounts for text height', () => {
    const matrix = testMatrix();
    const dimsNoText = calculateBarcodeDimensions(matrix);
    const dimsWithText = calculateBarcodeDimensions(matrix, { showText: true, fontSize: 12 });

    // Text adds (fontSize + 4) = 16
    expect(dimsWithText.height).toBe(dimsNoText.height + 16);
  });

  // -----------------------------------------------------------------------
  // 14. calculateBarcodeDimensions accounts for border and padding
  // -----------------------------------------------------------------------
  it('calculateBarcodeDimensions accounts for border and padding', () => {
    const matrix = testMatrix();
    const dimsNoBorder = calculateBarcodeDimensions(matrix);
    const dimsWithBorder = calculateBarcodeDimensions(matrix, {
      border: true,
      borderWidth: 1,
      padding: 5,
    });

    // Border adds 2*borderWidth + 2*padding on each axis
    expect(dimsWithBorder.width).toBe(dimsNoBorder.width + 12); // +2*1 + 2*5
    expect(dimsWithBorder.height).toBe(dimsNoBorder.height + 12);
  });

  // -----------------------------------------------------------------------
  // 15. calculateBarcodeDimensions accounts for moduleWidth
  // -----------------------------------------------------------------------
  it('calculateBarcodeDimensions scales with moduleWidth', () => {
    const matrix = testMatrix();
    const dims1 = calculateBarcodeDimensions(matrix, { moduleWidth: 1 });
    const dims2 = calculateBarcodeDimensions(matrix, { moduleWidth: 2 });

    // Width should double when moduleWidth doubles
    expect(dims2.width).toBe(dims1.width * 2);
    // Height should not change (bar height is independent of module width)
    expect(dims2.height).toBe(dims1.height);
  });

  // -----------------------------------------------------------------------
  // 16. Works with EAN-13 matrix
  // -----------------------------------------------------------------------
  it('works with EAN-13 barcode matrix', () => {
    const matrix = encodeEan13('590123412345');
    const ops = renderStyledBarcode(matrix, 50, 100, '5901234123457', {
      showText: true,
      border: true,
    });

    expect(ops).toMatch(/^q\n/);
    expect(ops).toMatch(/Q\n$/);
    expect(ops).toContain('BT\n');
    expect(ops).toContain('(5901234123457) Tj\n');
  });
});
