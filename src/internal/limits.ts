/**
 * @module internal/limits
 *
 * The limits on what one input may make the library allocate or walk. Each
 * limit is the largest value accepted: a value equal to it is accepted, a
 * value above it is refused with {@link ResourceLimitError} (code
 * `'resource-limit-exceeded'`). Twelve limits bound one item of the input (a
 * stream, table, tree, image, font or the forms of one page); four totals
 * bound a sum over one call (`maxTotalDecodedBytes` for the stream decoders,
 * `maxTotalCMapMappings` for text extraction, `maxTotalImageBytes` for the
 * image decoders and image extraction, `maxPageOperators` for page
 * interpretation).
 *
 * The public part (DEFAULT_LIMITS, LimitName, PdfLimits, ResolvedLimits) lives in src/limits.ts, which the package entries export.
 * {@link resolveLimits} checks a `limits` option once and applies it, and a
 * {@link LimitContext} carries the result and the totals of one call to every
 * check; nothing here keeps a limit or a total in module state. Every module
 * takes the context of its call as a parameter: only this module and
 * src/limits.ts name the defaults.
 *
 * @packageDocumentation
 */

import { InvalidArgumentError, ResourceLimitError } from '../errors.js';
import { DEFAULT_LIMITS, type LimitName, type PdfLimits, type ResolvedLimits } from '../limits.js';

/** One of the four limits that bound a sum over one public call. */
export type TotalName =
  | 'maxTotalDecodedBytes'
  | 'maxTotalCMapMappings'
  | 'maxTotalImageBytes'
  | 'maxPageOperators';

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
    throw new InvalidArgumentError(
      `limits must be an object, got ${overrides === null ? 'null' : typeof overrides}`,
      { argument: 'limits' },
    );
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
        `limits.${name} must be a whole number from 1 to ${ceiling}, got ${typeof value === 'number' ? String(value) : typeof value}`,
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

/**
 * The most decoded bytes a re-wrap or rewrite on save keeps:
 * {@link INTERNAL_LIMITS}.maxRewrapDecodedBytes (64 MiB), or the
 * `maxDecodedStreamBytes` of `ctx` when that is smaller, so a stream is never
 * decoded past the limits of its call.
 *
 * @param ctx - The context of the save.
 */
export function rewrapBound(ctx: LimitContext): number {
  return Math.min(INTERNAL_LIMITS.maxRewrapDecodedBytes, ctx.limits.maxDecodedStreamBytes);
}
