/**
 * Tests for PdfPage box getters/setters and dimension convenience methods.
 *
 * Covers:
 * - Setting/getting all 5 PDF boxes (MediaBox, CropBox, BleedBox, TrimBox, ArtBox)
 * - Dimension convenience methods (getWidth, getHeight, setWidth, setHeight, setSize, getSize)
 * - Round-trip preservation of boxes through finalize()
 */

import { describe, it, expect } from 'vitest';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(
  width?: number,
  height?: number,
): { page: PdfPage; registry: PdfObjectRegistry } {
  const registry = new PdfObjectRegistry();
  const [w, h] = [width ?? PageSizes.A4[0], height ?? PageSizes.A4[1]];
  const page = new PdfPage(w, h, registry);
  return { page, registry };
}

// ---------------------------------------------------------------------------
// Dimension convenience methods
// ---------------------------------------------------------------------------

describe('PdfPage dimension convenience methods', () => {
  it('getWidth returns the page width', () => {
    const { page } = makePage(300, 400);
    expect(page.getWidth()).toBe(300);
  });

  it('getHeight returns the page height', () => {
    const { page } = makePage(300, 400);
    expect(page.getHeight()).toBe(400);
  });

  it('getWidth/getHeight match width/height getters', () => {
    const { page } = makePage(612, 792);
    expect(page.getWidth()).toBe(page.width);
    expect(page.getHeight()).toBe(page.height);
  });

  it('setWidth updates the page width', () => {
    const { page } = makePage(300, 400);
    page.setWidth(500);
    expect(page.getWidth()).toBe(500);
    expect(page.width).toBe(500);
    // Height should remain unchanged
    expect(page.getHeight()).toBe(400);
  });

  it('setHeight updates the page height', () => {
    const { page } = makePage(300, 400);
    page.setHeight(600);
    expect(page.getHeight()).toBe(600);
    expect(page.height).toBe(600);
    // Width should remain unchanged
    expect(page.getWidth()).toBe(300);
  });

  it('setSize updates both width and height', () => {
    const { page } = makePage(300, 400);
    page.setSize(500, 700);
    expect(page.getWidth()).toBe(500);
    expect(page.getHeight()).toBe(700);
    expect(page.width).toBe(500);
    expect(page.height).toBe(700);
  });

  it('getSize returns width and height object', () => {
    const { page } = makePage(612, 792);
    const size = page.getSize();
    expect(size).toEqual({ width: 612, height: 792 });
  });

  it('getSize reflects changes from setSize', () => {
    const { page } = makePage(300, 400);
    page.setSize(1000, 2000);
    expect(page.getSize()).toEqual({ width: 1000, height: 2000 });
  });

  it('setWidth is reflected in finalize()', () => {
    const { page } = makePage(300, 400);
    page.setWidth(500);
    const entry = page.finalize();
    expect(entry.width).toBe(500);
    expect(entry.height).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// MediaBox
// ---------------------------------------------------------------------------

describe('PdfPage MediaBox', () => {
  it('getMediaBox returns default media box', () => {
    const { page } = makePage(612, 792);
    const box = page.getMediaBox();
    expect(box).toEqual({ x: 0, y: 0, width: 612, height: 792 });
  });

  it('setMediaBox updates media box with origin', () => {
    const { page } = makePage(300, 400);
    page.setMediaBox(10, 20, 500, 700);
    const box = page.getMediaBox();
    expect(box).toEqual({ x: 10, y: 20, width: 500, height: 700 });
  });

  it('setMediaBox updates width/height getters', () => {
    const { page } = makePage(300, 400);
    page.setMediaBox(0, 0, 800, 600);
    expect(page.width).toBe(800);
    expect(page.height).toBe(600);
  });

  it('setMediaBox with non-zero origin is reflected in finalize()', () => {
    const { page } = makePage(300, 400);
    page.setMediaBox(10, 20, 500, 700);
    const entry = page.finalize();
    expect(entry.mediaBox).toEqual([10, 20, 510, 720]);
    expect(entry.width).toBe(500);
    expect(entry.height).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// CropBox
// ---------------------------------------------------------------------------

describe('PdfPage CropBox', () => {
  it('getCropBox returns undefined by default', () => {
    const { page } = makePage();
    expect(page.getCropBox()).toBeUndefined();
  });

  it('setCropBox / getCropBox round-trip', () => {
    const { page } = makePage();
    page.setCropBox(10, 20, 80, 160);
    const box = page.getCropBox();
    expect(box).toBeDefined();
    expect(box).toEqual({ x: 10, y: 20, width: 80, height: 160 });
  });

  it('cropBox is preserved through finalize()', () => {
    const { page } = makePage(300, 400);
    page.setCropBox(10, 20, 100, 200);
    const entry = page.finalize();
    // finalize returns raw [llx, lly, urx, ury]
    expect(entry.cropBox).toEqual([10, 20, 110, 220]);
  });
});

// ---------------------------------------------------------------------------
// BleedBox
// ---------------------------------------------------------------------------

describe('PdfPage BleedBox', () => {
  it('getBleedBox returns undefined by default', () => {
    const { page } = makePage();
    expect(page.getBleedBox()).toBeUndefined();
  });

  it('setBleedBox / getBleedBox round-trip', () => {
    const { page } = makePage();
    page.setBleedBox(5, 5, 585, 831);
    const box = page.getBleedBox();
    expect(box).toBeDefined();
    expect(box).toEqual({ x: 5, y: 5, width: 585, height: 831 });
  });

  it('bleedBox is preserved through finalize()', () => {
    const { page } = makePage(300, 400);
    page.setBleedBox(3, 3, 294, 394);
    const entry = page.finalize();
    expect(entry.bleedBox).toEqual([3, 3, 297, 397]);
  });
});

// ---------------------------------------------------------------------------
// TrimBox
// ---------------------------------------------------------------------------

describe('PdfPage TrimBox', () => {
  it('getTrimBox returns undefined by default', () => {
    const { page } = makePage();
    expect(page.getTrimBox()).toBeUndefined();
  });

  it('setTrimBox / getTrimBox round-trip', () => {
    const { page } = makePage();
    page.setTrimBox(15, 15, 565, 811);
    const box = page.getTrimBox();
    expect(box).toBeDefined();
    expect(box).toEqual({ x: 15, y: 15, width: 565, height: 811 });
  });

  it('trimBox is preserved through finalize()', () => {
    const { page } = makePage(600, 800);
    page.setTrimBox(10, 10, 580, 780);
    const entry = page.finalize();
    expect(entry.trimBox).toEqual([10, 10, 590, 790]);
  });
});

// ---------------------------------------------------------------------------
// ArtBox
// ---------------------------------------------------------------------------

describe('PdfPage ArtBox', () => {
  it('getArtBox returns undefined by default', () => {
    const { page } = makePage();
    expect(page.getArtBox()).toBeUndefined();
  });

  it('setArtBox / getArtBox round-trip', () => {
    const { page } = makePage();
    page.setArtBox(50, 50, 495, 741);
    const box = page.getArtBox();
    expect(box).toBeDefined();
    expect(box).toEqual({ x: 50, y: 50, width: 495, height: 741 });
  });

  it('artBox is preserved through finalize()', () => {
    const { page } = makePage(400, 500);
    page.setArtBox(25, 25, 350, 450);
    const entry = page.finalize();
    expect(entry.artBox).toEqual([25, 25, 375, 475]);
  });
});

// ---------------------------------------------------------------------------
// All boxes together
// ---------------------------------------------------------------------------

describe('PdfPage all boxes together', () => {
  it('all 5 boxes can be set and read independently', () => {
    const { page } = makePage(600, 800);

    page.setMediaBox(0, 0, 600, 800);
    page.setCropBox(10, 10, 580, 780);
    page.setBleedBox(5, 5, 590, 790);
    page.setTrimBox(15, 15, 570, 770);
    page.setArtBox(50, 50, 500, 700);

    expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 600, height: 800 });
    expect(page.getCropBox()).toEqual({ x: 10, y: 10, width: 580, height: 780 });
    expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 590, height: 790 });
    expect(page.getTrimBox()).toEqual({ x: 15, y: 15, width: 570, height: 770 });
    expect(page.getArtBox()).toEqual({ x: 50, y: 50, width: 500, height: 700 });
  });

  it('all boxes are preserved through finalize()', () => {
    const { page } = makePage(600, 800);

    page.setMediaBox(0, 0, 600, 800);
    page.setCropBox(10, 10, 580, 780);
    page.setBleedBox(5, 5, 590, 790);
    page.setTrimBox(15, 15, 570, 770);
    page.setArtBox(50, 50, 500, 700);

    const entry = page.finalize();

    expect(entry.mediaBox).toEqual([0, 0, 600, 800]);
    expect(entry.cropBox).toEqual([10, 10, 590, 790]);
    expect(entry.bleedBox).toEqual([5, 5, 595, 795]);
    expect(entry.trimBox).toEqual([15, 15, 585, 785]);
    expect(entry.artBox).toEqual([50, 50, 550, 750]);
    expect(entry.width).toBe(600);
    expect(entry.height).toBe(800);
  });

  it('undefined boxes are not present in finalize() output', () => {
    const { page } = makePage(600, 800);
    // Only set cropBox, leave others undefined
    page.setCropBox(10, 10, 580, 780);

    const entry = page.finalize();

    expect(entry.cropBox).toBeDefined();
    expect(entry.bleedBox).toBeUndefined();
    expect(entry.artBox).toBeUndefined();
    expect(entry.trimBox).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// _fromParsed preserves boxes
// ---------------------------------------------------------------------------

describe('PdfPage._fromParsed box preservation', () => {
  it('preserves cropBox from parsed data', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      cropBox: [10, 20, 590, 770],
    });
    const box = page.getCropBox();
    expect(box).toEqual({ x: 10, y: 20, width: 580, height: 750 });
  });

  it('preserves bleedBox from parsed data', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      bleedBox: [5, 5, 607, 787],
    });
    const box = page.getBleedBox();
    expect(box).toEqual({ x: 5, y: 5, width: 602, height: 782 });
  });

  it('preserves artBox from parsed data', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      artBox: [50, 50, 562, 742],
    });
    const box = page.getArtBox();
    expect(box).toEqual({ x: 50, y: 50, width: 512, height: 692 });
  });

  it('preserves trimBox from parsed data', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      trimBox: [15, 15, 597, 777],
    });
    const box = page.getTrimBox();
    expect(box).toEqual({ x: 15, y: 15, width: 582, height: 762 });
  });

  it('preserves all boxes from parsed data', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      cropBox: [10, 10, 602, 782],
      bleedBox: [5, 5, 607, 787],
      artBox: [50, 50, 562, 742],
      trimBox: [15, 15, 597, 777],
    });

    expect(page.getCropBox()).toEqual({ x: 10, y: 10, width: 592, height: 772 });
    expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 602, height: 782 });
    expect(page.getArtBox()).toEqual({ x: 50, y: 50, width: 512, height: 692 });
    expect(page.getTrimBox()).toEqual({ x: 15, y: 15, width: 582, height: 762 });
  });

  it('parsed boxes survive finalize round-trip', () => {
    const registry = new PdfObjectRegistry();
    const page = PdfPage._fromParsed(612, 792, registry, {
      cropBox: [10, 20, 100, 200],
      bleedBox: [3, 3, 609, 789],
      artBox: [50, 50, 562, 742],
      trimBox: [15, 15, 597, 777],
    });

    const entry = page.finalize();

    expect(entry.cropBox).toEqual([10, 20, 100, 200]);
    expect(entry.bleedBox).toEqual([3, 3, 609, 789]);
    expect(entry.artBox).toEqual([50, 50, 562, 742]);
    expect(entry.trimBox).toEqual([15, 15, 597, 777]);
  });
});
