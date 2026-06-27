/**
 * @module compliance/pageOutputIntent
 *
 * Per-page and per-stream output intents (ISO 32000-2 §14.11.5).
 *
 * In addition to the document-level `/OutputIntents` array carried on the
 * catalog, PDF 2.0 permits an `/OutputIntents` array on individual *page*
 * dictionaries and on *Form XObject* stream dictionaries.  These narrower
 * intents override the document intent for the colour-managed content of that
 * page or form, which is essential for documents that mix output conditions
 * (for example, a PDF/X job whose individual pages target different print
 * presses).
 *
 * This module provides two pure builders:
 *
 *  - {@link buildPageOutputIntent} constructs a single `/OutputIntent`
 *    dictionary (reusing {@link buildOutputIntent} for the embedded ICC
 *    `/DestOutputProfile`) and registers it as an indirect object.
 *  - {@link attachOutputIntents} sets — or, when one already exists, appends
 *    to — the `/OutputIntents` array on a target dictionary (a page dict for
 *    per-page intents, or a Form XObject stream's dict for per-stream).
 *
 * Reference: ISO 32000-2:2020, §14.11.5 (Output intents).
 */

import { PdfArray, PdfName, PdfString } from '../core/pdfObjects.js';
import type { PdfDict, PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';
import { buildOutputIntent } from './outputIntent.js';

// ---------------------------------------------------------------------------
// attachOutputIntents
// ---------------------------------------------------------------------------

/**
 * Attach output-intent references to a target dictionary's `/OutputIntents`
 * array.
 *
 * If the target has no `/OutputIntents` entry, a fresh {@link PdfArray} is
 * created and populated with `intentRefs`.  If one already exists (and is an
 * array), the references are appended to it in order, preserving the existing
 * array instance.
 *
 * The target may be a page dictionary (for per-page intents) or a Form
 * XObject stream's dictionary (for per-stream intents).
 *
 * @param target      The page or Form XObject dictionary to mutate.
 * @param intentRefs  Indirect references to `/OutputIntent` dictionaries.
 */
export function attachOutputIntents(
  target: PdfDict,
  intentRefs: readonly PdfRef[],
): void {
  const existing = target.get('/OutputIntents');
  const array = existing instanceof PdfArray ? existing : new PdfArray();

  for (const ref of intentRefs) {
    array.push(ref);
  }

  if (!(existing instanceof PdfArray)) {
    target.set('/OutputIntents', array);
  }
}

// ---------------------------------------------------------------------------
// buildPageOutputIntent
// ---------------------------------------------------------------------------

/**
 * Options for a per-page / per-stream output intent.
 */
export interface PageOutputIntentOptions {
  /**
   * Custom ICC profile bytes to embed as the `/DestOutputProfile`.
   *
   * @default Built-in minimal sRGB ICC v2 profile.
   */
  iccProfile?: Uint8Array | undefined;

  /**
   * Number of colour components in the ICC profile (3 = RGB, 4 = CMYK,
   * 1 = Gray).  Must match the embedded profile's colour space.
   *
   * @default 3
   */
  components?: number | undefined;

  /**
   * Formal registry identifier for the output condition (`/OutputConditionIdentifier`).
   */
  outputConditionIdentifier?: string | undefined;

  /**
   * Human-readable additional information about the intended output device,
   * stored as the optional `/Info` entry.
   */
  info?: string | undefined;

  /**
   * Output-intent subtype (`/S`).  Common values are `/GTS_PDFA1` (PDF/A) and
   * `/GTS_PDFX` (PDF/X).
   *
   * @default '/GTS_PDFA1'
   */
  subtype?: string | undefined;
}

/**
 * Build a per-page / per-stream `/OutputIntent` dictionary and register it.
 *
 * The embedded ICC `/DestOutputProfile` is produced by reusing
 * {@link buildOutputIntent}; this builder then layers the per-page subtype
 * (`/S`), output-condition identifier and optional `/Info` string on top.
 * The resulting dictionary carries `/Type /OutputIntent` and may be attached
 * to a page or Form XObject dictionary via {@link attachOutputIntents}.
 *
 * @param registry  The PDF object registry to register objects into.
 * @param options   Output-intent configuration.
 * @returns         An indirect reference to the `/OutputIntent` dictionary.
 */
export function buildPageOutputIntent(
  registry: PdfObjectRegistry,
  options: PageOutputIntentOptions = {},
): PdfRef {
  const subtype = options.subtype ?? '/GTS_PDFA1';

  // Reuse the document-level builder for the ICC /DestOutputProfile stream and
  // the base /OutputIntent dictionary, forwarding only the entries it supports.
  const intentRef = buildOutputIntent(registry, {
    subtype,
    ...(options.iccProfile !== undefined ? { iccProfile: options.iccProfile } : {}),
    ...(options.components !== undefined ? { components: options.components } : {}),
    ...(options.outputConditionIdentifier !== undefined
      ? { outputConditionIdentifier: options.outputConditionIdentifier }
      : {}),
  });

  // Layer per-page-specific entries onto the registered dictionary.
  const intentDict = registry.resolve(intentRef);
  if (intentDict !== undefined && intentDict.kind === 'dict') {
    intentDict.set('/Type', PdfName.of('OutputIntent'));
    if (options.outputConditionIdentifier !== undefined) {
      intentDict.set(
        '/OutputConditionIdentifier',
        PdfString.literal(options.outputConditionIdentifier),
      );
    }
    if (options.info !== undefined) {
      intentDict.set('/Info', PdfString.literal(options.info));
    }
  }

  return intentRef;
}
