import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { TextRenderingMode } from '../../../src/core/enums.js';
import { degrees } from '../../../src/core/operators/state.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('TextRenderingMode in drawText', () => {
  it('emits Tr operator when renderingMode is set', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700, renderingMode: TextRenderingMode.Outline });
    const ops = page.getContentStreamData();
    expect(ops).toContain('1 Tr');
  });

  it('emits Tr 2 for FillAndOutline', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700, renderingMode: TextRenderingMode.FillAndOutline });
    const ops = page.getContentStreamData();
    expect(ops).toContain('2 Tr');
  });

  it('does not emit Tr when renderingMode is not set', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700 });
    const ops = page.getContentStreamData();
    expect(ops).not.toContain(' Tr');
  });

  it('emits Tr 3 for Invisible', () => {
    const page = makePage();
    page.drawText('Hidden', { x: 50, y: 700, renderingMode: TextRenderingMode.Invisible });
    const ops = page.getContentStreamData();
    expect(ops).toContain('3 Tr');
  });
});

describe('Text skew in drawText', () => {
  it('emits Tm matrix when xSkew is set', () => {
    const page = makePage();
    page.drawText('Skewed', { x: 50, y: 700, xSkew: degrees(15) });
    const ops = page.getContentStreamData();
    expect(ops).toContain(' Tm');
    // Should NOT use simple Td positioning
    expect(ops).not.toContain('50 700 Td');
  });

  it('emits Tm matrix when ySkew is set', () => {
    const page = makePage();
    page.drawText('Skewed', { x: 50, y: 700, ySkew: degrees(15) });
    const ops = page.getContentStreamData();
    expect(ops).toContain(' Tm');
  });

  it('combines rotation and skew in Tm matrix', () => {
    const page = makePage();
    page.drawText('Both', {
      x: 50, y: 700,
      rotate: degrees(45),
      xSkew: degrees(10),
    });
    const ops = page.getContentStreamData();
    expect(ops).toContain(' Tm');
  });

  it('uses Td when no rotation and no skew', () => {
    const page = makePage();
    page.drawText('Normal', { x: 50, y: 700 });
    const ops = page.getContentStreamData();
    expect(ops).toContain('50 700 Td');
    expect(ops).not.toContain(' Tm');
  });
});
