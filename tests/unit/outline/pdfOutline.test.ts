/**
 * Tests for the PDF outline (bookmark) tree model.
 *
 * Covers:
 * - PdfOutlineItem creation and child management
 * - PdfOutlineTree building and manipulation
 * - Serialization to PDF dictionaries (toDict)
 * - Parsing from PDF dictionaries (fromDict)
 * - All fit modes (Fit, FitH, FitV, FitB, FitBH, FitBV, XYZ)
 * - Color and style flags
 * - Open/closed state and /Count values
 * - Named destinations
 * - Edge cases and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  PdfOutlineItem,
  PdfOutlineTree,
} from '../../../src/outline/pdfOutline.js';
import type { OutlineDestination } from '../../../src/outline/pdfOutline.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfRef,
  PdfNull,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';
import type { ByteWriter, PdfObject } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ByteWriter for serialization tests. */
class StringWriter implements ByteWriter {
  private parts: string[] = [];

  write(data: Uint8Array): void {
    let s = '';
    for (const b of data) {
      s += String.fromCharCode(b);
    }
    this.parts.push(s);
  }

  writeString(str: string): void {
    this.parts.push(str);
  }

  toString(): string {
    return this.parts.join('');
  }
}

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  const w = new StringWriter();
  obj.serialize(w);
  return w.toString();
}

/** Create mock page refs. */
function createPageRefs(count: number): PdfRef[] {
  const refs: PdfRef[] = [];
  for (let i = 0; i < count; i++) {
    refs.push(PdfRef.of(100 + i));
  }
  return refs;
}

// ---------------------------------------------------------------------------
// PdfOutlineItem tests
// ---------------------------------------------------------------------------

describe('PdfOutlineItem', () => {
  it('creates an item with default options', () => {
    const dest: OutlineDestination = { type: 'page', pageIndex: 0, fit: 'Fit' };
    const item = new PdfOutlineItem('Chapter 1', dest);

    expect(item.title).toBe('Chapter 1');
    expect(item.destination).toEqual(dest);
    expect(item.children).toEqual([]);
    expect(item.isOpen).toBe(true);
    expect(item.color).toBeUndefined();
    expect(item.bold).toBeUndefined();
    expect(item.italic).toBeUndefined();
  });

  it('creates an item with all options', () => {
    const dest: OutlineDestination = { type: 'page', pageIndex: 2, fit: 'XYZ', left: 0, top: 800, zoom: 1.5 };
    const item = new PdfOutlineItem('Styled Item', dest, {
      isOpen: false,
      color: { r: 1, g: 0, b: 0 },
      bold: true,
      italic: true,
    });

    expect(item.isOpen).toBe(false);
    expect(item.color).toEqual({ r: 1, g: 0, b: 0 });
    expect(item.bold).toBe(true);
    expect(item.italic).toBe(true);
  });

  it('adds and removes children', () => {
    const parent = new PdfOutlineItem('Parent', { type: 'page', pageIndex: 0 });
    const child1 = parent.addChild('Child 1', { type: 'page', pageIndex: 1 });
    const child2 = parent.addChild('Child 2', { type: 'page', pageIndex: 2 });

    expect(parent.children).toHaveLength(2);
    expect(parent.children[0]).toBe(child1);
    expect(parent.children[1]).toBe(child2);

    parent.removeChild(child1);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(child2);
  });

  it('throws when removing a non-child', () => {
    const parent = new PdfOutlineItem('Parent', { type: 'page', pageIndex: 0 });
    const other = new PdfOutlineItem('Other', { type: 'page', pageIndex: 1 });

    expect(() => parent.removeChild(other)).toThrow('Item is not a child');
  });

  it('counts visible descendants correctly', () => {
    const parent = new PdfOutlineItem('Parent', { type: 'page', pageIndex: 0 });
    const child1 = parent.addChild('Child 1', { type: 'page', pageIndex: 1 });
    child1.addChild('Grandchild 1.1', { type: 'page', pageIndex: 2 });
    child1.addChild('Grandchild 1.2', { type: 'page', pageIndex: 3 });
    parent.addChild('Child 2', { type: 'page', pageIndex: 4 });

    // Parent has 4 total descendants: child1, gc1.1, gc1.2, child2
    expect(parent.getTotalDescendantCount()).toBe(4);
  });

  it('counts total descendants for nested trees', () => {
    const root = new PdfOutlineItem('Root', { type: 'page', pageIndex: 0 });
    const a = root.addChild('A', { type: 'page', pageIndex: 1 });
    const b = a.addChild('B', { type: 'page', pageIndex: 2 });
    b.addChild('C', { type: 'page', pageIndex: 3 });

    // root -> A -> B -> C = 3 descendants
    expect(root.getTotalDescendantCount()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// PdfOutlineTree tests
// ---------------------------------------------------------------------------

describe('PdfOutlineTree', () => {
  it('starts with no items', () => {
    const tree = new PdfOutlineTree();
    expect(tree.items).toHaveLength(0);
  });

  it('adds and removes top-level items', () => {
    const tree = new PdfOutlineTree();
    const item1 = tree.addItem('Chapter 1', { type: 'page', pageIndex: 0 });
    const item2 = tree.addItem('Chapter 2', { type: 'page', pageIndex: 1 });

    expect(tree.items).toHaveLength(2);

    tree.removeItem(item1);
    expect(tree.items).toHaveLength(1);
    expect(tree.items[0]).toBe(item2);
  });

  it('throws when removing a non-existent item', () => {
    const tree = new PdfOutlineTree();
    const other = new PdfOutlineItem('Other', { type: 'page', pageIndex: 0 });

    expect(() => tree.removeItem(other)).toThrow('Item is not in the outline tree');
  });

  // -----------------------------------------------------------------------
  // Serialization: toDict
  // -----------------------------------------------------------------------

  describe('toDict', () => {
    it('serializes an empty tree', () => {
      const tree = new PdfOutlineTree();
      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(3);

      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef);

      expect(outlinesDict).toBeInstanceOf(PdfDict);
      const dict = outlinesDict as PdfDict;

      // Check /Type and /Count
      const typeVal = serialize(dict.get('/Type')!);
      expect(typeVal).toBe('/Outlines');
      expect(serialize(dict.get('/Count')!)).toBe('0');
    });

    it('serializes a flat list of items', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Chapter 1', { type: 'page', pageIndex: 0, fit: 'Fit' });
      tree.addItem('Chapter 2', { type: 'page', pageIndex: 1, fit: 'Fit' });
      tree.addItem('Chapter 3', { type: 'page', pageIndex: 2, fit: 'Fit' });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(3);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      // Should have /First and /Last
      expect(outlinesDict.has('/First')).toBe(true);
      expect(outlinesDict.has('/Last')).toBe(true);

      // Count should be 3 (all items are open with no children)
      expect(serialize(outlinesDict.get('/Count')!)).toBe('3');

      // Verify the first item
      const firstRef = outlinesDict.get('/First') as PdfRef;
      const firstDict = registry.resolve(firstRef) as PdfDict;
      expect(serialize(firstDict.get('/Title')!)).toBe('(Chapter 1)');

      // First item should have /Next but no /Prev
      expect(firstDict.has('/Next')).toBe(true);
      expect(firstDict.has('/Prev')).toBe(false);

      // Verify destination array: [pageRef /Fit]
      const destArray = firstDict.get('/Dest') as PdfArray;
      expect(destArray.length).toBe(2);
    });

    it('serializes nested items with /First, /Last, /Parent links', () => {
      const tree = new PdfOutlineTree();
      const ch1 = tree.addItem('Chapter 1', { type: 'page', pageIndex: 0 });
      ch1.addChild('Section 1.1', { type: 'page', pageIndex: 1 });
      ch1.addChild('Section 1.2', { type: 'page', pageIndex: 2 });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(5);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      // First item (Chapter 1)
      const ch1Ref = outlinesDict.get('/First') as PdfRef;
      const ch1Dict = registry.resolve(ch1Ref) as PdfDict;
      expect(ch1Dict.has('/First')).toBe(true);
      expect(ch1Dict.has('/Last')).toBe(true);

      // Chapter 1's /Count should be 2 (2 children, open)
      expect(serialize(ch1Dict.get('/Count')!)).toBe('2');

      // Section 1.1 should have /Parent pointing to Chapter 1
      const sec11Ref = ch1Dict.get('/First') as PdfRef;
      const sec11Dict = registry.resolve(sec11Ref) as PdfDict;
      expect(serialize(sec11Dict.get('/Title')!)).toBe('(Section 1.1)');
      expect((sec11Dict.get('/Parent') as PdfRef).objectNumber).toBe(ch1Ref.objectNumber);
    });

    it('serializes closed items with negative /Count', () => {
      const tree = new PdfOutlineTree();
      const ch1 = tree.addItem('Chapter 1', { type: 'page', pageIndex: 0 }, { isOpen: false });
      ch1.addChild('Section 1.1', { type: 'page', pageIndex: 1 });
      ch1.addChild('Section 1.2', { type: 'page', pageIndex: 2 });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(3);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      const ch1Ref = outlinesDict.get('/First') as PdfRef;
      const ch1Dict = registry.resolve(ch1Ref) as PdfDict;

      // Should be -2 because closed with 2 descendants
      expect(serialize(ch1Dict.get('/Count')!)).toBe('-2');
    });

    it('serializes color and style flags', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Red Bold Italic', { type: 'page', pageIndex: 0 }, {
        color: { r: 1, g: 0, b: 0 },
        bold: true,
        italic: true,
      });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(1);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;

      // /C array [1 0 0]
      const colorArr = itemDict.get('/C') as PdfArray;
      expect(colorArr.length).toBe(3);

      // /F = 3 (italic=1 | bold=2)
      expect(serialize(itemDict.get('/F')!)).toBe('3');
    });

    it('serializes only bold flag (F=2)', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Bold Only', { type: 'page', pageIndex: 0 }, { bold: true });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(1);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;
      expect(serialize(itemDict.get('/F')!)).toBe('2');
    });

    it('serializes only italic flag (F=1)', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Italic Only', { type: 'page', pageIndex: 0 }, { italic: true });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(1);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;
      expect(serialize(itemDict.get('/F')!)).toBe('1');
    });

    it('does not emit /F or /C when not set', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Plain', { type: 'page', pageIndex: 0 });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(1);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;
      expect(itemDict.has('/F')).toBe(false);
      expect(itemDict.has('/C')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Destination fit modes
  // -----------------------------------------------------------------------

  describe('destination fit modes', () => {
    function serializeItemDest(dest: OutlineDestination): PdfArray {
      const tree = new PdfOutlineTree();
      tree.addItem('Test', dest);
      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(5);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;
      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;
      return itemDict.get('/Dest') as PdfArray;
    }

    it('serializes /Fit destination', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'Fit' });
      expect(arr.length).toBe(2);
      expect(serialize(arr.items[1]!)).toBe('/Fit');
    });

    it('serializes /FitH destination with top', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'FitH', top: 500 });
      expect(arr.length).toBe(3);
      expect(serialize(arr.items[1]!)).toBe('/FitH');
      expect(serialize(arr.items[2]!)).toBe('500');
    });

    it('serializes /FitH destination without top (null)', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'FitH' });
      expect(arr.length).toBe(3);
      expect(serialize(arr.items[2]!)).toBe('null');
    });

    it('serializes /FitV destination with left', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'FitV', left: 100 });
      expect(arr.length).toBe(3);
      expect(serialize(arr.items[1]!)).toBe('/FitV');
      expect(serialize(arr.items[2]!)).toBe('100');
    });

    it('serializes /FitB destination', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'FitB' });
      expect(arr.length).toBe(2);
      expect(serialize(arr.items[1]!)).toBe('/FitB');
    });

    it('serializes /FitBH destination', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 1, fit: 'FitBH', top: 300 });
      expect(arr.length).toBe(3);
      expect(serialize(arr.items[1]!)).toBe('/FitBH');
      expect(serialize(arr.items[2]!)).toBe('300');
    });

    it('serializes /FitBV destination', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 1, fit: 'FitBV', left: 200 });
      expect(arr.length).toBe(3);
      expect(serialize(arr.items[1]!)).toBe('/FitBV');
      expect(serialize(arr.items[2]!)).toBe('200');
    });

    it('serializes /XYZ destination with all params', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'XYZ', left: 50, top: 800, zoom: 1.5 });
      expect(arr.length).toBe(5);
      expect(serialize(arr.items[1]!)).toBe('/XYZ');
      expect(serialize(arr.items[2]!)).toBe('50');
      expect(serialize(arr.items[3]!)).toBe('800');
      expect(serialize(arr.items[4]!)).toBe('1.5');
    });

    it('serializes /XYZ destination with nulls', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0, fit: 'XYZ' });
      expect(arr.length).toBe(5);
      expect(serialize(arr.items[2]!)).toBe('null');
      expect(serialize(arr.items[3]!)).toBe('null');
      expect(serialize(arr.items[4]!)).toBe('null');
    });

    it('serializes named destination as string', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Named Dest', { type: 'named', namedDestination: 'chapter1' });
      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(1);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;
      const itemRef = outlinesDict.get('/First') as PdfRef;
      const itemDict = registry.resolve(itemRef) as PdfDict;

      const dest = itemDict.get('/Dest') as PdfString;
      expect(dest).toBeInstanceOf(PdfString);
      expect(dest.value).toBe('chapter1');
    });

    it('defaults to /Fit when no fit mode specified', () => {
      const arr = serializeItemDest({ type: 'page', pageIndex: 0 });
      expect(arr.length).toBe(2);
      expect(serialize(arr.items[1]!)).toBe('/Fit');
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('throws for out-of-range page index', () => {
      const tree = new PdfOutlineTree();
      tree.addItem('Bad', { type: 'page', pageIndex: 99 });

      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(3);

      expect(() => tree.toDict(registry, pageRefs)).toThrow('out of range');
    });
  });

  // -----------------------------------------------------------------------
  // Parsing: fromDict
  // -----------------------------------------------------------------------

  describe('fromDict', () => {
    it('parses an empty outline dict', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Outlines'));
      dict.set('/Count', PdfNumber.of(0));

      const tree = PdfOutlineTree.fromDict(
        dict,
        () => undefined,
        new Map(),
      );
      expect(tree.items).toHaveLength(0);
    });

    it('parses a flat list of outline items', () => {
      const registry = new PdfObjectRegistry();
      const pageRef0 = PdfRef.of(100);
      const pageRef1 = PdfRef.of(101);
      const pageRefToIndex = new Map([[100, 0], [101, 1]]);

      // Build item1 dict
      const item1Dict = new PdfDict();
      item1Dict.set('/Title', PdfString.literal('Chapter 1'));
      item1Dict.set('/Dest', PdfArray.of([pageRef0, PdfName.of('Fit')]));
      const item1Ref = registry.register(item1Dict);

      // Build item2 dict
      const item2Dict = new PdfDict();
      item2Dict.set('/Title', PdfString.literal('Chapter 2'));
      item2Dict.set('/Dest', PdfArray.of([pageRef1, PdfName.of('FitH'), PdfNumber.of(700)]));
      const item2Ref = registry.register(item2Dict);

      // Link them
      item1Dict.set('/Next', item2Ref);
      item2Dict.set('/Prev', item1Ref);

      // Build outlines dict
      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', item1Ref);
      outlinesDict.set('/Last', item2Ref);
      outlinesDict.set('/Count', PdfNumber.of(2));

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      expect(tree.items).toHaveLength(2);
      expect(tree.items[0]!.title).toBe('Chapter 1');
      expect(tree.items[0]!.destination.type).toBe('page');
      expect(tree.items[0]!.destination.pageIndex).toBe(0);
      expect(tree.items[0]!.destination.fit).toBe('Fit');

      expect(tree.items[1]!.title).toBe('Chapter 2');
      expect(tree.items[1]!.destination.fit).toBe('FitH');
      expect(tree.items[1]!.destination.top).toBe(700);
    });

    it('parses nested outline items', () => {
      const registry = new PdfObjectRegistry();
      const pageRef0 = PdfRef.of(100);
      const pageRef1 = PdfRef.of(101);
      const pageRefToIndex = new Map([[100, 0], [101, 1]]);

      // Child item
      const childDict = new PdfDict();
      childDict.set('/Title', PdfString.literal('Section 1.1'));
      childDict.set('/Dest', PdfArray.of([pageRef1, PdfName.of('Fit')]));
      const childRef = registry.register(childDict);

      // Parent item
      const parentDict = new PdfDict();
      parentDict.set('/Title', PdfString.literal('Chapter 1'));
      parentDict.set('/Dest', PdfArray.of([pageRef0, PdfName.of('Fit')]));
      parentDict.set('/First', childRef);
      parentDict.set('/Last', childRef);
      parentDict.set('/Count', PdfNumber.of(1));
      const parentRef = registry.register(parentDict);

      childDict.set('/Parent', parentRef);

      // Outlines root
      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', parentRef);
      outlinesDict.set('/Last', parentRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      expect(tree.items).toHaveLength(1);
      expect(tree.items[0]!.title).toBe('Chapter 1');
      expect(tree.items[0]!.children).toHaveLength(1);
      expect(tree.items[0]!.children[0]!.title).toBe('Section 1.1');
    });

    it('parses colour and flags', () => {
      const registry = new PdfObjectRegistry();
      const pageRef0 = PdfRef.of(100);
      const pageRefToIndex = new Map([[100, 0]]);

      const itemDict = new PdfDict();
      itemDict.set('/Title', PdfString.literal('Styled'));
      itemDict.set('/Dest', PdfArray.of([pageRef0, PdfName.of('Fit')]));
      itemDict.set('/C', PdfArray.of([PdfNumber.of(0.5), PdfNumber.of(0.25), PdfNumber.of(0.75)]));
      itemDict.set('/F', PdfNumber.of(3)); // italic + bold
      const itemRef = registry.register(itemDict);

      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', itemRef);
      outlinesDict.set('/Last', itemRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      const item = tree.items[0]!;
      expect(item.color).toEqual({ r: 0.5, g: 0.25, b: 0.75 });
      expect(item.italic).toBe(true);
      expect(item.bold).toBe(true);
    });

    it('parses closed item (negative count)', () => {
      const registry = new PdfObjectRegistry();
      const pageRef0 = PdfRef.of(100);
      const pageRefToIndex = new Map([[100, 0]]);

      const childDict = new PdfDict();
      childDict.set('/Title', PdfString.literal('Child'));
      childDict.set('/Dest', PdfArray.of([pageRef0, PdfName.of('Fit')]));
      const childRef = registry.register(childDict);

      const itemDict = new PdfDict();
      itemDict.set('/Title', PdfString.literal('Closed'));
      itemDict.set('/Dest', PdfArray.of([pageRef0, PdfName.of('Fit')]));
      itemDict.set('/Count', PdfNumber.of(-1));
      itemDict.set('/First', childRef);
      itemDict.set('/Last', childRef);
      const itemRef = registry.register(itemDict);

      childDict.set('/Parent', itemRef);

      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', itemRef);
      outlinesDict.set('/Last', itemRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      expect(tree.items[0]!.isOpen).toBe(false);
      expect(tree.items[0]!.children).toHaveLength(1);
    });

    it('parses named destination string', () => {
      const registry = new PdfObjectRegistry();
      const pageRefToIndex = new Map<number, number>();

      const itemDict = new PdfDict();
      itemDict.set('/Title', PdfString.literal('Named'));
      itemDict.set('/Dest', PdfString.literal('my-dest'));
      const itemRef = registry.register(itemDict);

      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', itemRef);
      outlinesDict.set('/Last', itemRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      expect(tree.items[0]!.destination.type).toBe('named');
      expect(tree.items[0]!.destination.namedDestination).toBe('my-dest');
    });

    it('parses XYZ destination with all parameters', () => {
      const registry = new PdfObjectRegistry();
      const pageRef0 = PdfRef.of(100);
      const pageRefToIndex = new Map([[100, 0]]);

      const itemDict = new PdfDict();
      itemDict.set('/Title', PdfString.literal('XYZ'));
      itemDict.set('/Dest', PdfArray.of([
        pageRef0,
        PdfName.of('XYZ'),
        PdfNumber.of(50),
        PdfNumber.of(800),
        PdfNumber.of(2),
      ]));
      const itemRef = registry.register(itemDict);

      const outlinesDict = new PdfDict();
      outlinesDict.set('/Type', PdfName.of('Outlines'));
      outlinesDict.set('/First', itemRef);
      outlinesDict.set('/Last', itemRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const tree = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      const dest = tree.items[0]!.destination;
      expect(dest.fit).toBe('XYZ');
      expect(dest.left).toBe(50);
      expect(dest.top).toBe(800);
      expect(dest.zoom).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Round-trip: toDict -> fromDict
  // -----------------------------------------------------------------------

  describe('round-trip', () => {
    it('round-trips a complex outline tree', () => {
      // Build an outline tree
      const tree = new PdfOutlineTree();
      const ch1 = tree.addItem('Chapter 1', { type: 'page', pageIndex: 0, fit: 'Fit' });
      ch1.addChild('Section 1.1', { type: 'page', pageIndex: 1, fit: 'FitH', top: 600 });
      ch1.addChild('Section 1.2', { type: 'page', pageIndex: 2, fit: 'XYZ', left: 0, top: 800, zoom: 1 });
      tree.addItem('Chapter 2', { type: 'page', pageIndex: 3, fit: 'Fit' }, {
        color: { r: 0, g: 0, b: 1 },
        bold: true,
      });

      // Serialize
      const registry = new PdfObjectRegistry();
      const pageRefs = createPageRefs(5);
      const outlinesRef = tree.toDict(registry, pageRefs);
      const outlinesDict = registry.resolve(outlinesRef) as PdfDict;

      // Build page ref to index map from our page refs
      const pageRefToIndex = new Map<number, number>();
      for (let i = 0; i < pageRefs.length; i++) {
        pageRefToIndex.set(pageRefs[i]!.objectNumber, i);
      }

      // Parse back
      const resolver = (ref: PdfRef): PdfObject | undefined => registry.resolve(ref);
      const parsed = PdfOutlineTree.fromDict(outlinesDict, resolver, pageRefToIndex);

      // Verify
      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0]!.title).toBe('Chapter 1');
      expect(parsed.items[0]!.children).toHaveLength(2);
      expect(parsed.items[0]!.children[0]!.title).toBe('Section 1.1');
      expect(parsed.items[0]!.children[0]!.destination.fit).toBe('FitH');
      expect(parsed.items[0]!.children[0]!.destination.top).toBe(600);
      expect(parsed.items[0]!.children[1]!.title).toBe('Section 1.2');
      expect(parsed.items[0]!.children[1]!.destination.fit).toBe('XYZ');

      expect(parsed.items[1]!.title).toBe('Chapter 2');
      expect(parsed.items[1]!.destination.pageIndex).toBe(3);
      expect(parsed.items[1]!.color).toEqual({ r: 0, g: 0, b: 1 });
      expect(parsed.items[1]!.bold).toBe(true);
    });
  });
});
