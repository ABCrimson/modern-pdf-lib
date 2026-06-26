/**
 * @module core/halftone
 *
 * Halftone dictionaries and transfer functions per ISO 32000-2 §10.5
 * (Halftones) and §10.6 (Transfer functions).
 *
 * A halftone defines how continuous-tone colour is converted to the
 * binary (or few-level) pattern of a device.  PDF supports five halftone
 * types:
 *
 * - **Type 1** — a single spot function with a screen frequency and angle.
 * - **Type 5** — a colorant-keyed collection of other halftones plus a
 *   `/Default` fallback.
 * - **Type 6** — a threshold array (8-bit) supplied as a stream.
 * - **Type 10** — a threshold array supplied as a stream using an angled
 *   (sheared) tiling described by `/Xsquare` and `/Ysquare`.
 * - **Type 16** — a 16-bit threshold array supplied as a stream.
 *
 * This module builds the corresponding PDF objects.  It does not embed
 * them into a document; callers register the returned objects and link
 * them from a graphics-state dictionary via `/HT`.
 *
 * Reference: ISO 32000-2:2020, §10.5 (Halftones), Tables 73–78.
 */

import {
  PdfArray,
  PdfBool,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfString,
} from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Standard spot functions
// ---------------------------------------------------------------------------

/**
 * The predefined spot-function names recognised by conforming readers
 * (ISO 32000-2, Table 75).  Any of these may be used as the
 * `spotFunction` of a {@link Type1Halftone}.
 */
export const STANDARD_SPOT_FUNCTIONS: readonly string[] = [
  'SimpleDot',
  'InvertedSimpleDot',
  'DoubleDot',
  'InvertedDoubleDot',
  'CosineDot',
  'Double',
  'InvertedDouble',
  'Line',
  'LineX',
  'LineY',
  'Round',
  'Ellipse',
  'EllipseA',
  'InvertedEllipseA',
  'EllipseB',
  'EllipseC',
  'InvertedEllipseC',
  'Square',
  'Cross',
  'Rhomboid',
  'Diamond',
];

// ---------------------------------------------------------------------------
// Type 1 halftone
// ---------------------------------------------------------------------------

/**
 * Parameters for a Type 1 (spot-function) halftone.
 */
export interface Type1Halftone {
  /** Screen frequency in halftone cells per inch. */
  readonly frequency: number;
  /** Screen angle in degrees, measured counter-clockwise. */
  readonly angle: number;
  /**
   * The spot function — typically one of {@link STANDARD_SPOT_FUNCTIONS}.
   * Emitted as a PDF name `/SpotFunction`.
   */
  readonly spotFunction: string;
  /**
   * When `true`, request the more accurate (but slower) screening
   * algorithm via `/AccurateScreens true`.
   */
  readonly accurateScreens?: boolean | undefined;
}

/**
 * Build a Type 1 halftone dictionary.
 *
 * Emits `/Type /Halftone /HalftoneType 1` with numeric `/Frequency` and
 * `/Angle`, a `/SpotFunction` name, and an optional `/AccurateScreens`
 * boolean.
 */
export function buildType1Halftone(p: Type1Halftone): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Halftone'));
  dict.set('/HalftoneType', PdfNumber.of(1));
  dict.set('/Frequency', PdfNumber.of(p.frequency));
  dict.set('/Angle', PdfNumber.of(p.angle));
  dict.set('/SpotFunction', PdfName.of(p.spotFunction));
  if (p.accurateScreens !== undefined) {
    dict.set('/AccurateScreens', PdfBool.of(p.accurateScreens));
  }
  return dict;
}

// ---------------------------------------------------------------------------
// Threshold halftones (types 6, 10, 16)
// ---------------------------------------------------------------------------

/**
 * Build a threshold-array halftone stream (Type 6, 10, or 16).
 *
 * Emits a stream whose dictionary carries `/Type /Halftone`,
 * `/HalftoneType` (6, 10, or 16), `/Width`, and `/Height`, and whose body
 * is the raw threshold data.
 *
 * For Type 16 the threshold samples are 16-bit; callers must supply two
 * bytes per sample in big-endian order inside `thresholds`.
 */
export function buildThresholdHalftone(
  halftoneType: 6 | 10 | 16,
  width: number,
  height: number,
  thresholds: Uint8Array,
): PdfStream {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Halftone'));
  dict.set('/HalftoneType', PdfNumber.of(halftoneType));
  dict.set('/Width', PdfNumber.of(width));
  dict.set('/Height', PdfNumber.of(height));
  // PdfStream.fromBytes sets /Length to match the data.
  return PdfStream.fromBytes(thresholds, dict);
}

// ---------------------------------------------------------------------------
// Type 5 halftone (colorant-keyed)
// ---------------------------------------------------------------------------

/**
 * Build a Type 5 halftone dictionary.
 *
 * A Type 5 halftone maps each named colorant to its own halftone
 * dictionary and supplies a `/Default` halftone for any colorant not
 * explicitly listed.  Emits `/Type /Halftone /HalftoneType 5`, one entry
 * per colorant (keyed by colorant name), and `/Default`.
 *
 * @param colorants Map of colorant name → halftone dictionary (each a
 *   Type 1/6/10/16 halftone). The reserved key `Default` is ignored here
 *   in favour of `defaultHalftone`.
 * @param defaultHalftone The fallback halftone for unlisted colorants.
 */
export function buildType5Halftone(
  colorants: Readonly<Record<string, PdfDict>>,
  defaultHalftone: PdfDict,
): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Halftone'));
  dict.set('/HalftoneType', PdfNumber.of(5));
  for (const [name, ht] of Object.entries(colorants)) {
    if (name === 'Default') continue;
    dict.set(`/${name}`, ht);
  }
  dict.set('/Default', defaultHalftone);
  return dict;
}

// ---------------------------------------------------------------------------
// Transfer functions (§10.6)
// ---------------------------------------------------------------------------

/**
 * Build an `Identity` transfer-function name object (`/Identity`).
 *
 * The value of a transfer function entry may be the name `Identity`, in
 * which case no adjustment is applied to component values.
 */
export function identityTransferFunction(): PdfName {
  return PdfName.of('Identity');
}

/**
 * Build a sampled (Type 0) transfer-function stream from a lookup table.
 *
 * Emits a stream with `/FunctionType 0`, `/Domain [0 1]`, `/Range [0 1]`,
 * `/Size [n]`, and `/BitsPerSample 8`; the body is the raw `samples`
 * array (one byte per sample, mapping input 0..1 to output 0..1).
 *
 * @param samples 8-bit output samples spanning the input domain `[0, 1]`.
 */
export function buildSampledTransferFunction(samples: Uint8Array): PdfStream {
  if (samples.length === 0) {
    throw new RangeError('transfer function requires at least one sample');
  }
  const dict = new PdfDict();
  dict.set('/FunctionType', PdfNumber.of(0));
  dict.set('/Domain', PdfArray.fromNumbers([0, 1]));
  dict.set('/Range', PdfArray.fromNumbers([0, 1]));
  dict.set('/Size', PdfArray.fromNumbers([samples.length]));
  dict.set('/BitsPerSample', PdfNumber.of(8));
  return PdfStream.fromBytes(samples, dict);
}

/**
 * Build a graphics-state-ready halftone reference dictionary fragment
 * pairing a halftone with an optional `/HalftoneName`.
 *
 * Emits the supplied halftone unchanged when `name` is omitted; otherwise
 * sets `/HalftoneName` (a literal string) on it and returns it. This is a
 * convenience for naming a halftone for caching by conforming readers.
 */
export function nameHalftone(halftone: PdfDict, name?: string): PdfDict {
  if (name !== undefined) {
    halftone.set('/HalftoneName', PdfString.literal(name));
  }
  return halftone;
}
