/**
 * Tests for PdfPage — a single page in a PDF document.
 *
 * Covers drawing operations, graphics state management, and content
 * stream generation.
 */

import { describe, it, expect } from 'vitest';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry, PdfRef } from '../../../src/core/pdfObjects.js';
import { rgb, cmyk, grayscale } from '../../../src/core/operators/color.js';
import { degrees, radians } from '../../../src/core/operators/state.js';

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
// Tests
// ---------------------------------------------------------------------------

describe('PdfPage', () => {
  // -------------------------------------------------------------------------
  // Dimensions
  // -------------------------------------------------------------------------

  it('has correct default dimensions', () => {
    const { page } = makePage();
    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
  });

  it('has correct custom dimensions', () => {
    const { page } = makePage(300, 400);
    expect(page.width).toBe(300);
    expect(page.height).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  it('allocates pageRef and contentStreamRef', () => {
    const { page } = makePage();
    expect(page.pageRef).toBeInstanceOf(PdfRef);
    expect(page.contentStreamRef).toBeInstanceOf(PdfRef);
    expect(page.pageRef.objectNumber).not.toBe(page.contentStreamRef.objectNumber);
  });

  // -------------------------------------------------------------------------
  // drawText
  // -------------------------------------------------------------------------

  it('drawText queues text operators', () => {
    const { page } = makePage();
    page.drawText('Hello, World!', { x: 50, y: 700, size: 24 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('BT');
    expect(ops).toContain('ET');
    expect(ops).toContain('Tf');
    expect(ops).toContain('Tj');
    expect(ops).toContain('Hello, World!');
    expect(ops).toContain('50');
    expect(ops).toContain('700');
    expect(ops).toContain('24');
  });

  it('drawText wraps in q/Q (save/restore)', () => {
    const { page } = makePage();
    page.drawText('Test', { x: 0, y: 0 });

    const ops = page.getContentStreamData();
    expect(ops).toMatch(/^q\n/);
    expect(ops).toMatch(/Q\n$/);
  });

  it('drawText applies colour operator', () => {
    const { page } = makePage();
    page.drawText('Coloured', {
      x: 10,
      y: 20,
      color: rgb(0.1, 0.2, 0.3),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('0.1');
    expect(ops).toContain('0.2');
    expect(ops).toContain('0.3');
    expect(ops).toContain('rg');
  });

  it('drawText handles multi-line text', () => {
    const { page } = makePage();
    page.drawText('Line 1\nLine 2\nLine 3', { x: 50, y: 700 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('Line 1');
    expect(ops).toContain('Line 2');
    expect(ops).toContain('Line 3');
    expect(ops).toContain('TL'); // set leading
    expect(ops).toContain('T*'); // next line
  });

  it('drawText with rotation applies text matrix (Tm)', () => {
    const { page } = makePage();
    page.drawText('Rotated', { x: 100, y: 200, rotate: degrees(45) });

    const ops = page.getContentStreamData();
    expect(ops).toContain('Tm');
  });

  // -------------------------------------------------------------------------
  // drawRectangle
  // -------------------------------------------------------------------------

  it('drawRectangle queues graphics operators', () => {
    const { page } = makePage();
    page.drawRectangle({ x: 50, y: 100, width: 200, height: 50 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('re'); // rectangle operator
    expect(ops).toContain('50');
    expect(ops).toContain('100');
    expect(ops).toContain('200');
  });

  it('drawRectangle with fill and stroke emits B operator', () => {
    const { page } = makePage();
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      color: rgb(1, 0, 0),
      borderColor: rgb(0, 0, 0),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('B\n'); // fill and stroke
  });

  it('drawRectangle with only fill emits f operator', () => {
    const { page } = makePage();
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      color: rgb(0, 0, 1),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('f\n'); // fill
  });

  it('drawRectangle with only stroke emits S operator', () => {
    const { page } = makePage();
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      borderColor: rgb(0, 0, 0),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('S\n'); // stroke
  });

  // -------------------------------------------------------------------------
  // drawLine
  // -------------------------------------------------------------------------

  it('drawLine queues line operators', () => {
    const { page } = makePage();
    page.drawLine({
      start: { x: 50, y: 300 },
      end: { x: 250, y: 300 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('m');   // moveTo
    expect(ops).toContain('l');   // lineTo
    expect(ops).toContain('S\n'); // stroke
    expect(ops).toContain('2 w'); // line width
    expect(ops).toContain('50');
    expect(ops).toContain('250');
  });

  it('drawLine with dash pattern emits d operator', () => {
    const { page } = makePage();
    page.drawLine({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      dashArray: [5, 3],
      dashPhase: 0,
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('[5 3] 0 d');
  });

  // -------------------------------------------------------------------------
  // drawCircle
  // -------------------------------------------------------------------------

  it('drawCircle queues circle operators (Bezier approximation)', () => {
    const { page } = makePage();
    page.drawCircle({
      x: 150,
      y: 250,
      size: 40,
      borderColor: rgb(0, 0, 0.8),
      borderWidth: 2,
    });

    const ops = page.getContentStreamData();
    // Circle is drawn as 4 Bezier curves
    const curveCount = (ops.match(/ c\n/g) ?? []).length;
    expect(curveCount).toBe(4);
    // Should contain moveTo at the start
    expect(ops).toContain('m\n');
    // Should have a stroke operator
    expect(ops).toContain('S\n');
    // Border width
    expect(ops).toContain('2 w');
  });

  it('drawCircle with fill and stroke uses B operator', () => {
    const { page } = makePage();
    page.drawCircle({
      x: 100,
      y: 100,
      size: 30,
      color: rgb(1, 0, 0),
      borderColor: rgb(0, 0, 0),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('B\n');
  });

  // -------------------------------------------------------------------------
  // drawImage
  // -------------------------------------------------------------------------

  it('drawImage queues image XObject operators', () => {
    const { page, registry } = makePage();
    const imgRef = PdfRef.of(99);
    const image = { name: 'Im1', ref: imgRef, width: 200, height: 150 };

    page.drawImage(image, { x: 50, y: 400, width: 200, height: 150 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('cm');    // transformation matrix
    expect(ops).toContain('Do');    // XObject invocation
    expect(ops).toContain('/Im1');  // image resource name
    expect(ops).toContain('q\n');   // save state
    expect(ops).toContain('Q\n');   // restore state
  });

  it('drawImage registers the XObject resource on the page', () => {
    const { page, registry } = makePage();
    const imgRef = PdfRef.of(99);
    const image = { name: 'Im1', ref: imgRef, width: 100, height: 100 };

    page.drawImage(image);

    const resources = page.buildResources();
    expect(resources.has('/XObject')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // pushGraphicsState / popGraphicsState
  // -------------------------------------------------------------------------

  it('pushGraphicsState/popGraphicsState wraps operators in q/Q', () => {
    const { page } = makePage();
    page.pushGraphicsState();
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.popGraphicsState();

    const ops = page.getContentStreamData();
    // The very first character should be 'q' and the last significant should be 'Q'
    const lines = ops.trim().split('\n');
    expect(lines[0]).toBe('q');
    expect(lines[lines.length - 1]).toBe('Q');
  });

  // -------------------------------------------------------------------------
  // setTransform
  // -------------------------------------------------------------------------

  it('setTransform applies rotation matrix', () => {
    const { page } = makePage();
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    page.setTransform(cos45, sin45, -sin45, cos45, 100, 200);

    const ops = page.getContentStreamData();
    expect(ops).toContain('cm');
    expect(ops).toContain('100');
    expect(ops).toContain('200');
  });

  // -------------------------------------------------------------------------
  // Synchronous operations
  // -------------------------------------------------------------------------

  it('drawing operations are synchronous (do not return promises)', () => {
    const { page } = makePage();

    // All drawing methods return void, not Promises
    const textResult = page.drawText('Hello', { x: 0, y: 0 });
    const rectResult = page.drawRectangle({ x: 0, y: 0, width: 10, height: 10 });
    const lineResult = page.drawLine({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    });
    const circleResult = page.drawCircle({ x: 50, y: 50, size: 20 });

    expect(textResult).toBeUndefined();
    expect(rectResult).toBeUndefined();
    expect(lineResult).toBeUndefined();
    expect(circleResult).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Content stream output
  // -------------------------------------------------------------------------

  it('page content stream contains expected PDF operators', () => {
    const { page } = makePage();

    page.drawText('Title', { x: 50, y: 750, size: 24 });
    page.drawRectangle({ x: 50, y: 700, width: 200, height: 2, color: rgb(0, 0, 0) });
    page.drawLine({
      start: { x: 50, y: 690 },
      end: { x: 250, y: 690 },
      color: rgb(0.5, 0.5, 0.5),
    });

    const ops = page.getContentStreamData();

    // Text operators
    expect(ops).toContain('BT');
    expect(ops).toContain('ET');
    expect(ops).toContain('Tf');
    expect(ops).toContain('Tj');

    // Graphics operators
    expect(ops).toContain('re');   // rectangle
    expect(ops).toContain('m\n');  // moveTo
    expect(ops).toContain('l\n');  // lineTo
    expect(ops).toContain('S\n');  // stroke
    expect(ops).toContain('f\n');  // fill

    // State operators
    expect(ops).toContain('q\n');  // save state
    expect(ops).toContain('Q\n');  // restore state
  });

  // -------------------------------------------------------------------------
  // Finalize
  // -------------------------------------------------------------------------

  it('finalize() produces a valid page entry', () => {
    const { page, registry } = makePage(300, 400);
    page.drawText('Finalize test', { x: 10, y: 380 });

    const entry = page.finalize();

    expect(entry.pageRef).toBe(page.pageRef);
    expect(entry.contentStreamRefs).toBe(page.contentStreamRef);
    expect(entry.width).toBe(300);
    expect(entry.height).toBe(400);
    expect(entry.resources).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // pushOperators (raw)
  // -------------------------------------------------------------------------

  it('pushOperators appends raw PDF operators', () => {
    const { page } = makePage();
    page.pushOperators('1 0 0 1 10 20 cm\n');

    const ops = page.getContentStreamData();
    expect(ops).toContain('1 0 0 1 10 20 cm');
  });

  // -------------------------------------------------------------------------
  // drawText with FontRef object
  // -------------------------------------------------------------------------

  it('drawText accepts FontRef object', () => {
    const { page } = makePage();
    const imgRef = PdfRef.of(42);
    const fontRef = {
      name: 'F7',
      ref: imgRef,
      widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
      heightAtSize: (size: number) => size,
    };

    page.drawText('FontRef test', { x: 100, y: 500, font: fontRef, size: 18 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('BT');
    expect(ops).toContain('/F7');
    expect(ops).toContain('18 Tf');
    expect(ops).toContain('FontRef test');
    expect(ops).toContain('Tj');
    expect(ops).toContain('ET');
  });

  // -------------------------------------------------------------------------
  // drawCircle with radius property
  // -------------------------------------------------------------------------

  it('drawCircle accepts radius property', () => {
    const { page } = makePage();
    page.drawCircle({
      x: 200,
      y: 300,
      radius: 55,
      borderColor: rgb(0, 0, 0),
    });

    const ops = page.getContentStreamData();
    // 4 Bezier curves for a circle
    const curveCount = (ops.match(/ c\n/g) ?? []).length;
    expect(curveCount).toBe(4);
    expect(ops).toContain('S\n');
  });

  it('drawCircle falls back to size for backward compatibility', () => {
    const { page: p1 } = makePage();
    p1.drawCircle({ x: 100, y: 100, radius: 30, color: rgb(1, 0, 0) });
    const ops1 = p1.getContentStreamData();

    const { page: p2 } = makePage();
    p2.drawCircle({ x: 100, y: 100, size: 30, color: rgb(1, 0, 0) });
    const ops2 = p2.getContentStreamData();

    // Both should produce identical operator output (radius takes priority over size)
    expect(ops1).toBe(ops2);
  });

  // -------------------------------------------------------------------------
  // drawImage — XObject registration and rotation
  // -------------------------------------------------------------------------

  it('drawImage registers XObject on the page', () => {
    const { page } = makePage();
    const imgRef = PdfRef.of(50);
    const image = { name: 'Im5', ref: imgRef, width: 120, height: 80 };

    page.drawImage(image, { x: 10, y: 20, width: 120, height: 80 });

    const resources = page.buildResources();
    expect(resources.has('/XObject')).toBe(true);
  });

  it('drawImage with rotation wraps in q/Q', () => {
    const { page } = makePage();
    const imgRef = PdfRef.of(60);
    const image = { name: 'Im6', ref: imgRef, width: 200, height: 100 };

    page.drawImage(image, {
      x: 50,
      y: 400,
      width: 200,
      height: 100,
      rotate: degrees(45),
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
    expect(ops).toContain('cm');
    expect(ops).toContain('/Im6 Do');
  });

  // -------------------------------------------------------------------------
  // drawEllipse
  // -------------------------------------------------------------------------

  it('drawEllipse generates correct operators', () => {
    const { page } = makePage();
    page.drawEllipse({
      x: 200,
      y: 300,
      xScale: 60,
      yScale: 30,
      color: rgb(0.5, 0.2, 0.8),
    });

    const ops = page.getContentStreamData();
    // Ellipse is drawn as 4 Bezier curves (same as circle)
    const curveCount = (ops.match(/ c\n/g) ?? []).length;
    expect(curveCount).toBe(4);
    // Should have a moveTo at start
    expect(ops).toContain('m\n');
    // Fill color (rg operator)
    expect(ops).toContain('rg');
    // Should fill since only color is specified
    expect(ops).toContain('f\n');
    // Graphics state save/restore
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  // -------------------------------------------------------------------------
  // pushGraphicsState / popGraphicsState balance
  // -------------------------------------------------------------------------

  it('pushGraphicsState/popGraphicsState are balanced', () => {
    const { page } = makePage();

    page.pushGraphicsState();
    page.drawRectangle({ x: 0, y: 0, width: 10, height: 10 });
    page.pushGraphicsState();
    page.drawCircle({ x: 50, y: 50, size: 20 });
    page.popGraphicsState();
    page.popGraphicsState();

    const ops = page.getContentStreamData();
    const pushCount = (ops.match(/^q$/gm) ?? []).length;
    const popCount = (ops.match(/^Q$/gm) ?? []).length;
    // Each explicit push/pop adds 1 pair, plus drawRectangle and drawCircle
    // each wrap themselves in q/Q. So total: 2 explicit + 2 drawing = 4 pairs
    expect(pushCount).toBe(popCount);
    expect(pushCount).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // drawText with maxWidth (text wrapping)
  // -------------------------------------------------------------------------

  it('drawText wraps text at maxWidth', () => {
    const { page } = makePage();

    // Create a FontRef with a simple width measurement:
    // Each character is 6 points at size 12 (0.5 * size per char)
    const fontRef = {
      name: 'F1',
      ref: PdfRef.of(42),
      widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
      heightAtSize: (size: number) => size,
    };

    // "Hello World Test" is 16 chars => 16 * 6 = 96pt at size 12
    // maxWidth = 60 => only ~10 chars fit per line
    // "Hello" = 5 chars = 30pt (fits)
    // "Hello World" = 11 chars = 66pt (too wide, so "World" goes to next line)
    // "World" = 5 chars = 30pt (fits)
    // "World Test" = 10 chars = 60pt (fits)
    // So: line 1 = "Hello", line 2 = "World Test"
    page.drawText('Hello World Test', {
      x: 50,
      y: 700,
      font: fontRef,
      size: 12,
      maxWidth: 60,
    });

    const ops = page.getContentStreamData();
    // Should contain text line-break operators (TL and T*)
    expect(ops).toContain('TL');
    expect(ops).toContain('T*');
    // Both "Hello" and "World" should appear as separate Tj operations
    expect(ops).toContain('Hello');
    expect(ops).toContain('World Test');
  });

  it('drawText wraps long words at character level', () => {
    const { page } = makePage();

    // Each character is 10 points at size 10 (1.0 * size per char)
    const fontRef = {
      name: 'F1',
      ref: PdfRef.of(42),
      widthOfTextAtSize: (text: string, size: number) => text.length * size * 1.0,
      heightAtSize: (size: number) => size,
    };

    // "ABCDEFGHIJ" = 10 chars at 10pt each = 100pt
    // maxWidth = 50pt => only 5 chars per line
    // Should break: "ABCDE" + "FGHIJ"
    page.drawText('ABCDEFGHIJ', {
      x: 50,
      y: 700,
      font: fontRef,
      size: 10,
      maxWidth: 50,
    });

    const ops = page.getContentStreamData();
    // Should contain line-break operators
    expect(ops).toContain('TL');
    expect(ops).toContain('T*');
    // The word should be split into character-level fragments
    expect(ops).toContain('ABCDE');
    expect(ops).toContain('FGHIJ');
  });

  it('drawText without maxWidth does not wrap', () => {
    const { page } = makePage();

    const fontRef = {
      name: 'F1',
      ref: PdfRef.of(42),
      widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
      heightAtSize: (size: number) => size,
    };

    // Long text without maxWidth should NOT be wrapped
    page.drawText('This is a long line of text that would normally wrap', {
      x: 50,
      y: 700,
      font: fontRef,
      size: 12,
    });

    const ops = page.getContentStreamData();
    // Should NOT contain T* (next line) since there's no wrapping and no \n
    expect(ops).not.toContain('T*');
    // The entire text should appear on one line
    expect(ops).toContain('This is a long line of text that would normally wrap');
  });
});
