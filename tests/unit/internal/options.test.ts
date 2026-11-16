/**
 * The option rule table (src/internal/options.ts): one row per option or call that 0.41.0 refuses
 * with an UnsupportedOptionError instead of ignoring it. The table is not wired into the call
 * sites yet, so this file pins it completely: every row, the fixed message of every row, the
 * error `rejectOption` throws, and the tie of each planned release to the open target of its
 * ledger ids in audit/open-highs.json (T-LEDGER).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedOptionError } from '../../../src/errors.js';
import type { PdfLibVersion } from '../../../src/errors.js';
import { UNSUPPORTED_OPTIONS, rejectOption } from '../../../src/internal/options.js';
import type { UnsupportedOptionRule } from '../../../src/internal/options.js';
import { resetWarningsForTesting, WARNING_TYPE, warnOnce } from '../../../src/internal/warnings.js';

/** One expected row: the rule's fields and the exact message of the error it throws. */
interface ExpectedRule {
  readonly rule: UnsupportedOptionRule;
  readonly message: string;
}

/** A row whose option is carried out by a later release named by `ledger`. */
function planned(
  entry: string,
  option: string | undefined,
  plannedFor: PdfLibVersion,
  ledger: readonly string[],
  message: string,
): ExpectedRule {
  return {
    rule:
      option === undefined ? { entry, plannedFor, ledger } : { entry, option, plannedFor, ledger },
    message,
  };
}

/** A row whose option was removed in 0.41.0; `hint` is the fixed sentence the message ends with. */
function removed(
  entry: string,
  option: string,
  hint: string | undefined,
  message: string,
): ExpectedRule {
  return {
    rule: hint === undefined ? { entry, option, ledger: [] } : { entry, option, ledger: [], hint },
    message,
  };
}

const SHOW_TEXT_HINT = 'Use renderStyledBarcode() to draw the text.';

/** Section "the option rule table", row by row, in the order of the table. */
const EXPECTED: readonly ExpectedRule[] = [
  planned(
    'signPdf()',
    'timestampUrl',
    '0.45.0',
    ['signature-cms-08', 'docs-guide-2-23'],
    '`signPdf()`: the option `timestampUrl` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'setCertificationLevel()',
    undefined,
    '0.45.0',
    ['signature-pki-09', 'docs-guide-2-23'],
    '`setCertificationLevel()` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'addFieldLock()',
    undefined,
    '0.45.0',
    ['signature-pki-10', 'docs-guide-2-23'],
    '`addFieldLock()` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'verifySignatureDetailed()',
    'timeout',
    '0.45.0',
    ['signature-cms-05'],
    '`verifySignatureDetailed()`: the option `timeout` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'verifySignatureDetailed()',
    'trustedCerts',
    '0.45.0',
    ['signature-cms-05'],
    '`verifySignatureDetailed()`: the option `trustedCerts` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'validateCertificateChain()',
    'checkRevocation',
    '0.45.0',
    ['signature-pki-02'],
    '`validateCertificateChain()`: the option `checkRevocation` is not supported in this release; it is planned for 0.45.0.',
  ),
  planned(
    'saveAsStream()',
    'objectStreamThreshold',
    '0.41.2',
    ['oracle-gates-R02', 'docs-guide-3-27'],
    '`saveAsStream()`: the option `objectStreamThreshold` is not supported in this release; it is planned for 0.41.2.',
  ),
  planned(
    'new PdfStructureElement()',
    'scope',
    '0.46.0',
    ['accessibility-metadata-04'],
    '`new PdfStructureElement()`: the option `scope` is not supported in this release; it is planned for 0.46.0.',
  ),
  planned(
    'new PdfStructureElement()',
    'rowSpan',
    '0.46.0',
    ['accessibility-metadata-04'],
    '`new PdfStructureElement()`: the option `rowSpan` is not supported in this release; it is planned for 0.46.0.',
  ),
  removed(
    'new StreamingPdfParser()',
    'parseContentStreams',
    undefined,
    '`new StreamingPdfParser()`: the option `parseContentStreams` was removed in 0.41.0.',
  ),
  removed(
    'embedFont()',
    'features',
    undefined,
    '`embedFont()`: the option `features` was removed in 0.41.0.',
  ),
  removed(
    'saveIncremental()',
    'objectStreamThreshold',
    'Pass it to save() instead.',
    '`saveIncremental()`: the option `objectStreamThreshold` was removed in 0.41.0. Pass it to save() instead.',
  ),
  removed(
    'saveIncrementalWithSignaturePreservation()',
    'compress',
    undefined,
    '`saveIncrementalWithSignaturePreservation()`: the option `compress` was removed in 0.41.0.',
  ),
  removed(
    'appendIncrementalUpdate()',
    'compress',
    undefined,
    '`appendIncrementalUpdate()`: the option `compress` was removed in 0.41.0.',
  ),
  removed(
    'code128ToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`code128ToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'code128ToOperators()',
    'fontSize',
    SHOW_TEXT_HINT,
    '`code128ToOperators()`: the option `fontSize` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'code39ToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`code39ToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'code39ToOperators()',
    'includeCheckDigit',
    'Pass it to encodeCode39() instead.',
    '`code39ToOperators()`: the option `includeCheckDigit` was removed in 0.41.0. Pass it to encodeCode39() instead.',
  ),
  removed(
    'code39ToOperators()',
    'wideToNarrowRatio',
    'Pass it to encodeCode39() instead.',
    '`code39ToOperators()`: the option `wideToNarrowRatio` was removed in 0.41.0. Pass it to encodeCode39() instead.',
  ),
  removed(
    'itfToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`itfToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'itfToOperators()',
    'wideToNarrowRatio',
    'Pass it to encodeItf() instead.',
    '`itfToOperators()`: the option `wideToNarrowRatio` was removed in 0.41.0. Pass it to encodeItf() instead.',
  ),
  removed(
    'ean13ToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`ean13ToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'ean13ToOperators()',
    'fontSize',
    SHOW_TEXT_HINT,
    '`ean13ToOperators()`: the option `fontSize` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'ean8ToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`ean8ToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'ean8ToOperators()',
    'fontSize',
    SHOW_TEXT_HINT,
    '`ean8ToOperators()`: the option `fontSize` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'upcAToOperators()',
    'showText',
    SHOW_TEXT_HINT,
    '`upcAToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'upcAToOperators()',
    'fontSize',
    SHOW_TEXT_HINT,
    '`upcAToOperators()`: the option `fontSize` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
  ),
  removed(
    'qrCodeToOperators()',
    'errorCorrection',
    'Pass it to encodeQrCode() instead.',
    '`qrCodeToOperators()`: the option `errorCorrection` was removed in 0.41.0. Pass it to encodeQrCode() instead.',
  ),
  removed(
    'pdf417ToOperators()',
    'columns',
    'Pass it to encodePdf417() instead.',
    '`pdf417ToOperators()`: the option `columns` was removed in 0.41.0. Pass it to encodePdf417() instead.',
  ),
  removed(
    'pdf417ToOperators()',
    'errorLevel',
    'Pass it to encodePdf417() instead.',
    '`pdf417ToOperators()`: the option `errorLevel` was removed in 0.41.0. Pass it to encodePdf417() instead.',
  ),
  removed(
    'buildPdfX6OutputIntent()',
    'variant',
    'Pass the variant to buildGtsPdfxVersion() instead.',
    '`buildPdfX6OutputIntent()`: the option `variant` was removed in 0.41.0. Pass the variant to buildGtsPdfxVersion() instead.',
  ),
  removed(
    'applyTablePreset()',
    'hasHeader',
    'Use the headerRows table option instead.',
    '`applyTablePreset()`: the option `hasHeader` was removed in 0.41.0. Use the headerRows table option instead.',
  ),
  removed(
    'optimizeAllImages()',
    'maxDpi',
    undefined,
    '`optimizeAllImages()`: the option `maxDpi` was removed in 0.41.0.',
  ),
];

/** The thrown value of `fn`; fails the test when `fn` returns. */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to throw');
}

describe('UNSUPPORTED_OPTIONS', () => {
  it('equals the table row by row, in order', () => {
    expect(UNSUPPORTED_OPTIONS).toEqual(EXPECTED.map((row) => row.rule));
  });

  it('holds 9 rows that name a release and 24 that were removed', () => {
    expect(UNSUPPORTED_OPTIONS).toHaveLength(33);
    expect(UNSUPPORTED_OPTIONS.filter((rule) => rule.plannedFor !== undefined)).toHaveLength(9);
    expect(UNSUPPORTED_OPTIONS.filter((rule) => rule.plannedFor === undefined)).toHaveLength(24);
  });

  it('has one row per entry and option', () => {
    const keys = UNSUPPORTED_OPTIONS.map((rule) => `${rule.entry} ${rule.option ?? '(call)'}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives a hint only to a removed option, and a whole-call row only a release', () => {
    for (const rule of UNSUPPORTED_OPTIONS) {
      if (rule.hint !== undefined) expect(rule.plannedFor, rule.entry).toBeUndefined();
      if (rule.option === undefined) expect(rule.plannedFor, rule.entry).toBeDefined();
    }
  });
});

describe('rejectOption', () => {
  it.each(EXPECTED.map((row) => [row.message, row] as const))('throws %s', (_message, row) => {
    const err = thrownBy(() => rejectOption(row.rule));
    expect(err).toBeInstanceOf(UnsupportedOptionError);
    const thrown = err as UnsupportedOptionError;
    expect(thrown.message).toBe(row.message);
    expect(thrown.code).toBe('unsupported-option');
    expect(thrown.entry).toBe(row.rule.entry);
    expect(thrown.option).toBe(row.rule.option);
    expect(thrown.plannedFor).toBe(row.rule.plannedFor);
  });

  it('builds every message from the row, never from caller data', () => {
    for (const rule of UNSUPPORTED_OPTIONS) {
      const err = thrownBy(() => rejectOption(rule)) as UnsupportedOptionError;
      expect(err.message.startsWith(`\`${rule.entry}\``), rule.entry).toBe(true);
      expect(err.message.endsWith('.'), rule.entry).toBe(true);
    }
  });
});

/** The open ids of audit/open-highs.json with their target release. */
function openTargets(): ReadonlyMap<string, string> {
  const ledger = JSON.parse(
    readFileSync(new URL('../../../audit/open-highs.json', import.meta.url), 'utf8'),
  ) as { readonly open: readonly { readonly id: string; readonly target: string }[] };
  return new Map(ledger.open.map((entry) => [entry.id, entry.target]));
}

/** Release numbers compared as numbers, so 0.41.10 sorts after 0.41.2. */
function versionNumbers(version: string): readonly number[] {
  return version.split('.').map(Number);
}

function isLater(version: string, than: string): boolean {
  const a = versionNumbers(version);
  const b = versionNumbers(than);
  for (const [i, part] of a.entries()) {
    if (part !== b[i]) return part > (b[i] ?? 0);
  }
  return false;
}

describe('T-LEDGER: planned releases against the ledger', () => {
  const open = openTargets();

  it('ties every planned release to the open target of each of its ledger ids', () => {
    for (const rule of UNSUPPORTED_OPTIONS) {
      if (rule.plannedFor === undefined) continue;
      const label = `${rule.entry} ${rule.option ?? '(call)'}`;
      expect(rule.ledger.length, label).toBeGreaterThan(0);
      for (const id of rule.ledger) {
        expect(open.has(id), `${label}: ${id} is open`).toBe(true);
        expect(open.get(id), `${label}: target of ${id}`).toBe(rule.plannedFor);
      }
    }
  });

  it('lets a removed option name no id that is still open for a later release', () => {
    for (const rule of UNSUPPORTED_OPTIONS) {
      if (rule.plannedFor !== undefined) continue;
      for (const id of rule.ledger) {
        const target = open.get(id);
        const label = `${rule.entry} ${rule.option ?? '(call)'}: ${id}`;
        expect(target === undefined || !isLater(target, '0.41.0'), label).toBe(true);
      }
    }
  });

  it('orders release numbers as numbers', () => {
    expect(isLater('0.41.10', '0.41.2')).toBe(true);
    expect(isLater('0.41.0', '0.41.0')).toBe(false);
    expect(isLater('0.40.9', '0.41.0')).toBe(false);
  });
});

describe('the OCR warning code', () => {
  beforeEach(() => {
    resetWarningsForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWarningsForTesting();
  });

  it('is a code warnOnce emits with the library warning type', () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    expect(warnOnce('ocr-unencodable', 'MPL_OCR_UNENCODABLE', 'm')).toBe(true);
    expect(warnOnce('ocr-unencodable', 'MPL_OCR_UNENCODABLE', 'm')).toBe(false);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('m', { type: WARNING_TYPE, code: 'MPL_OCR_UNENCODABLE' });
  });
});
