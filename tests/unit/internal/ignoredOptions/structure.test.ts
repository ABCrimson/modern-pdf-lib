/**
 * Structure elements refuse the options `scope` and `rowSpan` with an `UnsupportedOptionError`
 * that names the release carrying them (0.46.0), because no attribute dictionary is written for
 * them yet. Each row checks the refusal, the absent and undefined option, that the message names no
 * caller value, and that nothing reaches the tree when the call throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  PdfStructureElement,
  PdfStructureTree,
} from '../../../../src/accessibility/structureTree.js';
import {
  tagParagraph,
  tagTableDataCell,
  tagTableHeaderCell,
} from '../../../../src/accessibility/taggingHelpers.js';
import { UnsupportedFeatureError, UnsupportedOptionError } from '../../../../src/errors.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

/** The error `run` throws, or `undefined` when it does not throw. */
function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

interface Row {
  readonly option: string;
  /** The value passed to trigger the refusal. */
  readonly value: unknown;
  readonly invoke: (extra: Record<string, unknown>) => unknown;
}

const element = (extra: Record<string, unknown>): unknown => new PdfStructureElement('TD', extra);
const treeElement = (extra: Record<string, unknown>): unknown =>
  new PdfStructureTree().addElement(null, 'TD', extra);
const child = (extra: Record<string, unknown>): unknown =>
  new PdfStructureElement('Table').addChild('TD', extra);

const ROWS: readonly Row[] = [
  { option: 'scope', value: 'Both', invoke: element },
  { option: 'scope', value: 'Both', invoke: treeElement },
  { option: 'scope', value: 'Both', invoke: child },
  { option: 'rowSpan', value: 4747, invoke: element },
  { option: 'rowSpan', value: 4747, invoke: treeElement },
  { option: 'rowSpan', value: 4747, invoke: child },
];

const messageOf = (option: string): string =>
  `\`new PdfStructureElement()\`: the option \`${option}\` is not supported in this release; it is planned for 0.46.0.`;

describe.each(ROWS)('option $option through $invoke.name', (row) => {
  it('throws an UnsupportedOptionError that names the release', () => {
    const error = thrownBy(() => row.invoke({ [row.option]: row.value }));
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    expect(error).toBeInstanceOf(UnsupportedFeatureError);
    expect(error).toMatchObject({
      code: 'unsupported-option',
      entry: 'new PdfStructureElement()',
      option: row.option,
      plannedFor: '0.46.0',
      message: messageOf(row.option),
    });
  });

  it('does not throw when the option is absent or undefined', () => {
    expect(() => row.invoke({})).not.toThrow();
    expect(() => row.invoke({ [row.option]: undefined })).not.toThrow();
  });

  it('names no caller value in the message', () => {
    const error = thrownBy(() => row.invoke({ [row.option]: row.value })) as Error;
    expect(error.message).not.toContain(String(row.value));
  });

  it('emits no warning', () => {
    thrownBy(() => row.invoke({ [row.option]: row.value }));
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('a refused element does not reach the tree', () => {
  it('addElement leaves the root without a child', () => {
    const tree = new PdfStructureTree();
    thrownBy(() => tree.addElement(null, 'TD', { rowSpan: 2 }));
    expect(tree.root.children).toHaveLength(0);
  });

  it('addChild leaves the parent without a child', () => {
    const parent = new PdfStructureElement('Table');
    thrownBy(() => parent.addChild('TD', { scope: 'Row' }));
    expect(parent.children).toHaveLength(0);
  });
});

describe('results stay the same', () => {
  it('a structure element keeps the options it was given', () => {
    const options = { colSpan: 2, altText: 'cell', language: 'en' };
    const created = new PdfStructureTree().addElement(null, 'TH', options);
    expect(created.options).toEqual(options);
  });
});

describe('tagTableHeaderCell', () => {
  const build = (scope?: 'Row' | 'Column' | 'Both', options?: { rowSpan: number }) => {
    const tree = new PdfStructureTree();
    const table = tree.addElement(null, 'Table');
    const row = tree.addElement(table, 'TR');
    return { row, header: () => tagTableHeaderCell(tree, row, scope, options) };
  };

  it('records the default scope without an error', () => {
    expect(build().header().options.scope).toBe('Column');
    expect(emit).not.toHaveBeenCalled();
  });

  it.each(['Row', 'Column', 'Both'] as const)('refuses the scope %s a caller passes', (scope) => {
    const { row, header } = build(scope);
    const error = thrownBy(header);
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    expect(error).toMatchObject({ option: 'scope', plannedFor: '0.46.0' });
    expect(row.children).toHaveLength(0);
  });

  it('refuses a rowSpan the caller passes, also with the default scope', () => {
    const { row, header } = build(undefined, { rowSpan: 3 });
    const error = thrownBy(header);
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    expect(error).toMatchObject({ option: 'rowSpan', plannedFor: '0.46.0' });
    expect(row.children).toHaveLength(0);
  });
});

describe('tagTableDataCell', () => {
  it('refuses a rowSpan the caller passes', () => {
    const tree = new PdfStructureTree();
    const row = tree.addElement(tree.addElement(null, 'Table'), 'TR');
    const error = thrownBy(() => tagTableDataCell(tree, row, { rowSpan: 3 }));
    expect(error).toBeInstanceOf(UnsupportedOptionError);
    expect(error).toMatchObject({ option: 'rowSpan' });
  });
});

describe('a null or primitive options argument is accepted as it was before the refusals', () => {
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
