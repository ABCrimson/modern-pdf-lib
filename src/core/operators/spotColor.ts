/**
 * @module core/operators/spotColor
 *
 * Separation and DeviceN colour space construction for PDF.
 *
 * Separation colour spaces (PDF 1.7, §8.6.6.4) map a single named
 * colorant to an alternate device colour space via a tint-transform
 * function.  DeviceN (§8.6.6.5) extends this to multiple colorants.
 *
 * This module builds the PDF array and PostScript function objects
 * needed to register these colour spaces as page resources.
 *
 * Reference: PDF 1.7 spec, §8.6.6.4 (Separation), §8.6.6.5 (DeviceN),
 *            §7.10.2 (Type 4 PostScript Calculator Functions).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../pdfObjects.js';
import type { PdfObject } from '../pdfObjects.js';
import type {
  RgbColor,
  CmykColor,
  GrayscaleColor,
} from './color.js';

// ---------------------------------------------------------------------------
// Tint-transform function builders (Type 4 PostScript Calculator)
// ---------------------------------------------------------------------------

/**
 * Build a Type 4 PostScript calculator function that maps a single
 * tint value `[0, 1]` to the alternate colour space components.
 *
 * For a CMYK alternate `{c, m, y, k}`:
 * ```
 * { dup <c> mul exch dup <m> mul exch dup <y> mul exch <k> mul }
 * ```
 * This maps `tint → [c*tint, m*tint, y*tint, k*tint]`.
 *
 * For an RGB alternate `{r, g, b}`:
 * ```
 * { dup <1-r> mul 1 exch sub exch dup <1-g> mul 1 exch sub exch <1-b> mul 1 exch sub }
 * ```
 * This maps `tint → [1-(1-r)*tint, 1-(1-g)*tint, 1-(1-b)*tint]`,
 * so tint=0 → white and tint=1 → the colour.
 *
 * For a grayscale alternate:
 * ```
 * { <1-gray> mul 1 exch sub }
 * ```
 */
function buildTintTransform(
  alternate: RgbColor | CmykColor | GrayscaleColor,
): PdfStream {
  const dict = new PdfDict();
  dict.set('/FunctionType', PdfNumber.of(4));

  // Domain: single tint value [0, 1]
  dict.set('/Domain', PdfArray.fromNumbers([0, 1]));

  let psCode: string;

  switch (alternate.type) {
    case 'cmyk': {
      // Range: [0 1 0 1 0 1 0 1] for CMYK
      dict.set('/Range', PdfArray.fromNumbers([0, 1, 0, 1, 0, 1, 0, 1]));
      const { c, m, y, k } = alternate;
      // Stack: tint → c*t m*t y*t k*t
      psCode = `{ dup ${pn(c)} mul exch dup ${pn(m)} mul exch dup ${pn(y)} mul exch ${pn(k)} mul }`;
      break;
    }
    case 'rgb': {
      // Range: [0 1 0 1 0 1] for RGB
      dict.set('/Range', PdfArray.fromNumbers([0, 1, 0, 1, 0, 1]));
      const ir = 1 - alternate.r;
      const ig = 1 - alternate.g;
      const ib = 1 - alternate.b;
      // tint=0 → white (1,1,1), tint=1 → (r,g,b)
      psCode = `{ dup ${pn(ir)} mul 1 exch sub exch dup ${pn(ig)} mul 1 exch sub exch ${pn(ib)} mul 1 exch sub }`;
      break;
    }
    case 'grayscale': {
      // Range: [0 1] for Gray
      dict.set('/Range', PdfArray.fromNumbers([0, 1]));
      const ig = 1 - alternate.gray;
      // tint=0 → 1 (white), tint=1 → gray
      psCode = `{ ${pn(ig)} mul 1 exch sub }`;
      break;
    }
  }

  const data = new TextEncoder().encode(psCode);
  dict.set('/Length', PdfNumber.of(data.length));
  return new PdfStream(dict, data);
}

/**
 * Build a Type 4 PostScript calculator function that maps DeviceN
 * tint values to the alternate colour space.
 *
 * For simplicity this builds an identity-like mapping: each tint
 * passes through directly. The caller's alternate space determines
 * interpretation. For CMYK alternates with 4 colorants, this is
 * `{ }` (identity). For other counts, we build the appropriate
 * passthrough.
 */
function buildDeviceNTintTransform(
  colorantCount: number,
  alternateSpace: 'DeviceCMYK' | 'DeviceRGB',
): PdfStream {
  const dict = new PdfDict();
  dict.set('/FunctionType', PdfNumber.of(4));

  // Domain: N tint values
  const domain: number[] = [];
  for (let i = 0; i < colorantCount; i++) {
    domain.push(0, 1);
  }
  dict.set('/Domain', PdfArray.fromNumbers(domain));

  const outComponents = alternateSpace === 'DeviceCMYK' ? 4 : 3;
  const range: number[] = [];
  for (let i = 0; i < outComponents; i++) {
    range.push(0, 1);
  }
  dict.set('/Range', PdfArray.fromNumbers(range));

  // Build a simple PostScript function.
  // If colorant count matches output components, pass through.
  // Otherwise, pad with zeros or truncate.
  let psCode: string;
  if (colorantCount === outComponents) {
    psCode = '{ }';
  } else if (colorantCount > outComponents) {
    // Drop excess values from bottom of stack
    const drops = colorantCount - outComponents;
    const popOps = Array.from({ length: drops }, () => `${outComponents} -1 roll pop`).join(' ');
    psCode = `{ ${popOps} }`;
  } else {
    // Fewer colorants than needed — pad with 0
    const pads = outComponents - colorantCount;
    const padOps = Array.from({ length: pads }, () => '0').join(' ');
    psCode = `{ ${padOps} }`;
  }

  const data = new TextEncoder().encode(psCode);
  dict.set('/Length', PdfNumber.of(data.length));
  return new PdfStream(dict, data);
}

// ---------------------------------------------------------------------------
// Public: Separation colour space builder
// ---------------------------------------------------------------------------

/**
 * Build a Separation colour space array for a spot colour.
 *
 * The returned `PdfArray` has the structure:
 * ```
 * [/Separation /ColorantName /DeviceCMYK <tint-transform-function>]
 * ```
 *
 * This array should be registered as a page colour space resource
 * under the name returned by {@link spotResourceName}.
 *
 * @param name       Colorant name (e.g. `'PANTONE 185 C'`).
 * @param alternate  The fallback colour whose space and values define
 *                   the tint-transform mapping.
 * @returns A `PdfArray` representing the Separation colour space.
 *
 * @example
 * ```ts
 * import { buildSeparationColorSpace, cmyk, spotResourceName } from 'modern-pdf-lib';
 *
 * const pantone = cmyk(0, 0.91, 0.76, 0);
 * const csArray = buildSeparationColorSpace('PANTONE 185 C', pantone);
 * // Register as page resource:
 * //   page.node.get('/Resources').get('/ColorSpace').set(
 * //     `/${spotResourceName('PANTONE 185 C')}`, csArray
 * //   );
 * ```
 */
export function buildSeparationColorSpace(
  name: string,
  alternate: RgbColor | CmykColor | GrayscaleColor,
): PdfArray {
  const items: PdfObject[] = [
    PdfName.of('/Separation'),
    PdfName.of(`/${name}`),
    PdfName.of(alternateSpaceName(alternate)),
    buildTintTransform(alternate),
  ];
  return PdfArray.of(items);
}

// ---------------------------------------------------------------------------
// Public: DeviceN colour space builder
// ---------------------------------------------------------------------------

/**
 * Build a DeviceN colour space array for multi-ink printing.
 *
 * The returned `PdfArray` has the structure:
 * ```
 * [/DeviceN [/Colorant1 /Colorant2 ...] /DeviceCMYK <tint-transform>]
 * ```
 *
 * @param colorants       Ordered list of colorant names.
 * @param alternateSpace  The alternate device colour space.
 * @returns A `PdfArray` representing the DeviceN colour space.
 */
export function buildDeviceNColorSpace(
  colorants: string[],
  alternateSpace: 'DeviceCMYK' | 'DeviceRGB',
): PdfArray {
  const nameArray = PdfArray.of(
    colorants.map((c) => PdfName.of(`/${c}`)),
  );

  const items: PdfObject[] = [
    PdfName.of('/DeviceN'),
    nameArray,
    PdfName.of(`/${alternateSpace}`),
    buildDeviceNTintTransform(colorants.length, alternateSpace),
  ];
  return PdfArray.of(items);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number for PostScript code. */
function pn(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Map a base colour type to its PDF device colour space name. */
function alternateSpaceName(
  color: RgbColor | CmykColor | GrayscaleColor,
): string {
  switch (color.type) {
    case 'rgb':
      return '/DeviceRGB';
    case 'cmyk':
      return '/DeviceCMYK';
    case 'grayscale':
      return '/DeviceGray';
  }
}
