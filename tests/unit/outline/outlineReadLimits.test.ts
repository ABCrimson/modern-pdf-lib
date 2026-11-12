/**
 * Read limits of PdfOutlineTree.fromDict: each item is read once, and nesting deeper than 256
 * levels throws ResourceLimitError.
 */
import { describe, expect, it } from 'vitest';
import { PdfDict, PdfRef, PdfString } from '../../../src/core/pdfObjects.js';
import type { PdfObject } from '../../../src/core/pdfObjects.js';
import { PdfOutlineTree } from '../../../src/outline/pdfOutline.js';
import type { PdfOutlineItem } from '../../../src/outline/pdfOutline.js';
import { ResourceLimitError } from '../../../src/errors.js';

function item(first?: number, next?: number): PdfDict {
  const dict = new PdfDict();
  dict.set('/Title', PdfString.literal('item'));
  if (first !== undefined) dict.set('/First', PdfRef.of(first));
  if (next !== undefined) dict.set('/Next', PdfRef.of(next));
  return dict;
}

function read(objects: ReadonlyMap<number, PdfObject>): PdfOutlineTree {
  const root = new PdfDict();
  root.set('/First', PdfRef.of(1));
  return PdfOutlineTree.fromDict(root, (ref) => objects.get(ref.objectNumber), new Map());
}

function chain(levels: number): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n <= levels; n++) objects.set(n, item(n < levels ? n + 1 : undefined));
  return objects;
}

describe('outline read limits', () => {
  it('reads each outline item once', () => {
    const next = read(
      new Map([
        [1, item(undefined, 2)],
        [2, item(undefined, 1)],
      ]),
    );
    expect(next.items).toHaveLength(2);

    const first = read(new Map([[1, item(1)]]));
    expect(first.items).toHaveLength(1);
    expect(first.items[0]!.children).toHaveLength(0);
  });

  it('does not read an item twice when a child list names a sibling of its parent', () => {
    // 1 -> children 2 -> 3, and 3 names 1 as its next sibling: 1 is already read.
    const tree = read(
      new Map([
        [1, item(2)],
        [2, item(undefined, 3)],
        [3, item(undefined, 1)],
      ]),
    );
    expect(tree.items).toHaveLength(1);
    expect(tree.items[0]?.children).toHaveLength(2);
  });

  it('keeps every item of a loop-free outline', () => {
    const tree = read(
      new Map([
        [1, item(3, 2)],
        [2, item(undefined, undefined)],
        [3, item(undefined, 4)],
        [4, item()],
      ]),
    );
    expect(tree.items).toHaveLength(2);
    expect(tree.items[0]?.children).toHaveLength(2);
  });

  it('reads an outline nested 256 levels deep', () => {
    let depth = 0;
    let level: readonly PdfOutlineItem[] = read(chain(256)).items;
    while (level.length > 0) {
      depth++;
      level = level[0]!.children;
    }
    expect(depth).toBe(256);
  });

  it('reads 256 levels when the deepest item names a /First that cannot be read', () => {
    const count = (objects: Map<number, PdfObject>): number => {
      let depth = 0;
      let level: readonly PdfOutlineItem[] = read(objects).items;
      while (level.length > 0) {
        depth++;
        level = level[0]!.children;
      }
      return depth;
    };
    const missing = chain(256);
    missing.set(256, item(999));
    expect(count(missing)).toBe(256);

    const notDict = chain(256);
    notDict.set(256, item(998));
    notDict.set(998, PdfString.literal('not an item'));
    expect(count(notDict)).toBe(256);

    const loop = chain(256);
    loop.set(256, item(1));
    expect(count(loop)).toBe(256);
  });

  it('throws ResourceLimitError above the tree depth limit', () => {
    let error: unknown;
    try {
      read(chain(257));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ResourceLimitError);
    expect(error).toMatchObject({ limit: 'maxTreeDepth', max: 256, actual: 257 });
  });
});

describe('outline wide levels', () => {
  const WIDE = 200_000;

  it('reads 200,000 top-level siblings in full', () => {
    const objects = new Map<number, PdfObject>();
    for (let n = 1; n <= WIDE; n++) objects.set(n, item(undefined, n < WIDE ? n + 1 : undefined));
    expect(read(objects).items).toHaveLength(WIDE);
  });

  it('reads 200,000 children of one parent in full', () => {
    const objects = new Map<number, PdfObject>();
    objects.set(1, item(2));
    for (let n = 2; n <= WIDE + 1; n++) {
      objects.set(n, item(undefined, n < WIDE + 1 ? n + 1 : undefined));
    }
    const tree = read(objects);
    expect(tree.items).toHaveLength(1);
    expect(tree.items[0]?.children).toHaveLength(WIDE);
  });
});
