import { describe, it, expect } from 'vitest';

describe('Sub-path imports', () => {
  it('create entry exports createPdf', async () => {
    const mod = await import('../../src/create.js');
    expect(typeof mod.createPdf).toBe('function');
  });

  it('create entry exports PageSizes', async () => {
    const mod = await import('../../src/create.js');
    expect(mod.PageSizes).toBeDefined();
  });

  it('create entry does NOT export loadPdf', async () => {
    const mod = await import('../../src/create.js');
    expect((mod as any).loadPdf).toBeUndefined();
  });

  it('parse entry exports loadPdf', async () => {
    const mod = await import('../../src/parse.js');
    expect(typeof mod.loadPdf).toBe('function');
  });

  it('parse entry exports extractText', async () => {
    const mod = await import('../../src/parse.js');
    expect(typeof mod.extractText).toBe('function');
  });

  it('forms entry exports PdfForm', async () => {
    const mod = await import('../../src/forms.js');
    expect(mod.PdfForm).toBeDefined();
  });

  it('forms entry exports PdfTextField', async () => {
    const mod = await import('../../src/forms.js');
    expect(mod.PdfTextField).toBeDefined();
  });
});
