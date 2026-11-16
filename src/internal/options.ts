/**
 * @module internal/options
 *
 * The option rule table: every option, and every whole call, that this release refuses with an
 * {@link UnsupportedOptionError} instead of accepting and ignoring it. A row either names the
 * release that carries the option out (`plannedFor`) or says the option was removed in 0.41.0.
 * The message of the error is built from the row alone, never from a value the caller passed.
 *
 * Each `plannedFor` is the open target release of its ledger ids in `audit/open-highs.json`; the
 * unit test of this module checks that. No package entry exports this module.
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
  /** The ledger ids whose open target must equal `plannedFor`. */
  readonly ledger: readonly string[];
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
    ledger: ['signature-cms-08', 'docs-guide-2-23'],
  },
  {
    entry: 'setCertificationLevel()',
    plannedFor: '0.45.0',
    ledger: ['signature-pki-09', 'docs-guide-2-23'],
  },
  {
    entry: 'addFieldLock()',
    plannedFor: '0.45.0',
    ledger: ['signature-pki-10', 'docs-guide-2-23'],
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'timeout',
    plannedFor: '0.45.0',
    ledger: ['signature-cms-05'],
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'trustedCerts',
    plannedFor: '0.45.0',
    ledger: ['signature-cms-05'],
  },
  {
    entry: 'validateCertificateChain()',
    option: 'checkRevocation',
    plannedFor: '0.45.0',
    ledger: ['signature-pki-02'],
  },
  {
    entry: 'saveAsStream()',
    option: 'objectStreamThreshold',
    plannedFor: '0.41.2',
    ledger: ['oracle-gates-R02', 'docs-guide-3-27'],
  },
  {
    entry: 'new PdfStructureElement()',
    option: 'scope',
    plannedFor: '0.46.0',
    ledger: ['accessibility-metadata-04'],
  },
  {
    entry: 'new PdfStructureElement()',
    option: 'rowSpan',
    plannedFor: '0.46.0',
    ledger: ['accessibility-metadata-04'],
  },
  { entry: 'new StreamingPdfParser()', option: 'parseContentStreams', ledger: [] },
  { entry: 'embedFont()', option: 'features', ledger: [] },
  { entry: 'saveIncremental()', option: 'objectStreamThreshold', ledger: [] },
  { entry: 'saveIncrementalWithSignaturePreservation()', option: 'compress', ledger: [] },
  { entry: 'appendIncrementalUpdate()', option: 'compress', ledger: [] },
  { entry: 'code128ToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  { entry: 'code128ToOperators()', option: 'fontSize', ledger: [], hint: DRAW_TEXT },
  { entry: 'code39ToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  {
    entry: 'code39ToOperators()',
    option: 'includeCheckDigit',
    ledger: [],
    hint: 'Pass it to encodeCode39() instead.',
  },
  {
    entry: 'code39ToOperators()',
    option: 'wideToNarrowRatio',
    ledger: [],
    hint: 'Pass it to encodeCode39() instead.',
  },
  { entry: 'itfToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  {
    entry: 'itfToOperators()',
    option: 'wideToNarrowRatio',
    ledger: [],
    hint: 'Pass it to encodeItf() instead.',
  },
  { entry: 'ean13ToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  { entry: 'ean13ToOperators()', option: 'fontSize', ledger: [], hint: DRAW_TEXT },
  { entry: 'ean8ToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  { entry: 'ean8ToOperators()', option: 'fontSize', ledger: [], hint: DRAW_TEXT },
  { entry: 'upcAToOperators()', option: 'showText', ledger: [], hint: DRAW_TEXT },
  { entry: 'upcAToOperators()', option: 'fontSize', ledger: [], hint: DRAW_TEXT },
  {
    entry: 'qrCodeToOperators()',
    option: 'errorCorrection',
    ledger: [],
    hint: 'Pass it to encodeQrCode() instead.',
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'columns',
    ledger: [],
    hint: 'Pass it to encodePdf417() instead.',
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'errorLevel',
    ledger: [],
    hint: 'Pass it to encodePdf417() instead.',
  },
  {
    entry: 'buildPdfX6OutputIntent()',
    option: 'variant',
    ledger: [],
    hint: 'Pass the variant to buildGtsPdfxVersion() instead.',
  },
  {
    entry: 'applyTablePreset()',
    option: 'hasHeader',
    ledger: [],
    hint: 'Use the headerRows table option instead.',
  },
  { entry: 'optimizeAllImages()', option: 'maxDpi', ledger: [] },
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
