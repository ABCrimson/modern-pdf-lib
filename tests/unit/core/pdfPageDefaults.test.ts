/**
 * Tests for PdfPage drawing defaults — page-level font, size, colour,
 * and line-height defaults that are used when drawText() is called
 * without explicit options.
 */

import { describe, it, expect } from 'vitest';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry, PdfRef } from '../../../src/core/pdfObjects.js';
import { rgb } from '../../../src/core/operators/color.js';
import type { FontRef } from '../../../src/core/pdfPage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(): { page: PdfPage; registry: PdfObjectRegistry } {
  const registry = new PdfObjectRegistry();
  const page = new PdfPage(PageSizes.A4[0], PageSizes.A4[1], registry);
  return { page, registry };
}

function makeFontRef(name: string, objNum = 42): FontRef {
  return {
    name,
    ref: PdfRef.of(objNum),
    widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
    heightAtSize: (size: number) => size,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfPage drawing defaults', () => {
  // -----------------------------------------------------------------------
  // setFont
  // -----------------------------------------------------------------------

  it('uses default font when drawText has no font option', () => {
    const { page } = makePage();
    const font = makeFontRef('F5', 55);

    page.setFont(font);
    page.drawText('Hello defaults', { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('/F5');
    expect(ops).toContain('Tf');
  });

  it('explicit font option overrides default font', () => {
    const { page } = makePage();
    const defaultFont = makeFontRef('F5', 55);
    const explicitFont = makeFontRef('F9', 99);

    page.setFont(defaultFont);
    page.drawText('Override test', { x: 10, y: 20, font: explicitFont });

    const ops = page.getContentStreamData();
    expect(ops).toContain('/F9');
    expect(ops).not.toContain('/F5');
  });

  // -----------------------------------------------------------------------
  // setFontSize
  // -----------------------------------------------------------------------

  it('uses default font size when drawText has no size option', () => {
    const { page } = makePage();

    page.setFontSize(36);
    page.drawText('Big text', { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('36 Tf');
  });

  it('explicit size option overrides default font size', () => {
    const { page } = makePage();

    page.setFontSize(36);
    page.drawText('Small text', { x: 10, y: 20, size: 8 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('8 Tf');
    expect(ops).not.toContain('36 Tf');
  });

  it('falls back to 12 when neither option nor default is set', () => {
    const { page } = makePage();
    page.drawText('Default size', { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('12 Tf');
  });

  // -----------------------------------------------------------------------
  // setFontColor
  // -----------------------------------------------------------------------

  it('uses default font colour when drawText has no color option', () => {
    const { page } = makePage();

    page.setFontColor(rgb(0.1, 0.2, 0.3));
    page.drawText('Coloured', { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('0.1 0.2 0.3 rg');
  });

  it('explicit color option overrides default font colour', () => {
    const { page } = makePage();

    page.setFontColor(rgb(0.1, 0.2, 0.3));
    page.drawText('Override colour', { x: 10, y: 20, color: rgb(0.9, 0.8, 0.7) });

    const ops = page.getContentStreamData();
    expect(ops).toContain('0.9 0.8 0.7 rg');
    expect(ops).not.toContain('0.1 0.2 0.3 rg');
  });

  it('no colour operator when neither option nor default is set', () => {
    const { page } = makePage();
    page.drawText('No colour', { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    expect(ops).not.toContain('rg');
  });

  // -----------------------------------------------------------------------
  // setLineHeight
  // -----------------------------------------------------------------------

  it('uses default line height for multi-line text', () => {
    const { page } = makePage();

    page.setLineHeight(30);
    page.drawText('Line 1\nLine 2', { x: 10, y: 500 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('30 TL');
  });

  it('explicit lineHeight option overrides default', () => {
    const { page } = makePage();

    page.setLineHeight(30);
    page.drawText('Line 1\nLine 2', { x: 10, y: 500, lineHeight: 50 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('50 TL');
    expect(ops).not.toContain('30 TL');
  });

  // -----------------------------------------------------------------------
  // Combined defaults
  // -----------------------------------------------------------------------

  it('all defaults work together', () => {
    const { page } = makePage();
    const font = makeFontRef('F3', 33);

    page.setFont(font);
    page.setFontSize(20);
    page.setFontColor(rgb(0, 0, 1));
    page.setLineHeight(25);

    page.drawText('Line A\nLine B', { x: 50, y: 700 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('/F3');
    expect(ops).toContain('20 Tf');
    expect(ops).toContain('0 0 1 rg');
    expect(ops).toContain('25 TL');
  });

  // -----------------------------------------------------------------------
  // Defaults don't affect other pages
  // -----------------------------------------------------------------------

  it('defaults are page-local and do not leak to other pages', () => {
    const registry = new PdfObjectRegistry();
    const page1 = new PdfPage(PageSizes.A4[0], PageSizes.A4[1], registry);
    const page2 = new PdfPage(PageSizes.A4[0], PageSizes.A4[1], registry);

    page1.setFont(makeFontRef('F8', 88));
    page1.setFontSize(48);
    page1.setFontColor(rgb(1, 0, 0));
    page1.setLineHeight(60);

    // page2 has no defaults — should fall back to built-in defaults
    page2.drawText('Independent', { x: 10, y: 20 });

    const ops2 = page2.getContentStreamData();
    // Should use fallback font name F1 and size 12
    expect(ops2).toContain('/F1');
    expect(ops2).toContain('12 Tf');
    // Should NOT have the colour set on page1
    expect(ops2).not.toContain('1 0 0 rg');
  });
});
