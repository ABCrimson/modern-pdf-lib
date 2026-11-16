/**
 * `buildPdfX6OutputIntent` used to accept the option `variant` and not act on it. 0.41.0 removed it:
 * a caller who still passes it gets an `UnsupportedOptionError`, whose message is fixed text and
 * names no caller value. An absent or undefined option builds the output intent as before.
 */

import { describe, expect, it } from 'vitest';
import { buildPdfX6OutputIntent } from '../../../../src/compliance/pdfx/pdfX6.js';
import { UnsupportedOptionError } from '../../../../src/errors.js';

interface Row {
  readonly entry: string;
  readonly option: string;
  /** The value passed to trigger the refusal. */
  readonly value: unknown;
  /** The message, word for word. */
  readonly message: string;
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const ROWS: readonly Row[] = [
  {
    entry: 'buildPdfX6OutputIntent()',
    option: 'variant',
    value: 'PDF/X-6p',
    message:
      '`buildPdfX6OutputIntent()`: the option `variant` was removed in 0.41.0. Pass the variant to buildGtsPdfxVersion() instead.',
    invoke: (extra) => buildPdfX6OutputIntent({ outputConditionIdentifier: 'Custom', ...extra }),
  },
];

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe.each(ROWS)('$entry option $option', (row) => {
  it('throws UnsupportedOptionError on every call', () => {
    for (let call = 0; call < 2; call++) {
      const error = thrownBy(() => row.invoke({ [row.option]: row.value }));
      expect(error).toBeInstanceOf(UnsupportedOptionError);
      const thrown = error as UnsupportedOptionError;
      expect(thrown.code).toBe('unsupported-option');
      expect(thrown.entry).toBe(row.entry);
      expect(thrown.option).toBe(row.option);
      expect(thrown.plannedFor).toBeUndefined();
    }
  });

  it('does not throw when the option is absent or undefined', () => {
    expect(() => row.invoke({})).not.toThrow();
    expect(() => row.invoke({ [row.option]: undefined })).not.toThrow();
  });

  it('throws for a null option, as 0.40.9 warned for it', () => {
    expect(thrownBy(() => row.invoke({ [row.option]: null }))).toBeInstanceOf(
      UnsupportedOptionError,
    );
  });

  it('names no caller value in the message', () => {
    const error = thrownBy(() => row.invoke({ [row.option]: row.value })) as Error;
    expect(error.message).toBe(row.message);
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect(error.message).not.toContain(String(row.value));
    }
  });
});

describe('results stay the same', () => {
  it('buildPdfX6OutputIntent builds the same keys with an undefined variant as without it', () => {
    const without = buildPdfX6OutputIntent({ outputConditionIdentifier: 'Custom' });
    const undefinedVariant = buildPdfX6OutputIntent({
      outputConditionIdentifier: 'Custom',
      ...({ variant: undefined } as Record<string, unknown>),
    });
    expect([...undefinedVariant].map(([key]) => key)).toEqual([...without].map(([key]) => key));
    expect(undefinedVariant.has('/Variant')).toBe(false);
  });
});
