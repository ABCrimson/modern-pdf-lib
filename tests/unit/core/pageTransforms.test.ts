import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

function makePage(w = 612, h = 792) {
  const registry = new PdfObjectRegistry();
  return new PdfPage(w, h, registry);
}

describe('resetSize', () => {
  it('restores original dimensions after setSize', () => {
    const page = makePage(612, 792);
    page.setSize(300, 400);
    expect(page.getWidth()).toBe(300);
    expect(page.getHeight()).toBe(400);
    page.resetSize();
    expect(page.getWidth()).toBe(612);
    expect(page.getHeight()).toBe(792);
  });

  it('works after multiple setSize calls', () => {
    const page = makePage(100, 200);
    page.setSize(50, 60);
    page.setSize(70, 80);
    page.resetSize();
    expect(page.getWidth()).toBe(100);
    expect(page.getHeight()).toBe(200);
  });
});

describe('translateContent', () => {
  it('prepends a translation matrix to content stream', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.translateContent(100, 200);
    const ops = page.getContentStreamData();
    // The translation cm should appear BEFORE the drawing ops
    const cmIdx = ops.indexOf('1 0 0 1 100 200 cm');
    const rectIdx = ops.indexOf('10 20 50 30 re');
    expect(cmIdx).toBeGreaterThanOrEqual(0);
    expect(rectIdx).toBeGreaterThan(cmIdx);
  });
});

describe('scaleContent', () => {
  it('prepends a scale matrix to content stream', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.scaleContent(2, 0.5);
    const ops = page.getContentStreamData();
    expect(ops).toContain('2 0 0 0.5 0 0 cm');
  });

  it('scale matrix appears before drawing operations', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.scaleContent(3, 3);
    const ops = page.getContentStreamData();
    const cmIdx = ops.indexOf('3 0 0 3 0 0 cm');
    const rectIdx = ops.indexOf('10 20 50 30 re');
    expect(cmIdx).toBeGreaterThanOrEqual(0);
    expect(rectIdx).toBeGreaterThan(cmIdx);
  });
});

describe('scale', () => {
  it('scales page dimensions', () => {
    const page = makePage(612, 792);
    page.scale(2, 2);
    expect(page.getWidth()).toBe(1224);
    expect(page.getHeight()).toBe(1584);
  });

  it('scales content stream', () => {
    const page = makePage(612, 792);
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.scale(2, 2);
    const ops = page.getContentStreamData();
    expect(ops).toContain('2 0 0 2 0 0 cm');
  });
});

describe('scaleAnnotations', () => {
  it('does not throw when page has no annotations', () => {
    const page = makePage();
    expect(() => page.scaleAnnotations(2, 2)).not.toThrow();
  });
});
