/**
 * @module internal/limits
 *
 * The limits on what one input may make the library allocate or walk. Each
 * limit is the largest value accepted: a value equal to it is accepted, a
 * value above it is refused with {@link ResourceLimitError} (code
 * `'resource-limit-exceeded'`). Twelve limits bound one item of the input (a
 * stream, table, tree, image, font or the forms of one page); four totals
 * bound a sum over one call.
 *
 * The package entries export {@link DEFAULT_LIMITS} and the types
 * {@link LimitName}, {@link PdfLimits} and {@link ResolvedLimits}.
 * {@link resolveLimits} checks a `limits` option once and applies it, and a
 * {@link LimitContext} carries the result and the totals of one call to every
 * check; nothing here keeps a limit or a total in module state. {@link INTERNAL_LIMITS},
 * {@link assertWithinLimit} and {@link legacyContext} serve the modules that
 * do not take a context yet: they check against the defaults.
 *
 * @packageDocumentation
 */

import { InvalidArgumentError, ResourceLimitError } from '../errors.js';

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

/** One of the four limits that bound a sum over one public call. */
export type TotalName =
  | 'maxTotalDecodedBytes'
  | 'maxTotalCMapMappings'
  | 'maxTotalImageBytes'
  | 'maxPageOperators';

/**
 * The default limits, frozen. Each per-stream value is at least 4 times the
 * largest the test corpus needs.
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
  /** Operators and operand elements of one page interpretation, its forms included (operators): 2^24. */
  maxPageOperators: 2 ** 24,
});

/**
 * The default per-stream limits and the save-time re-wrap bound, frozen.
 * `maxRewrapDecodedBytes` (64 MiB) is not a limit option and never throws: a
 * raw DEFLATE stream that decodes to more is saved as loaded.
 */
export const INTERNAL_LIMITS: Readonly<
  Omit<ResolvedLimits, TotalName> & { maxRewrapDecodedBytes: number }
> = Object.freeze({
  maxDecodedStreamBytes: DEFAULT_LIMITS.maxDecodedStreamBytes,
  maxRewrapDecodedBytes: 64 * 1024 * 1024,
  maxCMapMappings: DEFAULT_LIMITS.maxCMapMappings,
  maxFontCmapMappings: DEFAULT_LIMITS.maxFontCmapMappings,
  maxDerDepth: DEFAULT_LIMITS.maxDerDepth,
  maxTreeDepth: DEFAULT_LIMITS.maxTreeDepth,
  maxFormOperators: DEFAULT_LIMITS.maxFormOperators,
  maxPredictorSamples: DEFAULT_LIMITS.maxPredictorSamples,
  maxImageDimension: DEFAULT_LIMITS.maxImageDimension,
  maxImagePixels: DEFAULT_LIMITS.maxImagePixels,
  maxImageBytes: DEFAULT_LIMITS.maxImageBytes,
  maxImageFrames: DEFAULT_LIMITS.maxImageFrames,
  maxFontBytes: DEFAULT_LIMITS.maxFontBytes,
});

/** The name of one entry of {@link INTERNAL_LIMITS}. */
export type ResourceLimitName = keyof typeof INTERNAL_LIMITS;

/** What each limit counts, as the {@link ResourceLimitError} message names it. */
export const LIMIT_UNITS: Readonly<Record<LimitName, string>> = Object.freeze({
  maxDecodedStreamBytes: 'bytes',
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
  maxTotalDecodedBytes: 'bytes',
  maxTotalCMapMappings: 'mappings',
  maxTotalImageBytes: 'bytes',
  maxPageOperators: 'operators',
});

/**
 * The largest value a `limits` option may set, where it is below
 * `Number.MAX_SAFE_INTEGER`. The depth limits stay at or below their
 * defaults: the readers that walk them recurse, and a deeper walk would end in
 * a stack overflow instead of a typed error.
 */
const CEILINGS: Readonly<Partial<Record<LimitName, number>>> = Object.freeze({
  maxDerDepth: DEFAULT_LIMITS.maxDerDepth,
  maxTreeDepth: DEFAULT_LIMITS.maxTreeDepth,
  maxFontCmapMappings: 0x110000,
});

/**
 * Validates a `limits` option and applies it over `base`.
 *
 * @param overrides - The `limits` option of a call; `undefined` sets nothing.
 * @param base - The limits the option applies over; {@link DEFAULT_LIMITS} by default.
 * @returns `base` itself when the option sets no limit, otherwise a new frozen object.
 * @throws {InvalidArgumentError} For an option that is not an object (argument `limits`),
 *   an unknown key, or a value that is not a whole number from 1 to the ceiling of its
 *   limit (argument `limits.<name>`).
 */
export function resolveLimits(
  overrides: PdfLimits | undefined,
  base: ResolvedLimits = DEFAULT_LIMITS,
): ResolvedLimits {
  if (overrides === undefined) return base;
  if (typeof overrides !== 'object' || overrides === null) {
    throw new InvalidArgumentError(`limits must be an object, got ${String(overrides)}`, {
      argument: 'limits',
    });
  }
  const set: Partial<Record<LimitName, number>> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, key)) {
      throw new InvalidArgumentError(`limits.${key} is not a limit`, { argument: `limits.${key}` });
    }
    if (value === undefined) continue;
    const name = key as LimitName;
    const ceiling = CEILINGS[name] ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) {
      throw new InvalidArgumentError(
        `limits.${name} must be a whole number from 1 to ${ceiling}, got ${String(value)}`,
        { argument: `limits.${name}` },
      );
    }
    set[name] = value;
  }
  if (Object.keys(set).length === 0) return base;
  return Object.freeze({ ...base, ...set });
}

/** What one public call carries down to every check it reaches. */
export interface LimitContext {
  /** The limits in force for the call. */
  readonly limits: ResolvedLimits;
  /** The sums of this call only, one per total; {@link addToTotal} adds to them. */
  readonly totals: {
    decodedBytes: number;
    cmapMappings: number;
    imageBytes: number;
    pageOperators: number;
  };
}

/** The field of {@link LimitContext.totals} each total sums into. */
const TOTAL_FIELDS = Object.freeze({
  maxTotalDecodedBytes: 'decodedBytes',
  maxTotalCMapMappings: 'cmapMappings',
  maxTotalImageBytes: 'imageBytes',
  maxPageOperators: 'pageOperators',
} as const satisfies Record<TotalName, keyof LimitContext['totals']>);

/**
 * Starts the context of one public call, with every total at zero.
 *
 * @param limits - The limits in force for the call, from {@link resolveLimits}.
 */
export function beginCall(limits: ResolvedLimits): LimitContext {
  return {
    limits,
    totals: { decodedBytes: 0, cmapMappings: 0, imageBytes: 0, pageOperators: 0 },
  };
}

/**
 * Throws {@link ResourceLimitError} when `actual` is above the limit in
 * force, or is not a finite number (NaN, Infinity, -Infinity); returns
 * otherwise. The error carries the limit's name, its value, `actual`
 * (`undefined` when it is not finite) and `source`: `'option'` when the
 * limit in force differs from its default, `'default'` otherwise. Call it
 * before the allocation or the step the limit guards.
 *
 * @param ctx - The context of the call.
 * @param limit - The limit to check against.
 * @param actual - The size the input needs.
 */
export function assertLimit(ctx: LimitContext, limit: LimitName, actual: number): void {
  const max = ctx.limits[limit];
  const finite = Number.isFinite(actual);
  if (finite && actual <= max) return;
  throw new ResourceLimitError(limit, max, LIMIT_UNITS[limit], finite ? actual : undefined, {
    source: max === DEFAULT_LIMITS[limit] ? 'default' : 'option',
  });
}

/**
 * Adds `n` to a total of the call and throws {@link ResourceLimitError}, as
 * {@link assertLimit} does, when the sum is above that total's limit or is
 * not a finite number.
 *
 * @param ctx - The context of the call.
 * @param total - The total to add to.
 * @param n - The amount the input adds, such as the bytes one stage decoded.
 */
export function addToTotal(ctx: LimitContext, total: TotalName, n: number): void {
  const field = TOTAL_FIELDS[total];
  const sum = ctx.totals[field] + n;
  ctx.totals[field] = sum;
  assertLimit(ctx, total, sum);
}

/** A context over {@link DEFAULT_LIMITS}, new on every call, for the modules that do not take a context yet. */
export function legacyContext(): LimitContext {
  return beginCall(DEFAULT_LIMITS);
}

/**
 * {@link assertLimit} against the defaults, through {@link legacyContext}:
 * for the modules that do not take a context yet.
 *
 * @param limit - The limit to check against.
 * @param actual - The size the input needs.
 */
export function assertWithinLimit(limit: LimitName, actual: number): void {
  assertLimit(legacyContext(), limit, actual);
}
