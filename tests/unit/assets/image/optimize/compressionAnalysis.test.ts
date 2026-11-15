/**
 * analyzeImages keeps an image it cannot decode ("keep" row), except when the decode is refused
 * by an internal limit: a ResourceLimitError is never turned into a row.
 */
import { describe, expect, it, vi } from 'vitest';
import type { PdfDocument } from '../../../../../src/core/pdfDocument.js';
import { ResourceLimitError } from '../../../../../src/errors.js';

const decode = vi.hoisted(() => ({ error: undefined as unknown }));

vi.mock('../../../../../src/assets/image/imageExtract.js', () => ({
  extractImages: () => [
    {
      name: '/Im1',
      pageIndex: 0,
      width: 4,
      height: 4,
      bitsPerComponent: 8,
      colorSpace: 'DeviceRGB',
      channels: 3,
      filters: ['FlateDecode'],
      compressedSize: 100,
    },
  ],
  decodeImageStream: () => {
    throw decode.error;
  },
}));

const { analyzeImages } =
  await import('../../../../../src/assets/image/optimize/compressionAnalysis.js');

describe('analyzeImages decode failures', () => {
  it('keeps an image whose decode fails with an ordinary error', () => {
    decode.error = new Error('bad data');
    const report = analyzeImages({} as PdfDocument);
    expect(report.images).toHaveLength(1);
    expect(report.images[0]?.recommendation).toBe('keep');
  });

  it('rethrows ResourceLimitError from the decode', () => {
    decode.error = new ResourceLimitError('maxImagePixels', 2 ** 28, 'pixels', 2 ** 28 + 1);
    expect(() => analyzeImages({} as PdfDocument)).toThrow(ResourceLimitError);
  });
});
