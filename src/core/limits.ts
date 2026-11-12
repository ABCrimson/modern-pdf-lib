/**
 * @module core/limits
 *
 * The internal limits on what one input may make the library allocate or
 * walk. Each field is the largest value accepted: a value equal to it is
 * accepted, a value above it is refused with {@link ResourceLimitError}
 * (code `'resource-limit-exceeded'`), except `maxRewrapDecodedBytes`: a raw DEFLATE
 * stream that decodes to more is saved as loaded, and nothing is thrown. The limits are fixed in this release:
 * no package entry exports this module, and no option changes them.
 *
 * @packageDocumentation
 */

import { ResourceLimitError } from '../errors.js';

/** The internal limits, frozen. */
export const INTERNAL_LIMITS: Readonly<{
  /** Decoded bytes one stream filter may output (bytes): 256 MiB. */
  maxDecodedStreamBytes: number;
  /** Decoded bytes of a raw DEFLATE stream that save writes back as zlib data (bytes): 64 MiB; a larger stream is copied as loaded. */
  maxRewrapDecodedBytes: number;
  /** Codes one ToUnicode CMap may name in its table (mappings): 2^20. */
  maxCMapMappings: number;
  /** Codes one font cmap subtable may name in its table (entries): 0x110000, the Unicode code space. */
  maxFontCmapMappings: number;
  /** Nesting of constructed DER values (levels): 128. */
  maxDerDepth: number;
  /** Nesting of outline items and structure elements (levels): 256. */
  maxTreeDepth: number;
  /** Cost of the Form XObjects of one page interpretation: one per operator, plus one per operand beyond six, the bytes of each string operand and the elements of each array operand (operators): 2^20. */
  maxFormOperators: number;
  /** Samples the sub-byte TIFF predictor path may visit in one stream (samples): 2^28. */
  maxPredictorSamples: number;
  /** Width or height of one image, or a CCITT /Columns or /Rows value (pixels): 65,536. */
  maxImageDimension: number;
  /** Width times height of one decoded image (pixels): 2^28. */
  maxImagePixels: number;
  /** Decoded sample bytes of one image (bytes): 2^28, 256 MiB. */
  maxImageBytes: number;
  /** Frames (TIFF IFDs) read from one image file (frames): 4,096. */
  maxImageFrames: number;
  /** Decoded bytes of one font program, such as the tables of a WOFF file (bytes): 2^27, 128 MiB. */
  maxFontBytes: number;
}> = Object.freeze({
  maxDecodedStreamBytes: 256 * 1024 * 1024,
  maxRewrapDecodedBytes: 64 * 1024 * 1024,
  maxCMapMappings: 2 ** 20,
  maxFontCmapMappings: 0x110000,
  maxDerDepth: 128,
  maxTreeDepth: 256,
  maxFormOperators: 2 ** 20,
  maxPredictorSamples: 2 ** 28,
  maxImageDimension: 65_536,
  maxImagePixels: 2 ** 28,
  maxImageBytes: 2 ** 28,
  maxImageFrames: 4_096,
  maxFontBytes: 2 ** 27,
});

/** The name of one internal limit. */
export type ResourceLimitName = keyof typeof INTERNAL_LIMITS;

/** What each limit counts, as the {@link ResourceLimitError} message names it. */
export const LIMIT_UNITS: Readonly<Record<ResourceLimitName, string>> = Object.freeze({
  maxDecodedStreamBytes: 'bytes',
  maxRewrapDecodedBytes: 'bytes',
  maxCMapMappings: 'mappings',
  maxFontCmapMappings: 'entries',
  maxDerDepth: 'levels',
  maxTreeDepth: 'levels',
  maxFormOperators: 'operators',
  maxPredictorSamples: 'samples',
  maxImageDimension: 'pixels',
  maxImagePixels: 'pixels',
  maxImageBytes: 'bytes',
  maxImageFrames: 'frames',
  maxFontBytes: 'bytes',
});

/**
 * Throws {@link ResourceLimitError} when `actual` is above the limit, or is
 * not a finite number (NaN, Infinity, -Infinity); returns otherwise. The
 * error carries the limit's name, its value and `actual` (`undefined` when
 * `actual` is not finite). Call it before the allocation or the step the
 * limit guards.
 *
 * @param limit - The limit to check against.
 * @param actual - The size the input needs.
 */
export function assertWithinLimit(limit: ResourceLimitName, actual: number): void {
  const max = INTERNAL_LIMITS[limit];
  const finite = Number.isFinite(actual);
  if (finite && actual <= max) return;
  throw new ResourceLimitError(limit, max, LIMIT_UNITS[limit], finite ? actual : undefined);
}
