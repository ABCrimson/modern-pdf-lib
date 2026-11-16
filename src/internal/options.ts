/**
 * @module internal/options
 *
 * The option rule table: every option, and every whole call, that this release refuses with an
 * {@link UnsupportedOptionError} instead of accepting and ignoring it. A row either names the
 * release that carries the option out (`plannedFor`) or says the option was removed in 0.41.0.
 * The message of the error is built from the row alone, never from a value the caller passed.
 *
 * Each `plannedFor` is the open target release of its ledger ids in `audit/open-highs.json`. The
 * ids are not kept here, because nothing reads them at run time and they would ship in every
 * bundle that reaches the table; the unit test of this module holds them and checks that. No
 * package entry exports this module.
 */

import { UnsupportedOptionError } from '../errors.js';
import type { PdfLibVersion } from '../errors.js';

/** One option, or one whole call, that this release refuses. */
export interface UnsupportedOptionRule {
  /** The function or constructor, as `signPdf()` or `new StreamingPdfParser()`. */
  readonly entry: string;
  /** The option; absent when the whole call is refused. */
  readonly option?: string;
  /** The release that carries it out; present only when a ledger id carries that target. */
  readonly plannedFor?: PdfLibVersion;
  /** A fixed sentence the message ends with; removed options only. */
  readonly hint?: string;
}

/** The sentence that sends a caller of a barcode renderer to the function that draws the text. */
const DRAW_TEXT = 'Use renderStyledBarcode() to draw the text.';

/** Every option or call that throws: nine that name a release, then those removed in 0.41.0. */
export const UNSUPPORTED_OPTIONS: readonly UnsupportedOptionRule[] = [
  {
    entry: 'signPdf()',
    option: 'timestampUrl',
    plannedFor: '0.45.0',
  },
  {
    entry: 'setCertificationLevel()',
    plannedFor: '0.45.0',
  },
  {
    entry: 'addFieldLock()',
    plannedFor: '0.45.0',
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'timeout',
    plannedFor: '0.45.0',
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'trustedCerts',
    plannedFor: '0.45.0',
  },
  {
    entry: 'validateCertificateChain()',
    option: 'checkRevocation',
    plannedFor: '0.45.0',
  },
  {
    entry: 'saveAsStream()',
    option: 'objectStreamThreshold',
    plannedFor: '0.41.2',
  },
  {
    entry: 'new PdfStructureElement()',
    option: 'scope',
    plannedFor: '0.46.0',
  },
  {
    entry: 'new PdfStructureElement()',
    option: 'rowSpan',
    plannedFor: '0.46.0',
  },
  { entry: 'new StreamingPdfParser()', option: 'parseContentStreams' },
  { entry: 'embedFont()', option: 'features' },
  { entry: 'saveIncremental()', option: 'objectStreamThreshold' },
  { entry: 'saveIncrementalWithSignaturePreservation()', option: 'compress' },
  { entry: 'appendIncrementalUpdate()', option: 'compress' },
  { entry: 'code128ToOperators()', option: 'showText', hint: DRAW_TEXT },
  { entry: 'code128ToOperators()', option: 'fontSize', hint: DRAW_TEXT },
  { entry: 'code39ToOperators()', option: 'showText', hint: DRAW_TEXT },
  {
    entry: 'code39ToOperators()',
    option: 'includeCheckDigit',
    hint: 'Pass it to encodeCode39() instead.',
  },
  {
    entry: 'code39ToOperators()',
    option: 'wideToNarrowRatio',
    hint: 'Pass it to encodeCode39() instead.',
  },
  { entry: 'itfToOperators()', option: 'showText', hint: DRAW_TEXT },
  {
    entry: 'itfToOperators()',
    option: 'wideToNarrowRatio',
    hint: 'Pass it to encodeItf() instead.',
  },
  { entry: 'ean13ToOperators()', option: 'showText', hint: DRAW_TEXT },
  { entry: 'ean13ToOperators()', option: 'fontSize', hint: DRAW_TEXT },
  { entry: 'ean8ToOperators()', option: 'showText', hint: DRAW_TEXT },
  { entry: 'ean8ToOperators()', option: 'fontSize', hint: DRAW_TEXT },
  { entry: 'upcAToOperators()', option: 'showText', hint: DRAW_TEXT },
  { entry: 'upcAToOperators()', option: 'fontSize', hint: DRAW_TEXT },
  {
    entry: 'qrCodeToOperators()',
    option: 'errorCorrection',
    hint: 'Pass it to encodeQrCode() instead.',
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'columns',
    hint: 'Pass it to encodePdf417() instead.',
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'errorLevel',
    hint: 'Pass it to encodePdf417() instead.',
  },
  {
    entry: 'buildPdfX6OutputIntent()',
    option: 'variant',
    hint: 'Pass the variant to buildGtsPdfxVersion() instead.',
  },
  {
    entry: 'applyTablePreset()',
    option: 'hasHeader',
    hint: 'Use the headerRows table option instead.',
  },
  { entry: 'optimizeAllImages()', option: 'maxDpi' },
];

/**
 * Throw the {@link UnsupportedOptionError} of `rule`.
 *
 * @param rule  A row of {@link UNSUPPORTED_OPTIONS}.
 * @throws {UnsupportedOptionError}  Always.
 */
export function rejectOption(rule: UnsupportedOptionRule): never {
  throw new UnsupportedOptionError(rule.entry, rule.option, rule.plannedFor, { hint: rule.hint });
}
