/**
 * Tests for the structure tree model — PdfStructureElement and PdfStructureTree.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfStructureElement,
  PdfStructureTree,
} from '../../../src/accessibility/structureTree.js';
import type {
  StructureType,
  StructureElementOptions,
  AccessibilityIssue,
} from '../../../src/accessibility/structureTree.js';
import {
  PdfObjectRegistry,
  PdfRef,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import type { PdfObject } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// PdfStructureElement
// ---------------------------------------------------------------------------

describe('PdfStructureElement', () => {
  it('creates an element with a type', () => {
    const elem = new PdfStructureElement('P');
    expect(elem.type).toBe('P');
    expect(elem.children).toHaveLength(0);
    expect(elem.mcid).toBeUndefined();
    expect(elem.pageIndex).toBeUndefined();
    expect(elem.parent).toBeUndefined();
  });

  it('creates an element with options', () => {
    const elem = new PdfStructureElement('Figure', {
      altText: 'A photo of a cat',
      title: 'Cat Photo',
      language: 'en',
      id: 'fig-1',
    });
    expect(elem.type).toBe('Figure');
    expect(elem.options.altText).toBe('A photo of a cat');
    expect(elem.options.title).toBe('Cat Photo');
    expect(elem.options.language).toBe('en');
    expect(elem.options.id).toBe('fig-1');
  });

  it('addChild creates and returns a child element', () => {
    const parent = new PdfStructureElement('Sect');
    const child = parent.addChild('P', { altText: 'Paragraph' });

    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(child);
    expect(child.type).toBe('P');
    expect(child.parent).toBe(parent);
    expect(child.options.altText).toBe('Paragraph');
  });

  it('removeChild removes a direct child', () => {
    const parent = new PdfStructureElement('Sect');
    const child1 = parent.addChild('P');
    const child2 = parent.addChild('P');

    expect(parent.children).toHaveLength(2);

    parent.removeChild(child1);

    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(child2);
    expect(child1.parent).toBeUndefined();
  });

  it('removeChild throws for non-child', () => {
    const parent = new PdfStructureElement('Sect');
    const unrelated = new PdfStructureElement('P');

    expect(() => parent.removeChild(unrelated)).toThrow(
      'Element is not a direct child of this node',
    );
  });

  it('walk returns all elements depth-first', () => {
    const root = new PdfStructureElement('Document');
    const sect = root.addChild('Sect');
    const h1 = sect.addChild('H1');
    const p = sect.addChild('P');
    const span = p.addChild('Span');

    const all = root.walk();
    expect(all).toHaveLength(5);
    expect(all[0]).toBe(root);
    expect(all[1]).toBe(sect);
    expect(all[2]).toBe(h1);
    expect(all[3]).toBe(p);
    expect(all[4]).toBe(span);
  });

  it('find returns the first matching element', () => {
    const root = new PdfStructureElement('Document');
    root.addChild('Sect');
    const sect = root.children[0]!;
    sect.addChild('H1');
    sect.addChild('P');

    const found = root.find('P');
    expect(found).toBeDefined();
    expect(found!.type).toBe('P');
  });

  it('find returns undefined when not found', () => {
    const root = new PdfStructureElement('Document');
    root.addChild('Sect');
    expect(root.find('Table')).toBeUndefined();
  });

  it('findAll returns all matching elements', () => {
    const root = new PdfStructureElement('Document');
    root.addChild('P');
    root.addChild('P');
    root.addChild('Sect');

    const found = root.findAll('P');
    expect(found).toHaveLength(2);
  });

  it('depth returns the correct depth', () => {
    const root = new PdfStructureElement('Document');
    const sect = root.addChild('Sect');
    const p = sect.addChild('P');
    const span = p.addChild('Span');

    expect(root.depth()).toBe(0);
    expect(sect.depth()).toBe(1);
    expect(p.depth()).toBe(2);
    expect(span.depth()).toBe(3);
  });

  it('toDict serializes a leaf element with MCID', () => {
    const elem = new PdfStructureElement('P', { altText: 'Hello' });
    elem.mcid = 0;
    elem.pageIndex = 0;

    const registry = new PdfObjectRegistry();
    const parentRef = PdfRef.of(1);
    const pageRef = PdfRef.of(2);

    const result = elem.toDict(registry, parentRef, [pageRef]);

    expect(result.ref).toBeDefined();
    expect(result.dict).toBeDefined();

    // Check /Type
    const typeVal = result.dict.get('/Type');
    expect(typeVal).toBeDefined();
    expect(typeVal!.kind).toBe('name');
    expect((typeVal as PdfName).value).toBe('/StructElem');

    // Check /S (structure type)
    const sVal = result.dict.get('/S');
    expect(sVal).toBeDefined();
    expect((sVal as PdfName).value).toBe('/P');

    // Check /P (parent)
    const pVal = result.dict.get('/P');
    expect(pVal).toBeDefined();

    // Check /Alt
    const altVal = result.dict.get('/Alt');
    expect(altVal).toBeDefined();
    expect((altVal as PdfString).value).toBe('Hello');

    // Check /K (MCID)
    const kVal = result.dict.get('/K');
    expect(kVal).toBeDefined();
    expect((kVal as PdfNumber).value).toBe(0);
  });

  it('toDict serializes an element with children', () => {
    const parent = new PdfStructureElement('Sect');
    parent.addChild('H1');
    parent.addChild('P');

    const registry = new PdfObjectRegistry();
    const parentRef = PdfRef.of(1);

    const result = parent.toDict(registry, parentRef, []);

    // /K should be an array with child refs
    const kVal = result.dict.get('/K');
    expect(kVal).toBeDefined();
    expect(kVal!.kind).toBe('array');
    expect((kVal as PdfArray).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PdfStructureTree
// ---------------------------------------------------------------------------

describe('PdfStructureTree', () => {
  it('creates a tree with a Document root', () => {
    const tree = new PdfStructureTree();
    expect(tree.root.type).toBe('Document');
    expect(tree.root.children).toHaveLength(0);
  });

  it('addElement adds to the root when parent is null', () => {
    const tree = new PdfStructureTree();
    const elem = tree.addElement(null, 'H1', { title: 'Title' });

    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]).toBe(elem);
    expect(elem.type).toBe('H1');
    expect(elem.parent).toBe(tree.root);
  });

  it('addElement adds to a specific parent', () => {
    const tree = new PdfStructureTree();
    const sect = tree.addElement(null, 'Sect');
    const para = tree.addElement(sect, 'P');

    expect(sect.children).toHaveLength(1);
    expect(sect.children[0]).toBe(para);
    expect(para.parent).toBe(sect);
  });

  it('removeElement removes an element', () => {
    const tree = new PdfStructureTree();
    const elem = tree.addElement(null, 'P');

    expect(tree.root.children).toHaveLength(1);
    tree.removeElement(elem);
    expect(tree.root.children).toHaveLength(0);
  });

  it('removeElement throws for the root', () => {
    const tree = new PdfStructureTree();
    expect(() => tree.removeElement(tree.root)).toThrow(
      'Cannot remove the root element',
    );
  });

  it('assignMcid assigns monotonically increasing MCIDs', () => {
    const tree = new PdfStructureTree();
    const h1 = tree.addElement(null, 'H1');
    const p = tree.addElement(null, 'P');

    const mcid1 = tree.assignMcid(h1, 0);
    const mcid2 = tree.assignMcid(p, 0);

    expect(mcid1).toBe(0);
    expect(mcid2).toBe(1);
    expect(h1.mcid).toBe(0);
    expect(h1.pageIndex).toBe(0);
    expect(p.mcid).toBe(1);
    expect(p.pageIndex).toBe(0);
  });

  it('getAllElements returns all elements including root', () => {
    const tree = new PdfStructureTree();
    tree.addElement(null, 'Sect');
    tree.addElement(null, 'P');

    const all = tree.getAllElements();
    // Root + Sect + P
    expect(all).toHaveLength(3);
    expect(all[0]!.type).toBe('Document');
  });

  it('getNextMcid returns the next available MCID', () => {
    const tree = new PdfStructureTree();
    expect(tree.getNextMcid()).toBe(0);

    const elem = tree.addElement(null, 'P');
    tree.assignMcid(elem, 0);
    expect(tree.getNextMcid()).toBe(1);
  });

  it('toDict produces a valid StructTreeRoot', () => {
    const tree = new PdfStructureTree();
    const h1 = tree.addElement(null, 'H1', { altText: 'Main Heading' });
    const p = tree.addElement(null, 'P');
    tree.assignMcid(h1, 0);
    tree.assignMcid(p, 0);

    const registry = new PdfObjectRegistry();
    const pageRef = PdfRef.of(100);

    const result = tree.toDict(registry, [pageRef]);

    // Check /Type
    const typeVal = result.dict.get('/Type');
    expect(typeVal).toBeDefined();
    expect((typeVal as PdfName).value).toBe('/StructTreeRoot');

    // Should have /K (kids)
    const kVal = result.dict.get('/K');
    expect(kVal).toBeDefined();

    // Should have /ParentTree
    const ptVal = result.dict.get('/ParentTree');
    expect(ptVal).toBeDefined();
  });

  it('toDict handles single child without wrapping in array', () => {
    const tree = new PdfStructureTree();
    tree.addElement(null, 'P');

    const registry = new PdfObjectRegistry();
    const result = tree.toDict(registry, []);

    // Single child: /K should be a ref, not array
    const kVal = result.dict.get('/K');
    expect(kVal).toBeDefined();
    expect(kVal!.kind).toBe('ref');
  });

  it('toDict builds IDTree when elements have IDs', () => {
    const tree = new PdfStructureTree();
    tree.addElement(null, 'P', { id: 'para-1' });
    tree.addElement(null, 'P', { id: 'para-2' });

    const registry = new PdfObjectRegistry();
    const result = tree.toDict(registry, []);

    // Should have /IDTree
    const idTreeVal = result.dict.get('/IDTree');
    expect(idTreeVal).toBeDefined();
  });

  it('toDict skips ParentTree when no MCIDs assigned', () => {
    const tree = new PdfStructureTree();
    tree.addElement(null, 'P');

    const registry = new PdfObjectRegistry();
    const result = tree.toDict(registry, []);

    // No MCIDs => no /ParentTree
    const ptVal = result.dict.get('/ParentTree');
    expect(ptVal).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // fromDict
  // -----------------------------------------------------------------------

  describe('fromDict', () => {
    it('reconstructs a tree from a StructTreeRoot dict', () => {
      // Build a simple structure manually
      const kidDict = new PdfDict();
      kidDict.set('/Type', PdfName.of('StructElem'));
      kidDict.set('/S', PdfName.of('P'));
      kidDict.set('/Alt', PdfString.literal('Paragraph'));
      kidDict.set('/K', PdfNumber.of(0));

      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));
      rootDict.set('/K', kidDict);

      const tree = PdfStructureTree.fromDict(rootDict, () => undefined);

      expect(tree.root.type).toBe('Document');
      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0]!.type).toBe('P');
      expect(tree.root.children[0]!.options.altText).toBe('Paragraph');
      expect(tree.root.children[0]!.mcid).toBe(0);
    });

    it('handles array of kids', () => {
      const kid1 = new PdfDict();
      kid1.set('/Type', PdfName.of('StructElem'));
      kid1.set('/S', PdfName.of('H1'));

      const kid2 = new PdfDict();
      kid2.set('/Type', PdfName.of('StructElem'));
      kid2.set('/S', PdfName.of('P'));

      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));
      rootDict.set('/K', PdfArray.of([kid1, kid2]));

      const tree = PdfStructureTree.fromDict(rootDict, () => undefined);

      expect(tree.root.children).toHaveLength(2);
      expect(tree.root.children[0]!.type).toBe('H1');
      expect(tree.root.children[1]!.type).toBe('P');
    });

    it('handles indirect references in kids', () => {
      const kidDict = new PdfDict();
      kidDict.set('/Type', PdfName.of('StructElem'));
      kidDict.set('/S', PdfName.of('Span'));
      kidDict.set('/Lang', PdfString.literal('en'));

      const kidRef = PdfRef.of(10);

      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));
      rootDict.set('/K', kidRef);

      const resolver = (ref: PdfRef): PdfObject | undefined => {
        if (ref.objectNumber === 10) return kidDict;
        return undefined;
      };

      const tree = PdfStructureTree.fromDict(rootDict, resolver);

      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0]!.type).toBe('Span');
      expect(tree.root.children[0]!.options.language).toBe('en');
    });

    it('handles MCR (marked content reference) dicts', () => {
      const mcrDict = new PdfDict();
      mcrDict.set('/Type', PdfName.of('MCR'));
      mcrDict.set('/MCID', PdfNumber.of(5));

      const elemDict = new PdfDict();
      elemDict.set('/Type', PdfName.of('StructElem'));
      elemDict.set('/S', PdfName.of('P'));
      elemDict.set('/K', mcrDict);

      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));
      rootDict.set('/K', elemDict);

      const tree = PdfStructureTree.fromDict(rootDict, () => undefined);

      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0]!.mcid).toBe(5);
      // The MCID counter should advance past 5
      expect(tree.getNextMcid()).toBe(6);
    });

    it('parses nested structure elements', () => {
      const spanDict = new PdfDict();
      spanDict.set('/Type', PdfName.of('StructElem'));
      spanDict.set('/S', PdfName.of('Span'));
      spanDict.set('/K', PdfNumber.of(0));

      const pDict = new PdfDict();
      pDict.set('/Type', PdfName.of('StructElem'));
      pDict.set('/S', PdfName.of('P'));
      pDict.set('/K', spanDict);

      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));
      rootDict.set('/K', pDict);

      const tree = PdfStructureTree.fromDict(rootDict, () => undefined);

      const p = tree.root.children[0]!;
      expect(p.type).toBe('P');
      expect(p.children).toHaveLength(1);
      expect(p.children[0]!.type).toBe('Span');
      expect(p.children[0]!.mcid).toBe(0);
    });

    it('returns empty tree when /K is missing', () => {
      const rootDict = new PdfDict();
      rootDict.set('/Type', PdfName.of('StructTreeRoot'));

      const tree = PdfStructureTree.fromDict(rootDict, () => undefined);
      expect(tree.root.children).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // validate
  // -----------------------------------------------------------------------

  describe('validate', () => {
    it('reports heading skip', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'H1');
      tree.addElement(null, 'H3'); // Skips H2

      const issues = tree.validate();
      const headingSkip = issues.find((i) => i.code === 'HEADING_SKIP');
      expect(headingSkip).toBeDefined();
      expect(headingSkip!.severity).toBe('warning');
    });

    it('reports first heading not being H1', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'H2');

      const issues = tree.validate();
      const headingStart = issues.find((i) => i.code === 'HEADING_START');
      expect(headingStart).toBeDefined();
    });

    it('reports no issues for correct heading hierarchy', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'H1');
      tree.addElement(null, 'H2');
      tree.addElement(null, 'H3');

      const issues = tree.validate();
      const headingIssues = issues.filter(
        (i) => i.code === 'HEADING_SKIP' || i.code === 'HEADING_START',
      );
      expect(headingIssues).toHaveLength(0);
    });

    it('reports table without rows', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'Table'); // No TR children

      const issues = tree.validate();
      const noRows = issues.find((i) => i.code === 'TABLE_NO_ROWS');
      expect(noRows).toBeDefined();
      expect(noRows!.severity).toBe('error');
    });

    it('reports table without header cells', () => {
      const tree = new PdfStructureTree();
      const table = tree.addElement(null, 'Table');
      const tr = tree.addElement(table, 'TR');
      tree.addElement(tr, 'TD'); // No TH

      const issues = tree.validate();
      const noHeaders = issues.find((i) => i.code === 'TABLE_NO_HEADERS');
      expect(noHeaders).toBeDefined();
      expect(noHeaders!.severity).toBe('warning');
    });

    it('reports TR without cells', () => {
      const tree = new PdfStructureTree();
      const table = tree.addElement(null, 'Table');
      tree.addElement(table, 'TR'); // No TH or TD

      const issues = tree.validate();
      const noCells = issues.find((i) => i.code === 'TR_NO_CELLS');
      expect(noCells).toBeDefined();
    });

    it('reports cell not inside TR', () => {
      const tree = new PdfStructureTree();
      const table = tree.addElement(null, 'Table');
      tree.addElement(table, 'TD'); // TD directly in Table, not TR

      const issues = tree.validate();
      const cellNotInTr = issues.find((i) => i.code === 'CELL_NOT_IN_TR');
      expect(cellNotInTr).toBeDefined();
    });

    it('reports Figure without alt text', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'Figure'); // No altText

      const issues = tree.validate();
      const noAlt = issues.find((i) => i.code === 'FIGURE_NO_ALT');
      expect(noAlt).toBeDefined();
      expect(noAlt!.severity).toBe('error');
    });

    it('does not report Figure with alt text', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'Figure', { altText: 'A chart' });

      const issues = tree.validate();
      const noAlt = issues.find((i) => i.code === 'FIGURE_NO_ALT');
      expect(noAlt).toBeUndefined();
    });

    it('does not report Figure with actual text', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'Figure', { actualText: 'Chart data' });

      const issues = tree.validate();
      const noAlt = issues.find((i) => i.code === 'FIGURE_NO_ALT');
      expect(noAlt).toBeUndefined();
    });

    it('reports list without items', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, 'L'); // No LI children

      const issues = tree.validate();
      const noItems = issues.find((i) => i.code === 'LIST_NO_ITEMS');
      expect(noItems).toBeDefined();
    });

    it('reports LI without LBody', () => {
      const tree = new PdfStructureTree();
      const list = tree.addElement(null, 'L');
      tree.addElement(list, 'LI'); // No LBody child

      const issues = tree.validate();
      const noBody = issues.find((i) => i.code === 'LI_NO_BODY');
      expect(noBody).toBeDefined();
    });

    it('valid complete table has no table errors', () => {
      const tree = new PdfStructureTree();
      const table = tree.addElement(null, 'Table');
      const headerRow = tree.addElement(table, 'TR');
      tree.addElement(headerRow, 'TH');
      tree.addElement(headerRow, 'TH');
      const bodyRow = tree.addElement(table, 'TR');
      tree.addElement(bodyRow, 'TD');
      tree.addElement(bodyRow, 'TD');

      const issues = tree.validate();
      const tableIssues = issues.filter(
        (i) =>
          i.code === 'TABLE_NO_ROWS' ||
          i.code === 'TABLE_NO_HEADERS' ||
          i.code === 'TR_NO_CELLS' ||
          i.code === 'CELL_NOT_IN_TR',
      );
      expect(tableIssues).toHaveLength(0);
    });

    it('empty tree has no issues', () => {
      const tree = new PdfStructureTree();
      const issues = tree.validate();
      expect(issues).toHaveLength(0);
    });

    it('reports empty type', () => {
      const tree = new PdfStructureTree();
      tree.addElement(null, ''); // empty type

      const issues = tree.validate();
      const emptyType = issues.find((i) => i.code === 'EMPTY_TYPE');
      expect(emptyType).toBeDefined();
    });
  });
});
