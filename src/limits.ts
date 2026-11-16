/**
 * @module limits
 *
 * The public part of the input limits: the limit names, the shape of a `limits` option and the defaults.
 *
 * @packageDocumentation
 */

/** The name of one limit, as a `limits` option and {@link ResourceLimitError.limit} spell it. */
export type LimitName =
  | 'maxDecodedStreamBytes'
  | 'maxCMapMappings'
  | 'maxFontCmapMappings'
  | 'maxDerDepth'
  | 'maxTreeDepth'
  | 'maxFormOperators'
  | 'maxPredictorSamples'
  | 'maxImageDimension'
  | 'maxImagePixels'
  | 'maxImageBytes'
  | 'maxImageFrames'
  | 'maxFontBytes'
  | 'maxTotalDecodedBytes'
  | 'maxTotalCMapMappings'
  | 'maxTotalImageBytes'
  | 'maxPageOperators';

/**
 * A `limits` option: the limits to set, each a whole number from 1 up to its
 * ceiling. `maxDerDepth` and `maxTreeDepth` can only be lowered (ceilings 128
 * and 256), `maxFontCmapMappings` is at most 0x110000, every other limit at
 * most `Number.MAX_SAFE_INTEGER`. An unknown key, or a value outside that
 * range, throws {@link InvalidArgumentError} naming `limits.<name>`. A limit
 * left out keeps its value.
 */
export type PdfLimits = { readonly [K in LimitName]?: number | undefined };

/** The limits in force: every limit set. */
export type ResolvedLimits = { readonly [K in LimitName]: number };

/**
 * The default limits, frozen. Each value is at least 4 times the largest the
 * test corpus needs, the four totals included.
 */
export const DEFAULT_LIMITS: ResolvedLimits = Object.freeze({
  /** Decoded bytes one stream filter may output (bytes): 2^28, 256 MiB. */
  maxDecodedStreamBytes: 2 ** 28,
  /** Codes one ToUnicode CMap may name in its table (mappings): 2^20. */
  maxCMapMappings: 2 ** 20,
  /** Codes one font cmap subtable may name in its table (entries): 0x110000, the Unicode code space. */
  maxFontCmapMappings: 0x110000,
  /** Nesting of constructed DER values (levels): 128. */
  maxDerDepth: 128,
  /** Nesting of outline items and structure elements (levels): 256. */
  maxTreeDepth: 256,
  /** Cost of the Form XObjects of one page interpretation: one per operator, plus one per operand beyond six, the bytes of each string operand and the elements of each array operand (operators): 2^20. */
  maxFormOperators: 2 ** 20,
  /** Samples the sub-byte TIFF predictor path may visit in one stream (samples): 2^28. */
  maxPredictorSamples: 2 ** 28,
  /** Width or height of one image, or a CCITT /Columns or /Rows value (pixels): 65,536. */
  maxImageDimension: 65_536,
  /** Width times height of one decoded image (pixels): 2^28. */
  maxImagePixels: 2 ** 28,
  /** Decoded sample bytes of one image (bytes): 2^28, 256 MiB. */
  maxImageBytes: 2 ** 28,
  /** Frames (TIFF IFDs) read from one image file (frames): 4,096. */
  maxImageFrames: 4_096,
  /** Decoded bytes of one font program, such as the tables of a WOFF file (bytes): 2^27, 128 MiB. */
  maxFontBytes: 2 ** 27,
  /** Decoded bytes of every filter stage of every stream decoded in one call (bytes): 2^30, 1 GiB. */
  maxTotalDecodedBytes: 2 ** 30,
  /** ToUnicode mappings over all fonts of one text extraction (mappings): 2^22. */
  maxTotalCMapMappings: 2 ** 22,
  /** Decoded sample bytes over the frames or images of one call (bytes): 2^30, 1 GiB. */
  maxTotalImageBytes: 2 ** 30,
  /** Operators of one page interpretation, one each, those inside its Form XObjects included (operators): 2^24. */
  maxPageOperators: 2 ** 24,
});
