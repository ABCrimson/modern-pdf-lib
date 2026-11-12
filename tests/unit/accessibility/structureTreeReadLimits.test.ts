/**
 * Read limits of PdfStructureTree.fromDict: each element is read once, and nesting deeper than
 * 256 levels throws ResourceLimitError.
 */
import { describe, expect, it } from 'vitest';
import { PdfArray, PdfDict, PdfName, PdfNumber, PdfRef } from '../../../src/core/pdfObjects.js';
import type { PdfObject } from '../../../src/core/pdfObjects.js';
import { PdfStructureTree } from '../../../src/accessibility/structureTree.js';
import type { PdfStructureElement } from '../../../src/accessibility/structureTree.js';
import { ResourceLimitError } from '../../../src/errors.js';

function element(...kids: number[]): PdfDict {
  const dict = new PdfDict();
  dict.set('/S', PdfName.of('P'));
  if (kids.length > 0) dict.set('/K', PdfArray.of(kids.map((n) => PdfRef.of(n))));
  return dict;
}

function read(objects: ReadonlyMap<number, PdfObject>): PdfStructureTree {
  const root = new PdfDict();
  root.set('/K', PdfRef.of(1));
  return PdfStructureTree.fromDict(root, (ref) => objects.get(ref.objectNumber));
}

function chain(levels: number, leafKids?: PdfObject): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n <= levels; n++) {
    const dict = n < levels ? element(n + 1) : element();
    if (n === levels && leafKids) dict.set('/K', leafKids);
    objects.set(n, dict);
  }
  return objects;
}

/** Elements whose /K is a reference to an array that holds the next element. */
function arrayChain(levels: number): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n <= levels; n++) {
    const dict = element();
    if (n < levels) {
      dict.set('/K', PdfRef.of(1000 + n));
      objects.set(1000 + n, PdfArray.of([PdfRef.of(n + 1)]));
    }
    objects.set(n, dict);
  }
  return objects;
}

function mcr(mcid: number): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('MCR'));
  dict.set('/MCID', PdfNumber.of(mcid));
  return dict;
}

function depthOf(tree: PdfStructureTree): number {
  let depth = 0;
  let level: readonly PdfStructureElement[] = tree.root.children;
  while (level.length > 0) {
    depth++;
    level = level[0]!.children;
  }
  return depth;
}

describe('structure tree read limits', () => {
  it('reads each structure element once', () => {
    const self = read(new Map([[1, element(1)]]));
    expect(self.root.children).toHaveLength(1);
    expect(self.root.children[0]!.children).toHaveLength(0);

    const mutual = read(
      new Map([
        [1, element(2)],
        [2, element(1)],
      ]),
    );
    expect(mutual.root.children).toHaveLength(1);
    expect(mutual.root.children[0]!.children).toHaveLength(1);
    expect(mutual.root.children[0]!.children[0]!.children).toHaveLength(0);
  });

  it('keeps every element of a loop-free tree', () => {
    const tree = read(
      new Map([
        [1, element(2, 3)],
        [2, element()],
        [3, element(4)],
        [4, element()],
      ]),
    );
    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]!.children).toHaveLength(2);
    expect(tree.root.children[0]!.children[1]!.children).toHaveLength(1);
  });

  it('reads a tree nested 256 levels deep, content in the deepest element included', () => {
    const tree = read(chain(256, PdfNumber.of(0)));
    expect(depthOf(tree)).toBe(256);
    expect(tree.getNextMcid()).toBe(1);
  });

  it('reads a marked content reference in the deepest of 256 levels', () => {
    expect(read(chain(256, mcr(3))).getNextMcid()).toBe(4);
    const objects = chain(256, PdfRef.of(500));
    objects.set(500, mcr(3));
    expect(read(objects).getNextMcid()).toBe(4);
  });

  it('counts an array reached by reference in /K as one level', () => {
    expect(depthOf(read(arrayChain(128)))).toBe(128);
    expect(() => read(arrayChain(129))).toThrow(ResourceLimitError);
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
