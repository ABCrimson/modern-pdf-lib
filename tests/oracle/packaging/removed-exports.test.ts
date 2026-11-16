/**
 * Removed exports: `webpToJpeg` and `webpToPng` only checked the RIFF header and then threw, so
 * 0.41.0 removed them. Neither is exported by the root entry or the browser entry, and the module
 * that held them no longer defines them. The route that works stays: `decodeWebP`,
 * `recompressWebP` and `encodePngFromPixels`.
 */
import { describe, expect, it } from 'vitest';
import * as browser from '../../../src/browser.js';
import * as webpOptimize from '../../../src/assets/image/webp/webpOptimize.js';
import * as root from '../../../src/index.js';

const REMOVED = ['webpToJpeg', 'webpToPng'] as const;
const KEPT = ['decodeWebP', 'recompressWebP', 'encodePngFromPixels'] as const;

describe.each([
  ['"."', root],
  ['"./browser"', browser],
] as const)('the entry %s', (_entry, entry) => {
  it.each(REMOVED)('does not export %s', (name) => {
    expect(Object.hasOwn(entry, name)).toBe(false);
  });

  it.each(KEPT)('still exports %s', (name) => {
    expect(typeof entry[name]).toBe('function');
  });
});

describe('the WebP optimization module', () => {
  it.each(REMOVED)('does not define %s', (name) => {
    expect(Object.hasOwn(webpOptimize, name)).toBe(false);
  });
});
