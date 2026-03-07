import { describe, it, expect } from 'vitest';

describe('Browser bundle', () => {
  it('exports all main entry symbols', async () => {
    const main = await import('../../src/index.js');
    const browser = await import('../../src/browser.js');

    const mainExports = Object.keys(main).sort();
    const browserExports = Object.keys(browser).sort();

    // Browser bundle must include everything from main
    for (const key of mainExports) {
      expect(browserExports).toContain(key);
    }
  });

  it('exports createPdf', async () => {
    const { createPdf } = await import('../../src/browser.js');
    expect(typeof createPdf).toBe('function');
  });

  it('exports PdfDocument', async () => {
    const { PdfDocument } = await import('../../src/browser.js');
    expect(PdfDocument).toBeDefined();
  });

  it('exports loadPdf', async () => {
    const { loadPdf } = await import('../../src/browser.js');
    expect(typeof loadPdf).toBe('function');
  });
});
