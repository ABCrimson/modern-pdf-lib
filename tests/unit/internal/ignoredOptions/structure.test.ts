/**
 * Structure elements accept options (`scope`, `rowSpan`) and do not act on them, so they warn once
 * per option with the code `MPL_IGNORED_OPTION`. Each row checks the first call, the second call,
 * the absent and undefined option, and that the message names no caller value.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { PdfStructureTree } from '../../../../src/accessibility/structureTree.js';
import {
  tagParagraph,
  tagTableDataCell,
  tagTableHeaderCell,
} from '../../../../src/accessibility/taggingHelpers.js';
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

const structure = (extra: Record<string, unknown>): unknown =>
  new PdfStructureTree().addElement(null, 'TD', extra);

const ROWS: readonly Row[] = [
  {
    entry: 'PdfStructureElement',
    subject: 'PdfStructureElement',
    option: 'scope',
    value: 'Both',
    invoke: structure,
  },
  {
    entry: 'PdfStructureElement',
    subject: 'PdfStructureElement',
    option: 'rowSpan',
    value: 4747,
    invoke: structure,
  },
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

describe('results stay the same', () => {
  it('a structure element keeps the options it was given', () => {
    const element = new PdfStructureTree().addElement(null, 'TH', { scope: 'Row', rowSpan: 2 });
    expect(element.options).toEqual({ scope: 'Row', rowSpan: 2 });
  });
});

describe('tagTableHeaderCell', () => {
  const build = (scope?: 'Row' | 'Column' | 'Both', options?: { rowSpan: number }) => {
    const tree = new PdfStructureTree();
    const table = tree.addElement(null, 'Table');
    const row = tree.addElement(table, 'TR');
    return tagTableHeaderCell(tree, row, scope, options);
  };

  it('records the default scope without a warning', () => {
    expect(build().options.scope).toBe('Column');
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('warns for a scope the caller passes', () => {
    expect(build('Row').options.scope).toBe('Row');
    expect(ignoredCalls()).toHaveLength(1);
  });

  it('warns for a rowSpan the caller passes, and keeps the default scope', () => {
    const header = build(undefined, { rowSpan: 3 });
    expect(header.options).toEqual({ rowSpan: 3, scope: 'Column' });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(message('PdfStructureElement', 'rowSpan'), {
      type: TYPE,
      code: CODE,
    });
  });
});

describe('a null or primitive options argument is accepted as it was before the warnings', () => {
  const NON_OBJECTS: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
  ];

  it.each(NON_OBJECTS)('PdfStructureElement takes options %s', (_label, value) => {
    expect(new PdfStructureTree().addElement(null, 'P', value as never).options).toEqual({});
    expect(
      new PdfStructureTree().addElement(null, 'P').addChild('Span', value as never).options,
    ).toEqual({});
    expect(emit).not.toHaveBeenCalled();
  });

  it.each(NON_OBJECTS)('tag helpers take options %s', (_label, value) => {
    const tree = new PdfStructureTree();
    const table = tree.addElement(null, 'Table');
    const row = tree.addElement(table, 'TR');
    expect(tagParagraph(tree, null, value as never).options).toEqual({});
    expect(tagTableDataCell(tree, row, value as never).options).toEqual({});
    expect(tagTableHeaderCell(tree, row, undefined, value as never).options).toEqual({
      scope: 'Column',
    });
  });
});
