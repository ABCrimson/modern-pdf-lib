import { describe, it, expect } from 'vitest';
import { PdfWorker } from '../../src/browser/worker.js';

describe('PdfWorker', () => {
  it('can be instantiated with no options', () => {
    // Constructor should not require a Worker runtime — it's lazy.
    expect(() => new PdfWorker()).not.toThrow();
  });

  it('can be instantiated with a workerUrl string', () => {
    expect(() => new PdfWorker({ workerUrl: 'worker.js' })).not.toThrow();
  });

  it('can be instantiated with a workerUrl URL object', () => {
    expect(() => new PdfWorker({ workerUrl: new URL('https://example.com/worker.js') })).not.toThrow();
  });

  it('isActive is false before first generate()', () => {
    const w = new PdfWorker();
    expect(w.isActive).toBe(false);
  });

  it('pendingCount is 0 initially', () => {
    const w = new PdfWorker();
    expect(w.pendingCount).toBe(0);
  });

  it('terminate on unused worker does not throw', () => {
    const w = new PdfWorker();
    expect(() => w.terminate()).not.toThrow();
  });

  it('terminate keeps isActive false when worker was never started', () => {
    const w = new PdfWorker();
    w.terminate();
    expect(w.isActive).toBe(false);
  });

  it('terminate can be called multiple times safely', () => {
    const w = new PdfWorker();
    expect(() => {
      w.terminate();
      w.terminate();
      w.terminate();
    }).not.toThrow();
  });

  it('exports PdfWorker class from module', async () => {
    const mod = await import('../../src/browser/worker.js');
    expect(mod.PdfWorker).toBeDefined();
    expect(typeof mod.PdfWorker).toBe('function');
  });

  it('PdfWorker is exported from main index', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.PdfWorker).toBeDefined();
  });

  it('PdfWorker is exported from browser entry', async () => {
    const mod = await import('../../src/browser.js');
    expect(mod.PdfWorker).toBeDefined();
  });
});
