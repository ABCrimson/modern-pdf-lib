/**
 * @module compliance/outputIntent
 *
 * Build an OutputIntent dictionary for PDF/A compliance.
 *
 * An OutputIntent specifies the intended output device's color
 * characteristics. PDF/A requires at least one OutputIntent with
 * an embedded ICC profile when device-dependent color spaces are used
 * (DeviceRGB, DeviceCMYK, DeviceGray).
 *
 * The OutputIntent dictionary is added to the document catalog's
 * `/OutputIntents` array. The embedded ICC profile stream describes
 * the device's color characteristics.
 *
 * Reference: PDF 1.7 spec, section 14.11.5 (Output Intents);
 *            ISO 19005-1:2005, section 6.2.2 (Color).
 */

import { PdfDict, PdfName, PdfString, PdfNumber, PdfStream } from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';
import { SRGB_ICC_PROFILE } from './srgbIccProfile.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for building a PDF/A output intent.
 */
export interface OutputIntentOptions {
  /**
   * Output intent subtype.
   *
   * Common values:
   * - `/GTS_PDFA1` — PDF/A-1 (default)
   * - `/GTS_PDFX` — PDF/X
   * - `/ISO_PDFE1` — PDF/E
   *
   * @default '/GTS_PDFA1'
   */
  subtype?: string;

  /**
   * Human-readable output condition description.
   *
   * @default 'sRGB'
   */
  outputCondition?: string;

  /**
   * Formal registry identifier for the output condition.
   *
   * This should match a well-known profile identifier from the
   * ICC profile registry or a vendor-specific identifier.
   *
   * @default 'sRGB IEC61966-2.1'
   */
  outputConditionIdentifier?: string;

  /**
   * URL of the ICC profile registry.
   *
   * @default 'http://www.color.org'
   */
  registryName?: string;

  /**
   * Custom ICC profile bytes to embed instead of the built-in sRGB profile.
   *
   * When provided, the caller is responsible for ensuring the profile
   * is valid and matches the declared output condition.
   *
   * @default Built-in minimal sRGB ICC v2 profile.
   */
  iccProfile?: Uint8Array;

  /**
   * Number of color components in the ICC profile.
   *
   * Must match the profile's color space:
   * - 3 for RGB profiles
   * - 4 for CMYK profiles
   * - 1 for Gray profiles
   *
   * @default 3
   */
  components?: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build an OutputIntent dictionary and register it in the given registry.
 *
 * This creates:
 * 1. An ICC profile stream object (with `/N` set to the number of components)
 * 2. An OutputIntent dictionary referencing that profile
 *
 * Both objects are registered as indirect objects. The returned `PdfRef`
 * points to the OutputIntent dictionary, which should be added to the
 * catalog's `/OutputIntents` array.
 *
 * @param registry  The PDF object registry to register objects into.
 * @param options   Configuration for the output intent.
 * @returns         An indirect reference to the OutputIntent dictionary.
 *
 * @example
 * ```ts
 * import { PdfObjectRegistry } from 'modern-pdf-lib';
 * import { buildOutputIntent } from 'modern-pdf-lib';
 *
 * const registry = new PdfObjectRegistry();
 * const intentRef = buildOutputIntent(registry);
 * // Add intentRef to catalog's /OutputIntents array
 * ```
 */
export function buildOutputIntent(
  registry: PdfObjectRegistry,
  options: OutputIntentOptions = {},
): PdfRef {
  const profile = options.iccProfile ?? SRGB_ICC_PROFILE;
  const components = options.components ?? 3;

  // Build ICC profile stream
  const profileDict = new PdfDict(new Map<string, PdfNumber>([
    ['/N', new PdfNumber(components)],
    ['/Length', new PdfNumber(profile.length)],
  ]));
  const profileStream = new PdfStream(profileDict, profile);
  const profileRef = registry.register(profileStream);

  // Build OutputIntent dictionary
  const subtype = options.subtype ?? '/GTS_PDFA1';
  const normalizedSubtype = subtype.startsWith('/') ? subtype : `/${subtype}`;

  const intentDict = new PdfDict(new Map([
    ['/Type', PdfName.of('/OutputIntent')],
    ['/S', PdfName.of(normalizedSubtype)],
    ['/OutputCondition', PdfString.literal(options.outputCondition ?? 'sRGB')],
    ['/OutputConditionIdentifier', PdfString.literal(
      options.outputConditionIdentifier ?? 'sRGB IEC61966-2.1',
    )],
    ['/RegistryName', PdfString.literal(options.registryName ?? 'http://www.color.org')],
    ['/DestOutputProfile', profileRef],
  ]));

  return registry.register(intentDict);
}
