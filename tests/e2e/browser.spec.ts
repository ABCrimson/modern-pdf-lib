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
  // TODO: Visual regression tests
  // -------------------------------------------------------------------------

  test.skip('visual regression: single page with text', async ({ page }) => {
    // TODO: Implement visual regression testing
    //
    // Plan:
    // 1. Generate a PDF in the browser
    // 2. Convert to a data URL or blob URL
    // 3. Use pdf.js or an <embed> to render it
    // 4. Take a screenshot
    // 5. Compare against a golden screenshot
    //
    // await page.goto('/');
    // const pdfDataUrl = await page.evaluate(async () => {
    //   const { createPdf, PageSizes, rgb } = await import('/src/index.ts');
    //   const doc = createPdf();
    //   const p = doc.addPage(PageSizes.A4);
    //   p.drawText('Visual Regression Test', { x: 50, y: 750, size: 24 });
    //   const blob = await doc.saveAsBlob();
    //   return URL.createObjectURL(blob);
    // });
    //
    // // Navigate to the PDF
    // await page.goto(pdfDataUrl);
    // await expect(page).toHaveScreenshot('single-page-text.png');
  });

  test.skip('visual regression: shapes and colors', async ({ page }) => {
    // TODO: Implement visual regression for shapes
  });

  test.skip('visual regression: multi-page document', async ({ page }) => {
    // TODO: Implement visual regression for multi-page
  });
});
