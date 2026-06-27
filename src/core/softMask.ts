/**
 * @module core/softMask
 *
 * Soft-mask groups in graphics state (ISO 32000-1 §11.6.5.2).
 *
 * A *soft mask* defines a per-pixel shape/opacity for subsequent painting
 * operations.  It is carried in an `ExtGState` dictionary under the `/SMask`
 * key.  The mask is derived from a *transparency-group XObject* (a form
 * XObject whose `/Group` dictionary has `/S /Transparency`):
 *
 *  - A **luminosity** mask (`/S /Luminosity`) computes the mask value from the
 *    luminosity of the group's composited result.  An optional `/BC` backdrop
 *    color sets the colour against which the group is composited before the
 *    luminosity is measured.
 *  - An **alpha** mask (`/S /Alpha`) computes the mask value from the group's
 *    accumulated alpha (shape/opacity).  `/BC` is not meaningful and is omitted.
 *
 * An optional `/TR` *transfer function* remaps the computed mask values; it may
 * be an indirect reference to a function object or the name `/Identity`.
 *
 * These are pure builders: they return spec-shaped `ExtGState` dictionaries.
 * Registering the result and naming it in a page's `/Resources /ExtGState`
 * (e.g. via `page.registerExtGState(name, registry.register(extGState))`) is
 * the caller's concern.
 *
 * Reference: ISO 32000-1:2008, §11.6.5.2 (Mask shape and opacity);
 *            ISO 32000-1:2008, §8.4.5 (Graphics state, `/SMask`).
 */

import { PdfArray, PdfDict, PdfName } from './pdfObjects.js';
import type { PdfRef } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options describing a soft-mask group to wrap in an `ExtGState`.
 */
export interface SoftMaskGroupOptions {
  /**
   * Indirect reference to the transparency-group form XObject that supplies
   * the mask.  Its `/Group` dictionary must declare `/S /Transparency`.
   */
  readonly groupXObject: PdfRef;
  /**
   * Mask subtype: `'Luminosity'` (default) measures the composited
   * luminosity, `'Alpha'` measures the accumulated alpha.
   */
  readonly type?: 'Luminosity' | 'Alpha' | undefined;
  /**
   * Backdrop colour the group is composited against before the luminosity is
   * measured.  Component count must match the group's colour space.  Honoured
   * only for luminosity masks; ignored for alpha masks.
   */
  readonly backdropColor?: readonly number[] | undefined;
  /**
   * Transfer function remapping computed mask values — either an indirect
   * reference to a function object or the literal name `'Identity'`.
   */
  readonly transferFunction?: PdfRef | 'Identity' | undefined;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build an `ExtGState` dictionary that installs a soft-mask group.
 *
 * The returned dictionary has `/Type /ExtGState` and an `/SMask` mask
 * dictionary:
 *
 *  - `/Type /Mask`
 *  - `/S /Luminosity` or `/S /Alpha` (per {@link SoftMaskGroupOptions.type},
 *    defaulting to `Luminosity`)
 *  - `/G` → the supplied group XObject reference
 *  - `/BC [ … ]` — backdrop colour, **only** for luminosity masks and only
 *    when {@link SoftMaskGroupOptions.backdropColor} is provided
 *  - `/TR` → the transfer function (indirect reference) or the name
 *    `/Identity`, only when {@link SoftMaskGroupOptions.transferFunction} is
 *    provided
 *
 * @param options - The soft-mask group description.
 * @returns A spec-shaped `ExtGState` {@link PdfDict}.
 */
export function buildSoftMaskGroupExtGState(
  options: SoftMaskGroupOptions,
): PdfDict {
  const subtype = options.type ?? 'Luminosity';

  const smask = new PdfDict();
  smask.set('/Type', PdfName.of('Mask'));
  smask.set('/S', PdfName.of(subtype));
  smask.set('/G', options.groupXObject);

  // /BC is meaningful only for luminosity masks.
  if (
    subtype === 'Luminosity' &&
    options.backdropColor !== undefined &&
    options.backdropColor.length > 0
  ) {
    smask.set('/BC', PdfArray.fromNumbers([...options.backdropColor]));
  }

  // /TR transfer function: indirect reference or the /Identity name.
  if (options.transferFunction !== undefined) {
    smask.set(
      '/TR',
      options.transferFunction === 'Identity'
        ? PdfName.of('Identity')
        : options.transferFunction,
    );
  }

  const extGState = new PdfDict();
  extGState.set('/Type', PdfName.of('ExtGState'));
  extGState.set('/SMask', smask);
  return extGState;
}

/**
 * Build an `ExtGState` dictionary that clears any active soft mask by setting
 * `/SMask /None`.  Apply this after a masked region to restore unmasked
 * painting.
 *
 * @returns An `ExtGState` {@link PdfDict} with `/SMask /None`.
 */
export function buildSoftMaskNone(): PdfDict {
  const extGState = new PdfDict();
  extGState.set('/Type', PdfName.of('ExtGState'));
  extGState.set('/SMask', PdfName.of('None'));
  return extGState;
}
