/**
 * @module core/imageMask
 *
 * Image masks and black-point compensation per ISO 32000-2 §8.9.6
 * (Masked images) and §8.6.5.9 (Black-point compensation).
 *
 * PDF supports three ways of masking an image XObject:
 *
 * - **Stencil mask** — a 1-bit-per-component `/ImageMask` image whose sample
 *   values select which areas of the page are painted with the current fill
 *   colour and which are left untouched (§8.9.6.2). The mask data is packed
 *   one bit per sample, each row byte-aligned (`ceil(width / 8)` bytes per
 *   row); the caller supplies the already-packed bytes.
 * - **Colour-key mask** — a `/Mask` array of `[min0 max0 min1 max1 …]`
 *   integer ranges (two per colour component) that makes matching sample
 *   colours transparent (§8.9.6.4).
 * - **Soft mask** — a separate DeviceGray image referenced from a base
 *   image's `/SMask` entry, giving per-pixel opacity (§11.6.5.2).
 *
 * Black-point compensation (§8.6.5.9) is controlled through an ExtGState's
 * `/UseBlackPtComp` entry, which selects whether the conversion between
 * colour spaces maps source black to destination black.
 *
 * These are pure builders: they construct (and, for the stream variants,
 * register) PDF objects but do not wire them into a page or resource
 * dictionary — that is the caller's concern.
 *
 * Reference: ISO 32000-2:2020, §8.9.6 (Masked images), §8.6.5.9
 *            (Black-point compensation).
 */

import {
  PdfArray,
  PdfBool,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from './pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Stencil mask
// ---------------------------------------------------------------------------

/**
 * Build a stencil mask: a 1-bit `/ImageMask` image XObject (§8.9.6.2).
 *
 * The returned stream has `/Type /XObject`, `/Subtype /Image`,
 * `/ImageMask true`, `/BitsPerComponent 1`, and the supplied `/Width` and
 * `/Height`. When a `decode` pair is given it is emitted as a `/Decode`
 * array, allowing the mask polarity to be inverted (`[1 0]`).
 *
 * The `bits` buffer must already be packed one bit per sample with each row
 * byte-aligned (`ceil(width / 8)` bytes per row); this builder stores it
 * verbatim and does not repack it.
 *
 * @param registry - Registry to register the stream into.
 * @param bits     - Packed, byte-aligned 1-bpc mask data.
 * @param width    - Image width in samples.
 * @param height   - Image height in samples.
 * @param decode   - Optional `[d0, d1]` decode pair.
 * @returns An indirect reference to the registered image XObject stream.
 */
export function buildStencilMask(
  registry: PdfObjectRegistry,
  bits: Uint8Array,
  width: number,
  height: number,
  decode?: readonly [number, number] | undefined,
): PdfRef {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('XObject'));
  dict.set('/Subtype', PdfName.of('Image'));
  dict.set('/ImageMask', PdfBool.TRUE);
  dict.set('/BitsPerComponent', PdfNumber.of(1));
  dict.set('/Width', PdfNumber.of(width));
  dict.set('/Height', PdfNumber.of(height));
  if (decode !== undefined) {
    dict.set('/Decode', PdfArray.fromNumbers([decode[0], decode[1]]));
  }
  dict.set('/Length', PdfNumber.of(bits.length));

  return registry.register(new PdfStream(dict, bits));
}

// ---------------------------------------------------------------------------
// Colour-key mask
// ---------------------------------------------------------------------------

/**
 * Build a colour-key masking array (§8.9.6.4).
 *
 * The `ranges` list holds two integers — a minimum and a maximum — per
 * colour component, laid out as `[min0 max0 min1 max1 …]`. Sample colours
 * whose every component falls within its range become transparent. The
 * returned {@link PdfArray} is assigned to a base image's `/Mask` entry.
 *
 * @param ranges - An even-length list of `[min, max]` integer pairs.
 * @returns A `/Mask` {@link PdfArray} of {@link PdfNumber}s.
 * @throws RangeError if `ranges` is empty or has an odd length.
 */
export function buildColorKeyMask(ranges: readonly number[]): PdfArray {
  if (ranges.length === 0 || ranges.length % 2 !== 0) {
    throw new RangeError(
      `colour-key mask requires a non-empty even number of values (min/max pairs); got ${ranges.length}`,
    );
  }
  return new PdfArray(ranges.map((v) => PdfNumber.of(v)));
}

// ---------------------------------------------------------------------------
// Soft mask
// ---------------------------------------------------------------------------

/**
 * Build an image soft mask: a DeviceGray image XObject usable as a base
 * image's `/SMask` (§11.6.5.2).
 *
 * The returned stream has `/Type /XObject`, `/Subtype /Image`,
 * `/ColorSpace /DeviceGray`, the supplied `/Width` and `/Height`, and
 * `/BitsPerComponent` (defaulting to 8). Each grayscale sample provides the
 * opacity of the corresponding base-image pixel.
 *
 * @param registry          - Registry to register the stream into.
 * @param gray              - Grayscale opacity samples.
 * @param width             - Image width in samples.
 * @param height            - Image height in samples.
 * @param bitsPerComponent  - Bits per sample; defaults to 8.
 * @returns An indirect reference to the registered soft-mask image XObject.
 */
export function buildImageSoftMask(
  registry: PdfObjectRegistry,
  gray: Uint8Array,
  width: number,
  height: number,
  bitsPerComponent?: number | undefined,
): PdfRef {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('XObject'));
  dict.set('/Subtype', PdfName.of('Image'));
  dict.set('/Width', PdfNumber.of(width));
  dict.set('/Height', PdfNumber.of(height));
  dict.set('/ColorSpace', PdfName.of('DeviceGray'));
  dict.set('/BitsPerComponent', PdfNumber.of(bitsPerComponent ?? 8));
  dict.set('/Length', PdfNumber.of(gray.length));

  return registry.register(new PdfStream(dict, gray));
}

// ---------------------------------------------------------------------------
// Black-point compensation
// ---------------------------------------------------------------------------

/**
 * Build an ExtGState that controls black-point compensation (§8.6.5.9).
 *
 * The returned dictionary has `/Type /ExtGState` and `/UseBlackPtComp` set
 * to the requested mode:
 *
 * - `Default` — leave the choice to the conforming reader.
 * - `ON`      — always apply black-point compensation.
 * - `OFF`     — never apply black-point compensation.
 *
 * @param mode - The `/UseBlackPtComp` mode.
 * @returns An ExtGState {@link PdfDict}.
 */
export function buildBlackPointCompensationExtGState(
  mode: 'Default' | 'ON' | 'OFF',
): PdfDict {
  const gs = new PdfDict();
  gs.set('/Type', PdfName.of('ExtGState'));
  gs.set('/UseBlackPtComp', PdfName.of(mode));
  return gs;
}
