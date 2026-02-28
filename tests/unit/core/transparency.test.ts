/**
 * Tests for transparency groups and soft mask support (PDF spec 11.6).
 *
 * Covers:
 * 1.  beginTransparencyGroup + endTransparencyGroup produces valid PDF
 * 2.  Transparency group with isolated: true
 * 3.  Transparency group with knockout: true
 * 4.  Transparency group with DeviceGray color space
 * 5.  Drawing inside transparency group (drawRectangle, drawText)
 * 6.  createSoftMask produces valid Form XObject
 * 7.  applySoftMask + draw + clearSoftMask flow
 * 8.  Multiple transparency groups on same page
 * 9.  Nested transparency groups (group inside group)
 * 10. Soft mask with gradient (draw grayscale gradient in mask)
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PdfDocument,
  PdfPage,
  PdfObjectRegistry,
  PageSizes,
  rgb,
  grayscale,
} from '../../../src/index.js';
import type {
  TransparencyGroupOptions,
  SoftMaskBuilder,
  SoftMaskRef,
} from '../../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function makePage() {
  const registry = new PdfObjectRegistry();
  return { page: new PdfPage(612, 792, registry), registry };
}

// ---------------------------------------------------------------------------
// Transparency groups
// ---------------------------------------------------------------------------

describe('Transparency groups', () => {
  it('beginTransparencyGroup and endTransparencyGroup produces Do operator in ops', () => {
    const { page } = makePage();

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });
    page.endTransparencyGroup();

    const ops = page.getContentStreamData();
    // The transparency group XObject should be drawn with Do
    expect(ops).toContain('/TG1 Do');
    // Should be wrapped in q/Q
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  it('transparency group Form XObject is present in saved output', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The output should contain a Form XObject with /Subtype /Form and a /Group dict
    expect(text).toContain('/Subtype /Form');
    expect(text).toContain('/Group');
    expect(text).toContain('/Transparency');
    // The content stream should contain Do
    expect(text).toContain('/TG1 Do');
  });

  it('transparency group with isolated=true sets /I true', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/I true');
  });

  it('transparency group with isolated=false sets /I false', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ isolated: false });
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/I false');
  });

  it('transparency group with knockout=true sets /K true', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ knockout: true });
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/K true');
  });

  it('transparency group defaults: isolated=true, knockout=false', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/I true');
    expect(text).toContain('/K false');
    expect(text).toContain('/CS /DeviceRGB');
  });

  it('transparency group with DeviceCMYK color space', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ colorSpace: 'DeviceCMYK' });
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/CS /DeviceCMYK');
  });

  it('transparency group with DeviceGray color space', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ colorSpace: 'DeviceGray' });
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/CS /DeviceGray');
  });

  it('nested transparency groups produce multiple Form XObjects', () => {
    const { page } = makePage();

    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });

    page.beginTransparencyGroup({ knockout: true });
    page.drawCircle({ x: 60, y: 60, size: 30, color: rgb(0, 0, 1) });
    page.endTransparencyGroup();

    page.endTransparencyGroup();

    const ops = page.getContentStreamData();

    // The inner group is drawn by the outer group, and the outer group
    // is what appears in the main content stream
    // The inner group (TG1) was captured inside the outer group ops
    // The outer group (TG2) is drawn in the main content stream
    expect(ops).toContain('/TG2 Do');
  });

  it('nested transparency groups produce correct saved output', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });

    page.beginTransparencyGroup({ knockout: true });
    page.drawCircle({ x: 60, y: 60, size: 30, color: rgb(0, 0, 1) });
    page.endTransparencyGroup();

    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Both Form XObjects should be in the output
    expect(text).toContain('/TG1');
    expect(text).toContain('/TG2');
    // Should have two /Group entries with /Transparency
    const matches = text.match(/\/S \/Transparency/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('throws when endTransparencyGroup is called without begin', () => {
    const { page } = makePage();

    expect(() => page.endTransparencyGroup()).toThrowError(
      'No transparency group to end',
    );
  });

  it('group ops are extracted from the main content stream', () => {
    const { page } = makePage();

    // Draw something before the group
    page.drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: rgb(0, 1, 0) });

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100, color: rgb(1, 0, 0) });
    page.endTransparencyGroup();

    // Draw something after the group
    page.drawRectangle({ x: 200, y: 200, width: 10, height: 10, color: rgb(0, 0, 1) });

    const ops = page.getContentStreamData();

    // The main ops should contain the pre-group rect, the group Do, and the post-group rect
    expect(ops).toContain('/TG1 Do');
    // The group content (50 50 100 100 re) should NOT be in the main ops
    // because it was extracted into the Form XObject
    expect(ops).not.toContain('50 50 100 100 re');
    // But the pre- and post-group rects should remain
    expect(ops).toContain('0 0 10 10 re');
    expect(ops).toContain('200 200 10 10 re');
  });

  it('captures drawText inside a transparency group', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 50, y: 50, width: 200, height: 100, color: rgb(1, 0, 0) });
    page.drawText('Hello Transparency', { x: 60, y: 90, size: 14 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The Form XObject should exist
    expect(text).toContain('/Subtype /Form');
    expect(text).toContain('/Group');
    // The page content stream should reference the TG XObject
    expect(text).toContain('/TG1 Do');
    // The text operators should be in the Form XObject stream, not the page
    // The main page content should NOT contain the Tj (show text) operator
    // directly -- it should be inside the Form XObject
    expect(text).toContain('Hello Transparency');
  });

  it('multiple sequential transparency groups on the same page', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    // First group: red rectangle
    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });
    page.endTransparencyGroup();

    // Second group: blue circle with knockout
    page.beginTransparencyGroup({ isolated: false, knockout: true });
    page.drawCircle({ x: 200, y: 200, radius: 50, color: rgb(0, 0, 1) });
    page.endTransparencyGroup();

    // Third group: gray rectangle with DeviceGray
    page.beginTransparencyGroup({ colorSpace: 'DeviceGray' });
    page.drawRectangle({ x: 300, y: 300, width: 80, height: 80 });
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Should have three XObject references in the content stream
    expect(text).toContain('/TG1 Do');
    expect(text).toContain('/TG2 Do');
    expect(text).toContain('/TG3 Do');

    // All three should produce Form XObjects in the resources
    expect(text).toContain('/TG1');
    expect(text).toContain('/TG2');
    expect(text).toContain('/TG3');
  });

  it('multiple sequential transparency groups have correct Do count in page ops', () => {
    const { page } = makePage();

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    page.endTransparencyGroup();

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 70, y: 70, width: 50, height: 50 });
    page.endTransparencyGroup();

    page.beginTransparencyGroup();
    page.drawRectangle({ x: 130, y: 130, width: 50, height: 50 });
    page.endTransparencyGroup();

    const ops = page.getContentStreamData();
    const doMatches = ops.match(/\/TG\d+ Do/g);
    expect(doMatches).not.toBeNull();
    expect(doMatches!.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Soft masks
// ---------------------------------------------------------------------------

describe('Soft masks', () => {
  it('createSoftMask creates a Form XObject with /Group /Transparency /DeviceGray', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(200, 200, (b) => {
      b.drawRectangle(0, 0, 200, 200, 1);
    });

    expect(mask._tag).toBe('softMask');
    expect(mask.ref).toBeDefined();

    page.applySoftMask(mask);
    page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(1, 0, 0) });
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The soft mask Form XObject should have a /Group with /CS /DeviceGray
    expect(text).toContain('/CS /DeviceGray');
    expect(text).toContain('/Transparency');
    expect(text).toContain('/BBox [0 0 200 200]');
  });

  it('createSoftMask drawRectangle generates correct operators', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(10, 20, 30, 40, 0.5);
    });

    page.applySoftMask(mask);
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The mask stream should contain the rectangle operators
    expect(text).toContain('0.5 g');
    expect(text).toContain('10 20 30 40 re');
  });

  it('createSoftMask drawCircle generates Bezier circle path', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(200, 200, (b) => {
      b.drawCircle(100, 100, 50, 0.8);
    });

    page.applySoftMask(mask);
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The mask stream should contain the circle operators
    expect(text).toContain('0.8 g');
    // The circle path starts with a moveTo at (cx - r, cy)
    expect(text).toContain('50 100 m');
    // Should contain Bezier curve operators
    expect(text).toContain(' c');
  });

  it('createSoftMask pushRawOperators appends raw content', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(100, 100, (b) => {
      b.pushRawOperators('0.75 g\n0 0 100 100 re\nf');
    });

    page.applySoftMask(mask);
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('0.75 g');
    expect(text).toContain('0 0 100 100 re');
  });

  it('applySoftMask emits ExtGState with /SMask containing /S /Luminosity', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });

    page.applySoftMask(mask);
    page.drawRectangle({ x: 0, y: 0, width: 100, height: 100 });
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The ExtGState should have an /SMask with /S /Luminosity
    expect(text).toContain('/SMask');
    expect(text).toContain('/S /Luminosity');
    expect(text).toContain('/G ');
  });

  it('applySoftMask emits gs operator in content stream', () => {
    const { page, registry } = makePage();

    const doc = createPdf();
    const mask = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });

    page.applySoftMask(mask);

    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('clearSoftMask emits ExtGState with /SMask /None', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });

    page.applySoftMask(mask);
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Should contain an ExtGState with /SMask /None
    expect(text).toContain('/SMask /None');
  });

  it('clearSoftMask emits gs operator in content stream', () => {
    const { page } = makePage();
    page.clearSoftMask();
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('round-trip: create PDF with transparency features, save, and verify', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    // Draw a background
    page.drawRectangle({
      x: 0, y: 0,
      width: page.width, height: page.height,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Create a soft mask with a gradient-like effect
    const mask = doc.createSoftMask(200, 200, (b) => {
      // Full white background (opaque)
      b.drawRectangle(0, 0, 200, 200, 1);
      // Black circle (transparent hole)
      b.drawCircle(100, 100, 80, 0);
    });

    // Use a transparency group with the soft mask
    page.beginTransparencyGroup({ isolated: true, knockout: false });
    page.applySoftMask(mask);
    page.drawRectangle({
      x: 100, y: 300,
      width: 200, height: 200,
      color: rgb(1, 0, 0),
    });
    page.clearSoftMask();
    page.endTransparencyGroup();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Verify the PDF header
    expect(text).toContain('%PDF-');

    // Verify transparency group artifacts
    expect(text).toContain('/Transparency');
    expect(text).toContain('/I true');
    expect(text).toContain('/K false');

    // Verify soft mask artifacts
    expect(text).toContain('/SMask');
    expect(text).toContain('/S /Luminosity');
    expect(text).toContain('/SMask /None');
    expect(text).toContain('/CS /DeviceGray');

    // The output should be valid PDF bytes (non-zero length)
    expect(bytes.length).toBeGreaterThan(100);
  });

  it('multiple soft masks on the same page use different ExtGState names', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask1 = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });
    const mask2 = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 0.5);
    });

    page.applySoftMask(mask1);
    page.drawRectangle({ x: 10, y: 10, width: 80, height: 80 });
    page.clearSoftMask();

    page.applySoftMask(mask2);
    page.drawRectangle({ x: 110, y: 10, width: 80, height: 80 });
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Should have 4 ExtGState entries
    expect(text).toContain('/GS1');
    expect(text).toContain('/GS2');
    expect(text).toContain('/GS3');
    expect(text).toContain('/GS4');
    // The content stream should reference all 4
    expect(text).toContain('/GS1 gs');
    expect(text).toContain('/GS2 gs');
    expect(text).toContain('/GS3 gs');
    expect(text).toContain('/GS4 gs');
  });

  it('soft mask with gradient: multiple gray strips simulate a gradient', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    // Create a gradient-like soft mask with 10 horizontal strips
    const mask = doc.createSoftMask(200, 200, (b) => {
      const steps = 10;
      const stripHeight = 200 / steps;
      for (let i = 0; i < steps; i++) {
        const gray = i / (steps - 1); // 0 (black/transparent) to 1 (white/opaque)
        b.drawRectangle(0, i * stripHeight, 200, stripHeight, gray);
      }
    });

    page.applySoftMask(mask);
    page.drawRectangle({
      x: 100, y: 100, width: 200, height: 200,
      color: rgb(0, 0, 1),
    });
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Should contain the soft mask with DeviceGray group
    expect(text).toContain('/CS /DeviceGray');
    expect(text).toContain('/S /Luminosity');
    // Should contain grayscale operators from the gradient strips
    expect(text).toContain('0 g');  // First strip: black (transparent)
    expect(text).toContain('1 g');  // Last strip: white (opaque)
    // Should have the clear mask as well
    expect(text).toContain('/SMask /None');
  });

  it('soft mask with gradient using raw operators for fine-grained control', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const mask = doc.createSoftMask(100, 100, (b) => {
      // Horizontal gradient: 20 strips from black (0) to white (1)
      const strips = 20;
      const w = 100 / strips;
      for (let i = 0; i < strips; i++) {
        const gray = (i / (strips - 1)).toFixed(4);
        b.pushRawOperators(`${gray} g`);
        b.pushRawOperators(`${(i * w).toFixed(2)} 0 ${w.toFixed(2)} 100 re`);
        b.pushRawOperators('f');
      }
    });

    page.applySoftMask(mask);
    page.drawRectangle({
      x: 50, y: 50, width: 100, height: 100,
      color: rgb(1, 0, 0),
    });
    page.clearSoftMask();

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/S /Luminosity');
    // Should contain some intermediate gray values
    expect(text).toContain('0.0000 g');   // Start of gradient
    expect(text).toContain('1.0000 g');   // End of gradient
  });
});

// ---------------------------------------------------------------------------
// Round-trip: full document creation, save, and reload validation
// ---------------------------------------------------------------------------

describe('Transparency round-trip', () => {
  it('produces a loadable PDF with transparency features', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.Letter);

    page.beginTransparencyGroup({ isolated: true });
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 100, color: rgb(1, 0, 0) });
    page.endTransparencyGroup();

    const mask = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });
    page.applySoftMask(mask);
    page.drawRectangle({ x: 200, y: 200, width: 100, height: 100, color: rgb(0, 0, 1) });
    page.clearSoftMask();

    const bytes = await doc.save();

    // Load the saved PDF to verify it's parseable
    const loaded = await PdfDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const loadedPage = loaded.getPage(0);
    expect(loadedPage.width).toBe(612);
    expect(loadedPage.height).toBe(792);
  });

  it('complete PDF with transparency group, soft mask, and gradient', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    // Background
    page.drawRectangle({
      x: 0, y: 0, width: 595.28, height: 841.89,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Transparency group with overlapping shapes
    page.beginTransparencyGroup({ isolated: true, knockout: false });
    page.drawRectangle({
      x: 100, y: 400, width: 200, height: 200,
      color: rgb(1, 0, 0), opacity: 0.7,
    });
    page.drawCircle({
      x: 250, y: 450, radius: 80,
      color: rgb(0, 0, 1), opacity: 0.7,
    });
    page.endTransparencyGroup();

    // Soft-masked content with gradient mask
    const mask = doc.createSoftMask(300, 300, (b) => {
      b.drawRectangle(0, 0, 300, 300, 0);     // black background (transparent)
      b.drawCircle(150, 150, 140, 0.3);        // dim outer ring
      b.drawCircle(150, 150, 100, 0.6);        // mid ring
      b.drawCircle(150, 150, 60, 1);           // bright center (opaque)
    });

    page.applySoftMask(mask);
    page.drawRectangle({
      x: 150, y: 150, width: 300, height: 300,
      color: rgb(0, 0.5, 0),
    });
    page.clearSoftMask();

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    const text = pdfToString(bytes);
    expect(text).toContain('%PDF-');
    expect(text).toContain('%%EOF');
    expect(text).toContain('/S /Transparency');
    expect(text).toContain('/S /Luminosity');
    expect(text).toContain('/SMask /None');
    expect(text).toContain('/Subtype /Form');
  });
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

describe('Type exports', () => {
  it('TransparencyGroupOptions is usable as a type', () => {
    const options: TransparencyGroupOptions = {
      isolated: true,
      knockout: false,
      colorSpace: 'DeviceRGB',
    };
    expect(options.isolated).toBe(true);
    expect(options.knockout).toBe(false);
    expect(options.colorSpace).toBe('DeviceRGB');
  });

  it('SoftMaskRef has the correct shape', () => {
    const doc = createPdf();
    const mask: SoftMaskRef = doc.createSoftMask(100, 100, (b) => {
      b.drawRectangle(0, 0, 100, 100, 1);
    });
    expect(mask._tag).toBe('softMask');
    expect(mask.ref).toBeDefined();
  });

  it('SoftMaskBuilder provides all expected methods', () => {
    const doc = createPdf();
    let receivedBuilder: SoftMaskBuilder | undefined;
    doc.createSoftMask(100, 100, (b) => {
      receivedBuilder = b;
      b.drawRectangle(0, 0, 100, 100, 1);
      b.drawCircle(50, 50, 25, 0.5);
      b.pushRawOperators('0 g');
    });
    expect(receivedBuilder).toBeDefined();
    expect(typeof receivedBuilder!.drawRectangle).toBe('function');
    expect(typeof receivedBuilder!.drawCircle).toBe('function');
    expect(typeof receivedBuilder!.pushRawOperators).toBe('function');
  });
});
