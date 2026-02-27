/**
 * Browser-based end-to-end tests using Playwright.
 *
 * These tests run in a real browser environment to verify that modern-pdf
 * works correctly when loaded as an ESM module in the browser via Vite.
 *
 * Prerequisites:
 * - The Vite dev server must be running (configured in playwright.config.ts)
 * - A test page at the Vite root must import and use modern-pdf
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Browser PDF creation tests
// ---------------------------------------------------------------------------

test.describe('Browser PDF creation', () => {
  test('creates a PDF document in the browser', async ({ page }) => {
    // Navigate to the test page served by Vite
    await page.goto('/');

    // Execute modern-pdf in the browser context
    const result = await page.evaluate(async () => {
      try {
        // Dynamic import from the Vite-served module
        const { createPdf, PageSizes, rgb } = await import('/src/index.ts');

        const doc = createPdf();
        const p = doc.addPage(PageSizes.A4);
        const font = await doc.embedFont('Helvetica');

        p.drawText('Browser Test', {
          x: 50,
          y: 700,
          font: font.name,
          size: 24,
          color: rgb(0, 0, 0),
        });

        const bytes = await doc.save();

        return {
          success: true,
          length: bytes.length,
          isUint8Array: bytes instanceof Uint8Array,
          startsWithPdf: new TextDecoder().decode(bytes.slice(0, 9)).startsWith('%PDF-1.7'),
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
          length: 0,
          isUint8Array: false,
          startsWithPdf: false,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isUint8Array).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.startsWithPdf).toBe(true);
  });

  test('PDF bytes end with %%EOF in browser', async ({ page }) => {
    await page.goto('/');

    const endsWithEof = await page.evaluate(async () => {
      try {
        const { createPdf } = await import('/src/index.ts');

        const doc = createPdf();
        doc.addPage();
        const bytes = await doc.save();
        const text = new TextDecoder().decode(bytes);
        return text.trimEnd().endsWith('%%EOF');
      } catch {
        return false;
      }
    });

    expect(endsWithEof).toBe(true);
  });

  test('saveAsBlob produces a Blob in the browser', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      try {
        const { createPdf } = await import('/src/index.ts');

        const doc = createPdf();
        doc.addPage();
        const blob = await doc.saveAsBlob();

        return {
          success: true,
          isBlob: blob instanceof Blob,
          type: blob.type,
          size: blob.size,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
          isBlob: false,
          type: '',
          size: 0,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.type).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(0);
  });

  test('saveAsStream works in the browser', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      try {
        const { createPdf } = await import('/src/index.ts');

        const doc = createPdf();
        doc.addPage();
        const stream = doc.saveAsStream();

        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLength += value.length;
        }

        return {
          success: true,
          isReadableStream: stream instanceof ReadableStream,
          totalLength,
          chunksCount: chunks.length,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
          isReadableStream: false,
          totalLength: 0,
          chunksCount: 0,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isReadableStream).toBe(true);
    expect(result.totalLength).toBeGreaterThan(0);
    expect(result.chunksCount).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Visual regression tests
  //
  // These generate PDFs in the browser, render them using Chromium's
  // built-in PDF viewer, and compare screenshots against golden images.
  //
  // To generate/update golden images:
  //   npx playwright test --update-snapshots --project=chromium
  //
  // Only run on Chromium — other browsers have different PDF renderers
  // that produce visually different output.
  // -------------------------------------------------------------------------

  test('visual regression: single page with text', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual tests only run on Chromium');

    await page.goto('/');

    // Generate a PDF with text at various sizes and colors
    const pdfBase64 = await page.evaluate(async () => {
      const { createPdf, PageSizes, rgb } = await import('/src/index.ts');

      const doc = createPdf();
      const p = doc.addPage(PageSizes.A4);
      const font = await doc.embedFont('Helvetica');

      p.drawText('Visual Regression Test', {
        x: 50, y: 750, font: font.name, size: 28, color: rgb(0, 0, 0),
      });
      p.drawText('modern-pdf library', {
        x: 50, y: 710, font: font.name, size: 18, color: rgb(0.5, 0, 0),
      });
      p.drawText('Small text at 10pt', {
        x: 50, y: 680, font: font.name, size: 10, color: rgb(0, 0, 0.5),
      });
      p.drawText('The quick brown fox jumps over the lazy dog', {
        x: 50, y: 650, font: font.name, size: 14, color: rgb(0.2, 0.2, 0.2),
      });

      const bytes = await doc.save();
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i++) chars.push(String.fromCharCode(bytes[i]!));
      return btoa(chars.join(''));
    });

    // Navigate to the PDF rendered by Chromium's built-in viewer
    await page.goto(`data:application/pdf;base64,${pdfBase64}`);
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('single-page-text.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('visual regression: shapes and colors', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual tests only run on Chromium');

    await page.goto('/');

    // Generate a PDF with rectangles, circles, lines, and colors
    const pdfBase64 = await page.evaluate(async () => {
      const { createPdf, PageSizes, rgb } = await import('/src/index.ts');

      const doc = createPdf();
      const p = doc.addPage(PageSizes.A4);

      // Filled rectangles
      p.drawRectangle({ x: 50, y: 700, width: 100, height: 60, color: rgb(1, 0, 0) });
      p.drawRectangle({ x: 170, y: 700, width: 100, height: 60, color: rgb(0, 1, 0) });
      p.drawRectangle({ x: 290, y: 700, width: 100, height: 60, color: rgb(0, 0, 1) });

      // Outlined rectangles
      p.drawRectangle({
        x: 50, y: 620, width: 100, height: 60,
        borderColor: rgb(1, 0, 0), borderWidth: 2,
      });
      p.drawRectangle({
        x: 170, y: 620, width: 100, height: 60,
        borderColor: rgb(0, 0.5, 0), borderWidth: 3,
      });

      // Circles
      p.drawCircle({ x: 100, y: 560, size: 30, color: rgb(1, 0.5, 0) });
      p.drawCircle({ x: 200, y: 560, size: 25, color: rgb(0.5, 0, 1) });

      // Lines
      p.drawLine({
        start: { x: 50, y: 500 }, end: { x: 400, y: 500 },
        thickness: 2, color: rgb(0, 0, 0),
      });
      p.drawLine({
        start: { x: 50, y: 480 }, end: { x: 400, y: 480 },
        thickness: 1, color: rgb(0.5, 0.5, 0.5),
      });

      // Semi-transparent overlay
      p.drawRectangle({
        x: 100, y: 680, width: 200, height: 100,
        color: rgb(0, 0, 0), opacity: 0.3,
      });

      const bytes = await doc.save();
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i++) chars.push(String.fromCharCode(bytes[i]!));
      return btoa(chars.join(''));
    });

    await page.goto(`data:application/pdf;base64,${pdfBase64}`);
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('shapes-and-colors.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('visual regression: multi-page document', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual tests only run on Chromium');

    await page.goto('/');

    // Generate a 3-page PDF and verify page navigation
    const pdfBase64 = await page.evaluate(async () => {
      const { createPdf, PageSizes, rgb } = await import('/src/index.ts');

      const doc = createPdf();
      const font = await doc.embedFont('Helvetica');

      // Page 1
      const p1 = doc.addPage(PageSizes.A4);
      p1.drawText('Page 1 of 3', {
        x: 50, y: 750, font: font.name, size: 24, color: rgb(0, 0, 0),
      });
      p1.drawRectangle({ x: 50, y: 650, width: 200, height: 50, color: rgb(1, 0, 0) });

      // Page 2
      const p2 = doc.addPage(PageSizes.A4);
      p2.drawText('Page 2 of 3', {
        x: 50, y: 750, font: font.name, size: 24, color: rgb(0, 0, 0),
      });
      p2.drawCircle({ x: 150, y: 675, size: 40, color: rgb(0, 1, 0) });

      // Page 3
      const p3 = doc.addPage(PageSizes.A4);
      p3.drawText('Page 3 of 3', {
        x: 50, y: 750, font: font.name, size: 24, color: rgb(0, 0, 0),
      });
      p3.drawRectangle({ x: 50, y: 650, width: 200, height: 50, color: rgb(0, 0, 1) });

      const bytes = await doc.save();
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i++) chars.push(String.fromCharCode(bytes[i]!));
      return btoa(chars.join(''));
    });

    await page.goto(`data:application/pdf;base64,${pdfBase64}`);
    await page.waitForTimeout(2000);

    // Screenshot the first page (default view)
    await expect(page).toHaveScreenshot('multi-page-page1.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
