/**
 * Barcode operator functions take an already encoded matrix, so options that belong to the
 * encoders (or to text drawing) have no effect there. Each (entry, option) pair warns once with
 * the code `MPL_IGNORED_OPTION`, and the operators stay identical with and without the option.
 * `applyTablePreset` (src/layout/presets.ts) is the only entry in the layout, render and SVG sources
 * that ignores an option; its row sits at the end.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { code128ToOperators, encodeCode128 } from '../../../../src/barcode/linear/code128.js';
import { code39ToOperators, encodeCode39 } from '../../../../src/barcode/linear/code39.js';
import { encodeItf, itfToOperators } from '../../../../src/barcode/linear/itf.js';
import {
  ean13ToOperators,
  ean8ToOperators,
  encodeEan13,
  encodeEan8,
} from '../../../../src/barcode/linear/ean.js';
import { encodeUpcA, upcAToOperators } from '../../../../src/barcode/linear/upc.js';
import { encodeQrCode, qrCodeToOperators } from '../../../../src/barcode/matrix/qr.js';
import { encodePdf417, pdf417ToOperators } from '../../../../src/barcode/matrix/pdf417.js';
import { applyTablePreset } from '../../../../src/layout/presets.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';
import { CODE, TYPE, ignoredOptionMessage } from '../../../helpers/ignoredOptions.js';

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

interface Row {
  readonly entry: string;
  readonly option: string;
  /** The value passed to trigger the warning. */
  readonly value: unknown;
  /** Values that change nothing and must not warn. */
  readonly quiet?: readonly unknown[];
  readonly render: (extra: Record<string, unknown>) => string;
}

const code128 = encodeCode128('ABC-123');
const code39 = encodeCode39('ABC123');
const itf = encodeItf('12345678');
const ean13 = encodeEan13('590123412345');
const ean8 = encodeEan8('1234567');
const upcA = encodeUpcA('01234567890');
const qr = encodeQrCode('https://example.com');
const pdf417 = encodePdf417('PDF417 test');

const ROWS: readonly Row[] = [
  {
    entry: 'code128ToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => code128ToOperators(code128, 10, 20, o),
  },
  {
    entry: 'code128ToOperators',
    option: 'fontSize',
    value: 12.3456,
    render: (o) => code128ToOperators(code128, 10, 20, o),
  },
  {
    entry: 'code39ToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'code39ToOperators',
    option: 'includeCheckDigit',
    value: true,
    quiet: [false],
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'code39ToOperators',
    option: 'wideToNarrowRatio',
    value: 2.5,
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'itfToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => itfToOperators(itf, 10, 20, o),
  },
  {
    entry: 'itfToOperators',
    option: 'wideToNarrowRatio',
    value: 2.5,
    render: (o) => itfToOperators(itf, 10, 20, o),
  },
  {
    entry: 'ean13ToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => ean13ToOperators(ean13, 10, 20, o),
  },
  {
    entry: 'ean13ToOperators',
    option: 'fontSize',
    value: 12.3456,
    render: (o) => ean13ToOperators(ean13, 10, 20, o),
  },
  {
    entry: 'ean8ToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => ean8ToOperators(ean8, 10, 20, o),
  },
  {
    entry: 'ean8ToOperators',
    option: 'fontSize',
    value: 12.3456,
    render: (o) => ean8ToOperators(ean8, 10, 20, o),
  },
  {
    entry: 'upcAToOperators',
    option: 'showText',
    value: true,
    quiet: [false],
    render: (o) => upcAToOperators(upcA, 10, 20, o),
  },
  {
    entry: 'upcAToOperators',
    option: 'fontSize',
    value: 12.3456,
    render: (o) => upcAToOperators(upcA, 10, 20, o),
  },
  {
    entry: 'qrCodeToOperators',
    option: 'errorCorrection',
    value: 'H',
    render: (o) => qrCodeToOperators(qr, 10, 20, o),
  },
  {
    entry: 'pdf417ToOperators',
    option: 'columns',
    value: 4242,
    render: (o) => pdf417ToOperators(pdf417, 10, 20, o),
  },
  {
    entry: 'pdf417ToOperators',
    option: 'errorLevel',
    value: 4343,
    render: (o) => pdf417ToOperators(pdf417, 10, 20, o),
  },
];

const message = (entry: string, option: string): string =>
  ignoredOptionMessage(`${entry}()`, option);

function ignoredCalls(): unknown[][] {
  return emit.mock.calls.filter(([, options]) => (options as { code?: string }).code === CODE);
}

describe.each(ROWS)('$entry option $option', (row) => {
  it('warns once on the first call and not on the second', () => {
    row.render({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(message(row.entry, row.option), { type: TYPE, code: CODE });

    row.render({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
  });

  it('does not warn when the option is absent or undefined', () => {
    row.render({});
    row.render({ [row.option]: undefined });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('does not warn for a value that changes nothing', () => {
    for (const quiet of row.quiet ?? []) row.render({ [row.option]: quiet });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('names no caller value and leaves the operators identical', () => {
    const without = row.render({});
    const withOption = row.render({ [row.option]: row.value });
    expect(withOption).toBe(without);
    const [text] = ignoredCalls()[0] as [string];
    expect(text).toBe(message(row.entry, row.option));
    expect(text).not.toContain(String(row.value));
  });
});

describe('a loop over one entry warns once', () => {
  it('code128ToOperators with showText and fontSize', () => {
    for (let i = 0; i < 5; i++) code128ToOperators(code128, i, 0, { showText: true, fontSize: 9 });
    expect(ignoredCalls()).toHaveLength(2);
  });
});

interface PresetRow {
  readonly entry: string;
  /** The subject as it appears in the message, with `()` for a function. */
  readonly subject: string;
  readonly option: string;
  /** The value passed to trigger the warning. */
  readonly value: unknown;
  /** Values that change nothing and must not warn. */
  readonly quiet?: readonly unknown[];
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const PRESET_ROWS: readonly PresetRow[] = [
  {
    entry: 'applyTablePreset',
    subject: 'applyTablePreset()',
    option: 'hasHeader',
    value: false,
    invoke: (extra) => applyTablePreset('striped', extra),
  },
];

describe.each(PRESET_ROWS)('$entry option $option', (row) => {
  it('warns once on the first call and not on the second', async () => {
    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(ignoredOptionMessage(row.subject, row.option), {
      type: TYPE,
      code: CODE,
    });

    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
  });

  it('does not warn when the option is absent or undefined', async () => {
    await row.invoke({});
    await row.invoke({ [row.option]: undefined });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('does not warn for a value that changes nothing', async () => {
    for (const quiet of row.quiet ?? []) await row.invoke({ [row.option]: quiet });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('names no caller value in the message', async () => {
    await row.invoke({ [row.option]: row.value });
    const [text] = ignoredCalls()[0] as [string];
    expect(text).toBe(ignoredOptionMessage(row.subject, row.option));
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect(text).not.toContain(String(row.value));
    }
  });
});

describe('results stay the same', () => {
  it('applyTablePreset returns the same preset with and without hasHeader', () => {
    expect(applyTablePreset('bordered', { hasHeader: false })).toEqual(
      applyTablePreset('bordered'),
    );
  });
});
