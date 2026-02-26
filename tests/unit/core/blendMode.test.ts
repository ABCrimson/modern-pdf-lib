import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { BlendMode } from '../../../src/core/enums.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('BlendMode in drawing operations', () => {
  it('drawRectangle emits ExtGState with gs when blendMode is set', () => {
    const page = makePage();
    page.drawRectangle({ x: 0, y: 0, width: 100, height: 50, blendMode: BlendMode.Multiply });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawSquare accepts blendMode', () => {
    const page = makePage();
    page.drawSquare({ x: 0, y: 0, size: 50, blendMode: BlendMode.Screen });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawSquare defaults to size 100', () => {
    const page = makePage();
    page.drawSquare({});
    const ops = page.getContentStreamData();
    expect(ops).toContain('100 100 re');
  });

  it('drawText accepts blendMode', () => {
    const page = makePage();
    page.drawText('Hello', { x: 0, y: 0, blendMode: BlendMode.Overlay });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawCircle accepts blendMode', () => {
    const page = makePage();
    page.drawCircle({ x: 50, y: 50, radius: 25, blendMode: BlendMode.Darken });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawEllipse accepts blendMode', () => {
    const page = makePage();
    page.drawEllipse({ x: 50, y: 50, xScale: 30, yScale: 20, blendMode: BlendMode.Lighten });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawLine accepts blendMode', () => {
    const page = makePage();
    page.drawLine({ start: { x: 0, y: 0 }, end: { x: 100, y: 100 }, blendMode: BlendMode.ColorDodge });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawSvgPath accepts blendMode', () => {
    const page = makePage();
    page.drawSvgPath('M 0 0 L 100 100', { blendMode: BlendMode.Exclusion });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('combines blendMode with opacity in same ExtGState', () => {
    const page = makePage();
    page.drawRectangle({ opacity: 0.5, blendMode: BlendMode.Multiply });
    const ops = page.getContentStreamData();
    // Should use a single gs call, not two
    const gsMatches = ops.match(/gs\n/g);
    expect(gsMatches).toHaveLength(1);
  });

  it('does not emit gs when no blendMode and no opacity', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    const ops = page.getContentStreamData();
    expect(ops).not.toContain('gs');
  });
});
