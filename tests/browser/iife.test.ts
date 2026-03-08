import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('IIFE bundle', () => {
  it('build:iife script exists in package.json', async () => {
    const pkg = await import('../../package.json', { with: { type: 'json' } });
    expect(pkg.default.scripts['build:iife']).toBeDefined();
  });

  it('build script reference is valid', () => {
    const exists = existsSync(resolve('scripts/build-iife.ts'));
    expect(exists).toBe(true);
  });

  it('esbuild script outputs correct filename', () => {
    const script = readFileSync(resolve('scripts/build-iife.ts'), 'utf-8');
    expect(script).toContain('modern-pdf-lib.iife.js');
    expect(script).toContain("globalName: 'ModernPdf'");
  });

  it('esbuild script uses browser.ts entry', () => {
    const script = readFileSync(resolve('scripts/build-iife.ts'), 'utf-8');
    expect(script).toContain('src/browser.ts');
  });

  it('IIFE file is listed in package.json files', async () => {
    const pkg = await import('../../package.json', { with: { type: 'json' } });
    expect(pkg.default.files).toContain('dist/modern-pdf-lib.iife.js');
  });
});
