import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('Cursor position system', () => {
  it('starts at (0, 0)', () => {
    const page = makePage();
    expect(page.getPosition()).toEqual({ x: 0, y: 0 });
    expect(page.getX()).toBe(0);
    expect(page.getY()).toBe(0);
  });

  it('moveTo sets position', () => {
    const page = makePage();
    page.moveTo(100, 200);
    expect(page.getPosition()).toEqual({ x: 100, y: 200 });
  });

  it('moveUp increases y', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveUp(30);
    expect(page.getY()).toBe(130);
  });

  it('moveDown decreases y', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveDown(30);
    expect(page.getY()).toBe(70);
  });

  it('moveRight increases x', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveRight(30);
    expect(page.getX()).toBe(80);
  });

  it('moveLeft decreases x', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveLeft(30);
    expect(page.getX()).toBe(20);
  });

  it('resetPosition returns to (0, 0)', () => {
    const page = makePage();
    page.moveTo(100, 200);
    page.resetPosition();
    expect(page.getPosition()).toEqual({ x: 0, y: 0 });
  });

  it('drawText uses cursor position as fallback', () => {
    const page = makePage();
    page.moveTo(100, 700);
    page.drawText('Hello');
    const ops = page.getContentStreamData();
    expect(ops).toContain('100 700');
  });

  it('explicit x/y overrides cursor', () => {
    const page = makePage();
    page.moveTo(100, 700);
    page.drawText('Hello', { x: 50, y: 500 });
    const ops = page.getContentStreamData();
    expect(ops).toContain('50 500');
    expect(ops).not.toContain('100 700');
  });

  it('drawRectangle uses cursor position', () => {
    const page = makePage();
    page.moveTo(200, 300);
    page.drawRectangle({ width: 50, height: 30 });
    const ops = page.getContentStreamData();
    expect(ops).toContain('200 300 50 30 re');
  });
});
