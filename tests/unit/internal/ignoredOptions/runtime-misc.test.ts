/**
 * `metadataPlugin` accepts options and does not act on them, so it warns once per option with the code
 * `MPL_IGNORED_OPTION`. Each row checks the first call, the second call, the absent and undefined
 * option, and that the message names no caller value.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { metadataPlugin } from '../../../../src/plugins/builtins/metadataPlugin.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';
import { CODE, TYPE, ignoredOptionMessage as message } from '../../../helpers/ignoredOptions.js';

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
  /** The subject as it appears in the message, with `()` for a function. */
  readonly subject: string;
  readonly option: string;
  /** The value passed to trigger the warning. */
  readonly value: unknown;
  /** Values that change nothing and must not warn. */
  readonly quiet?: readonly unknown[];
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const ROWS: readonly Row[] = [
  ...(['creator', 'defaultTitle', 'defaultAuthor'] as const).map((option): Row => ({
    entry: 'metadataPlugin',
    subject: 'metadataPlugin()',
    option,
    value: 'SECRET-TEXT',
    invoke: (extra) => metadataPlugin(extra),
  })),
];

function ignoredCalls(): unknown[][] {
  return emit.mock.calls.filter(([, options]) => (options as { code?: string }).code === CODE);
}

describe.each(ROWS)('$entry option $option', (row) => {
  it('warns once on the first call and not on the second', async () => {
    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(message(row.subject, row.option), { type: TYPE, code: CODE });

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
    expect(text).toBe(message(row.subject, row.option));
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect(text).not.toContain(String(row.value));
    }
  });
});
