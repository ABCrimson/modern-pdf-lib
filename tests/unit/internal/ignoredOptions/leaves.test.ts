/**
 * Barcode operator functions take an already encoded matrix, so options that belong to the
 * encoders (or to text drawing) never applied there. 0.41.0 removed them from the option types
 * and refuses them at run time with an `UnsupportedOptionError` that has no `plannedFor`; the
 * message ends with a fixed hint that names the function to call instead. `applyTablePreset`
 * (src/layout/presets.ts) is the only entry in the layout, render and SVG sources that refuses an
 * option; its row sits at the end. What each renderer writes without the removed options is
 * pinned against the output of the published 0.40.9 package.
 */

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { code128ToOperators, encodeCode128 } from '../../../../src/barcode/linear/code128.js';
import type { Code128Options } from '../../../../src/barcode/linear/code128.js';
import { code39ToOperators, encodeCode39 } from '../../../../src/barcode/linear/code39.js';
import type { Code39Options } from '../../../../src/barcode/linear/code39.js';
import { encodeItf, itfToOperators } from '../../../../src/barcode/linear/itf.js';
import type { ItfOptions } from '../../../../src/barcode/linear/itf.js';
import {
  ean13ToOperators,
  ean8ToOperators,
  encodeEan13,
  encodeEan8,
} from '../../../../src/barcode/linear/ean.js';
import { encodeUpcA, upcAToOperators } from '../../../../src/barcode/linear/upc.js';
import { encodeQrCode, qrCodeToOperators } from '../../../../src/barcode/matrix/qr.js';
import type { QrCodeOptions } from '../../../../src/barcode/matrix/qr.js';
import { encodePdf417, pdf417ToOperators } from '../../../../src/barcode/matrix/pdf417.js';
import type { Pdf417Options } from '../../../../src/barcode/matrix/pdf417.js';
import type { BarcodeOptions } from '../../../../src/barcode/types.js';
import { applyTablePreset } from '../../../../src/layout/presets.js';
import type { PresetOptions } from '../../../../src/layout/presets.js';
import { UnsupportedOptionError } from '../../../../src/errors.js';
import { UNSUPPORTED_OPTIONS } from '../../../../src/internal/options.js';

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The error `call` throws, or a failed expectation when it does not throw. */
function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error('the call did not throw');
}

const DRAW_TEXT = 'Use renderStyledBarcode() to draw the text.';

interface Row {
  /** The entry as the rule table names it, with `()`. */
  readonly entry: string;
  readonly option: string;
  /** The sentence the message ends with. */
  readonly hint: string;
  /** The value passed to trigger the error. */
  readonly value: unknown;
  /** Values that change nothing and must not throw. */
  readonly quiet?: readonly unknown[];
  readonly render: (extra: Record<string, unknown>) => unknown;
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
    entry: 'code128ToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => code128ToOperators(code128, 10, 20, o),
  },
  {
    entry: 'code128ToOperators()',
    option: 'fontSize',
    hint: DRAW_TEXT,
    value: 12.3456,
    render: (o) => code128ToOperators(code128, 10, 20, o),
  },
  {
    entry: 'code39ToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'code39ToOperators()',
    option: 'includeCheckDigit',
    hint: 'Pass it to encodeCode39() instead.',
    value: true,
    quiet: [false],
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'code39ToOperators()',
    option: 'wideToNarrowRatio',
    hint: 'Pass it to encodeCode39() instead.',
    value: 2.5,
    render: (o) => code39ToOperators(code39, 10, 20, o),
  },
  {
    entry: 'itfToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => itfToOperators(itf, 10, 20, o),
  },
  {
    entry: 'itfToOperators()',
    option: 'wideToNarrowRatio',
    hint: 'Pass it to encodeItf() instead.',
    value: 2.5,
    render: (o) => itfToOperators(itf, 10, 20, o),
  },
  {
    entry: 'ean13ToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => ean13ToOperators(ean13, 10, 20, o),
  },
  {
    entry: 'ean13ToOperators()',
    option: 'fontSize',
    hint: DRAW_TEXT,
    value: 12.3456,
    render: (o) => ean13ToOperators(ean13, 10, 20, o),
  },
  {
    entry: 'ean8ToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => ean8ToOperators(ean8, 10, 20, o),
  },
  {
    entry: 'ean8ToOperators()',
    option: 'fontSize',
    hint: DRAW_TEXT,
    value: 12.3456,
    render: (o) => ean8ToOperators(ean8, 10, 20, o),
  },
  {
    entry: 'upcAToOperators()',
    option: 'showText',
    hint: DRAW_TEXT,
    value: true,
    quiet: [false],
    render: (o) => upcAToOperators(upcA, 10, 20, o),
  },
  {
    entry: 'upcAToOperators()',
    option: 'fontSize',
    hint: DRAW_TEXT,
    value: 12.3456,
    render: (o) => upcAToOperators(upcA, 10, 20, o),
  },
  {
    entry: 'qrCodeToOperators()',
    option: 'errorCorrection',
    hint: 'Pass it to encodeQrCode() instead.',
    value: 'H',
    render: (o) => qrCodeToOperators(qr, 10, 20, o),
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'columns',
    hint: 'Pass it to encodePdf417() instead.',
    value: 4242,
    render: (o) => pdf417ToOperators(pdf417, 10, 20, o),
  },
  {
    entry: 'pdf417ToOperators()',
    option: 'errorLevel',
    hint: 'Pass it to encodePdf417() instead.',
    value: 4343,
    render: (o) => pdf417ToOperators(pdf417, 10, 20, o),
  },
  {
    entry: 'applyTablePreset()',
    option: 'hasHeader',
    hint: 'Use the headerRows table option instead.',
    value: false,
    render: (o) => applyTablePreset('striped', o),
  },
];

const message = (row: Row): string =>
  `\`${row.entry}\`: the option \`${row.option}\` was removed in 0.41.0. ${row.hint}`;

describe('the rows of this file are the rows of the option table', () => {
  it('lists every removed option of the barcode renderers and of applyTablePreset', () => {
    const entries = new Set(ROWS.map((row) => row.entry));
    const table = UNSUPPORTED_OPTIONS.filter((rule) => entries.has(rule.entry)).map(
      (rule) => `${rule.entry} ${rule.option} ${rule.hint}`,
    );
    expect(ROWS.map((row) => `${row.entry} ${row.option} ${row.hint}`)).toEqual(table);
    expect(ROWS).toHaveLength(17);
  });
});

describe.each(ROWS)('$entry option $option', (row) => {
  it('throws the error of the removed option, with its hint', () => {
    const error = thrownBy(() => row.render({ [row.option]: row.value }));
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    const refused = error as UnsupportedOptionError;
    expect(refused.code).toBe('unsupported-option');
    expect(refused.entry).toBe(row.entry);
    expect(refused.option).toBe(row.option);
    expect(refused.plannedFor).toBeUndefined();
    expect(refused.message).toBe(message(row));
  });

  it('throws on every call, with no warning', () => {
    for (let i = 0; i < 2; i++) {
      expect(() => row.render({ [row.option]: row.value })).toThrow(UnsupportedOptionError);
    }
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not throw when the option is absent or undefined', () => {
    expect(() => row.render({})).not.toThrow();
    expect(() => row.render({ [row.option]: undefined })).not.toThrow();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not throw for a value that changes nothing', () => {
    for (const quiet of row.quiet ?? []) {
      expect(() => row.render({ [row.option]: quiet })).not.toThrow();
    }
  });

  it('throws for 0 and null when only undefined passes, as the warning of 0.40.9 did', () => {
    if (row.quiet !== undefined) return;
    for (const falsy of [0, null]) {
      expect(() => row.render({ [row.option]: falsy })).toThrow(UnsupportedOptionError);
    }
  });

  it('names no caller value in the message', () => {
    const error = thrownBy(() => row.render({ [row.option]: row.value })) as Error;
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect(error.message).not.toContain(String(row.value));
    }
  });
});

describe('an entry that refuses two options', () => {
  it('names the first in the order of the option table, not the first one passed', () => {
    const error = thrownBy(() =>
      code128ToOperators(code128, 0, 0, {
        fontSize: 9,
        showText: true,
      } as Record<string, unknown>),
    ) as UnsupportedOptionError;
    expect(error.option).toBe('showText');
  });
});

describe('an options argument that is not an object carries no option', () => {
  it.each([5, 'H'])('%j', (value) => {
    expect(() => code128ToOperators(code128, 0, 0, value as never)).not.toThrow();
    expect(() => qrCodeToOperators(qr, 0, 0, value as never)).not.toThrow();
    expect(() => applyTablePreset('striped', value as never)).not.toThrow();
  });

  it('null', () => {
    expect(() => code128ToOperators(code128, 0, 0, null as never)).not.toThrow();
    expect(() => applyTablePreset('striped', null as never)).not.toThrow();
  });
});

describe('the removed options are gone from the types', () => {
  it('Code128Options', () => {
    expectTypeOf<Code128Options>().not.toHaveProperty('showText');
    expectTypeOf<Code128Options>().not.toHaveProperty('fontSize');
  });

  it('Code39Options', () => {
    expectTypeOf<Code39Options>().not.toHaveProperty('showText');
    expectTypeOf<Code39Options>().not.toHaveProperty('includeCheckDigit');
    expectTypeOf<Code39Options>().not.toHaveProperty('wideToNarrowRatio');
  });

  it('ItfOptions', () => {
    expectTypeOf<ItfOptions>().not.toHaveProperty('showText');
    expectTypeOf<ItfOptions>().not.toHaveProperty('wideToNarrowRatio');
  });

  it('BarcodeOptions, which EanOptions and UpcOptions alias', () => {
    expectTypeOf<BarcodeOptions>().not.toHaveProperty('showText');
    expectTypeOf<BarcodeOptions>().not.toHaveProperty('fontSize');
  });

  it('QrCodeOptions and Pdf417Options', () => {
    expectTypeOf<QrCodeOptions>().not.toHaveProperty('errorCorrection');
    expectTypeOf<Pdf417Options>().not.toHaveProperty('columns');
    expectTypeOf<Pdf417Options>().not.toHaveProperty('errorLevel');
  });

  it('PresetOptions', () => {
    expectTypeOf<PresetOptions>().not.toHaveProperty('hasHeader');
  });
});

/**
 * SHA-256 of what the published modern-pdf-lib 0.40.9 returns for the same calls. The encoders
 * keep their arguments (the check digit and the ratio of Code 39, the ratio of ITF, the columns
 * and the error level of PDF417 go to them); the renderers take only the options below.
 */
const RED = { type: 'rgb', r: 1, g: 0, b: 0 } as const;
const WHITE = { type: 'rgb', r: 1, g: 1, b: 1 } as const;
const BARS = { height: 30, moduleWidth: 1.5, quietZone: 4, color: RED } as const;

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const code39Checked = encodeCode39('ABC123', true, 2.5);
const itfWide = encodeItf('12345678', 2);
const qrHigh = encodeQrCode('https://example.com', 'H');
const pdf417Wide = encodePdf417('PDF417 test', { columns: 4, errorLevel: 3 });

const OUTPUT: readonly (readonly [string, () => string, string])[] = [
  [
    'code128 default',
    () => code128ToOperators(code128, 10, 20),
    'a23d099bb0471cb993671af0b620808a80db64b1593f1136fcc3e93f8c00bf07',
  ],
  [
    'code128 options',
    () => code128ToOperators(code128, 10, 20, BARS),
    '72b36f27370ae26e6f9575843ab96630db0442726ae062590555fe45e6165c8f',
  ],
  [
    'code39 default',
    () => code39ToOperators(code39, 10, 20),
    '1ebd3df7af4664858a4271794435af389326a0dd6c2ff9ce128a7a41e8228e6d',
  ],
  [
    'code39 options',
    () => code39ToOperators(code39, 10, 20, BARS),
    '3526d6765593d6067d896865bfd18351441173211b6b45fc36be1a7c3d714f18',
  ],
  [
    'code39 check digit and ratio at the encoder',
    () => code39ToOperators(code39Checked, 10, 20),
    'b46898a875668ed63d0c9c92d8c7cd1691211258792d475baff1648e300cface',
  ],
  [
    'itf default',
    () => itfToOperators(itf, 10, 20),
    '44864f6fa2f707d411b474600a2d28e5adcae02851e7f7d8d2db6374571c2495',
  ],
  [
    'itf options',
    () => itfToOperators(itf, 10, 20, { ...BARS, bearerBars: true, bearerBarWidth: 3 }),
    '813db9af0503cc8d7a08e69a2c2b622a39ab2c99e5ced5393f952ee7cc5d9ca5',
  ],
  [
    'itf ratio at the encoder',
    () => itfToOperators(itfWide, 10, 20),
    'e8b15964ab1f179721941a2e1c7c3e908fe3429901c8af620f5567032868b097',
  ],
  [
    'ean13 default',
    () => ean13ToOperators(ean13, 10, 20),
    'd7f1a7aada0d9c15393099d345244672aa5dca04bb0b76beea5f631ae77cb061',
  ],
  [
    'ean13 options',
    () => ean13ToOperators(ean13, 10, 20, BARS),
    '7b34c7a8dae492a64ae28b19b1896ded4e08fad311c290f94c831c03c1cadc87',
  ],
  [
    'ean8 default',
    () => ean8ToOperators(ean8, 10, 20),
    'fcf738d646520b1ce4b66b1025287efaeb56e5c0dc25e11ff9602cc7b282f5be',
  ],
  [
    'ean8 options',
    () => ean8ToOperators(ean8, 10, 20, BARS),
    'ce876afaab78fabdc181052f5d608467feca1050d34d07be81576b30b2874cb7',
  ],
  [
    'upcA default',
    () => upcAToOperators(upcA, 10, 20),
    'bbb161e0ed5bd8ebd5067fefc473cc882101822dde0ea583346753109edcb284',
  ],
  [
    'upcA options',
    () => upcAToOperators(upcA, 10, 20, BARS),
    '669f3b39bcbbe832cc5022ccac322052c376db3acf48377802d64d7fa0e0d582',
  ],
  [
    'qr default',
    () => qrCodeToOperators(qrHigh, 10, 20),
    '8a8ba1f03078186d77c96ddb7fbf6bd5f79293e69608e68eb78cc0389fa0dc50',
  ],
  [
    'qr options',
    () =>
      qrCodeToOperators(qrHigh, 10, 20, {
        moduleSize: 3,
        quietZone: 2,
        color: RED,
        backgroundColor: WHITE,
      }),
    'cb431f9f247df352497c0489d3f078b0e319780e01a5eb8037c6d09934060404',
  ],
  [
    'pdf417 default',
    () => pdf417ToOperators(pdf417Wide, 10, 20),
    'd50281e8de8fd178b136522aaa5bc9f10ee12d7b1a11c825c0dc1b84216f5f9a',
  ],
  [
    'pdf417 options',
    () =>
      pdf417ToOperators(pdf417Wide, 10, 20, {
        rowHeight: 6,
        moduleWidth: 2,
        quietZone: 3,
        color: RED,
      }),
    '15c7da22c857547adc49760ee963300fb2f03e5ed5f8288e313a55c0d97ef838',
  ],
  [
    'preset minimal',
    () => JSON.stringify(applyTablePreset('minimal')),
    '2f4a3592b17a995ec4dcc200fb7d049169c69e7155d64e98fdcc8914c481c283',
  ],
  [
    'preset striped',
    () => JSON.stringify(applyTablePreset('striped', { fontSize: 9, primaryColor: RED })),
    '98acf5193713af938791b7670173896c88ae8e11037604fbb2d186c5c3078502',
  ],
  [
    'preset bordered',
    () => JSON.stringify(applyTablePreset('bordered', { fontSize: 9, primaryColor: RED })),
    '5bd8a77b384d9195f297faf867cd8b4c19e3f55b72dad0463a7e42174e5faf35',
  ],
  [
    'preset professional',
    () => JSON.stringify(applyTablePreset('professional', { fontSize: 9, primaryColor: RED })),
    '4f5887feb52ae6e28c4de7bca2f3fcd62d141463fef411ebe6ec2b9964d2db86',
  ],
];

describe('output without the removed options equals the output of 0.40.9', () => {
  it.each(OUTPUT)('%s', (_id, run, hash) => {
    expect(sha256(run())).toBe(hash);
  });
});
