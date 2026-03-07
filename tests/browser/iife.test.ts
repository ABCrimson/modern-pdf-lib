import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
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

  it('tsdown config includes IIFE format', async () => {
    const configModule = await import('../../tsdown.config.ts');
    const configs = Array.isArray(configModule.default)
      ? configModule.default
      : [configModule.default];
    const iifeConfig = configs.find((c: Record<string, unknown>) => {
      const fmt = c.format as string | string[] | undefined;
      return Array.isArray(fmt) ? fmt.includes('iife') : fmt === 'iife';
    });
    expect(iifeConfig).toBeDefined();
    expect(iifeConfig.globalName).toBe('ModernPdf');
  });

  it('IIFE entry points to browser.ts', async () => {
    const configModule = await import('../../tsdown.config.ts');
    const configs = Array.isArray(configModule.default)
      ? configModule.default
      : [configModule.default];
    const iifeConfig = configs.find((c: Record<string, unknown>) => {
      const fmt = c.format as string | string[] | undefined;
      return Array.isArray(fmt) ? fmt.includes('iife') : fmt === 'iife';
    });
    const entry = iifeConfig.entry as Record<string, string>;
    expect(Object.values(entry)).toContain('src/browser.ts');
  });

  it('IIFE file is listed in package.json files', async () => {
    const pkg = await import('../../package.json', { with: { type: 'json' } });
    expect(pkg.default.files).toContain('dist/modern-pdf-lib.iife.js');
  });
});
