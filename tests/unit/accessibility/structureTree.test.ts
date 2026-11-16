/**
 * Tests for the structure tree model — PdfStructureElement and PdfStructureTree.
 */

import { describe, it, expect } from 'vitest';
import { PdfStructureElement, PdfStructureTree } from '../../../src/accessibility/structureTree.js';
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
    expect(() => tree.removeElement(tree.root)).toThrow('Cannot remove the root element');
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

// ---------------------------------------------------------------------------
// Text strings read from a loaded structure element (ISO 32000-2 7.9.2.2)
// ---------------------------------------------------------------------------

describe('PdfStructureTree.fromDict text strings', () => {
  /** FE FF then each UTF-16 code unit big-endian: how a conforming writer stores non-Latin text. */
  const utf16be = (text: string): PdfString => {
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set([0xfe, 0xff]);
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      bytes[2 + i * 2] = unit >> 8;
      bytes[3 + i * 2] = unit & 0xff;
    }
    return PdfString.fromBytes(bytes);
  };

  it('reads /T, /Alt, /ActualText, /Lang and /ID as text, whatever the encoding', () => {
    const kidDict = new PdfDict();
    kidDict.set('/Type', PdfName.of('StructElem'));
    kidDict.set('/S', PdfName.of('Figure'));
    kidDict.set('/T', utf16be('Titel \u65e5\u672c'));
    kidDict.set('/Alt', utf16be('Gr\u00f6\u00dfe \u20ac'));
    kidDict.set('/ActualText', PdfString.fromBytes(Uint8Array.of(0x43, 0x61, 0x66, 0xe9, 0xa0)));
    kidDict.set('/Lang', PdfString.fromBytes(Uint8Array.of(0x64, 0x65)));
    kidDict.set('/ID', utf16be('Abschnitt-\u00fc'));

    const rootDict = new PdfDict();
    rootDict.set('/Type', PdfName.of('StructTreeRoot'));
    rootDict.set('/K', kidDict);

    const options = PdfStructureTree.fromDict(rootDict, () => undefined).root.children[0]!.options;

    expect(options.title).toBe('Titel \u65e5\u672c');
    expect(options.altText).toBe('Gr\u00f6\u00dfe \u20ac');
    // PDFDocEncoding: 0xE9 is e-acute and 0xA0 is the euro sign.
    expect(options.actualText).toBe('Caf\u00e9\u20ac');
    expect(options.language).toBe('de');
    expect(options.id).toBe('Abschnitt-\u00fc');
  });
});

// ---------------------------------------------------------------------------
// Text strings written by the structure tree (ISO 32000-2 7.9.2.2)
// ---------------------------------------------------------------------------

describe('structure tree text strings written', () => {
  /** The PdfString an entry holds, or a failure that names the entry. */
  const stringAt = (dict: PdfDict, key: string): PdfString => {
    const value = dict.get(key);
    if (!(value instanceof PdfString)) throw new Error(`${key} is not a string`);
    return value;
  };

  it('writes /T, /Alt, /ActualText, /Lang and /ID of an element as text strings', () => {
    const elem = new PdfStructureElement('Figure', {
      title: 'Titel \u65e5\u672c',
      altText: 'Gr\u00f6\u00dfe',
      actualText: 'Gr\u00f6\u00dfe \u20ac',
      language: 'de-CH',
      id: 'Abschnitt-\u00fc',
    });

    const { dict } = elem.toDict(new PdfObjectRegistry(), PdfRef.of(1), []);

    // Text in PDFDocEncoding is one byte per character; other text is UTF-16BE after FE FF.
    expect([...stringAt(dict, '/Alt').toBytes()]).toEqual([0x47, 0x72, 0xf6, 0xdf, 0x65]);
    expect(stringAt(dict, '/T').toBytes().subarray(0, 2)).toEqual(Uint8Array.of(0xfe, 0xff));
    expect(stringAt(dict, '/T').toText()).toBe('Titel \u65e5\u672c');
    expect(stringAt(dict, '/Alt').toText()).toBe('Gr\u00f6\u00dfe');
    expect(stringAt(dict, '/ActualText').toText()).toBe('Gr\u00f6\u00dfe \u20ac');
    expect(stringAt(dict, '/Lang').toText()).toBe('de-CH');
    expect(stringAt(dict, '/ID').toText()).toBe('Abschnitt-\u00fc');
  });

  it('writes /Alt of a parent tree entry as a text string', () => {
    const tree = new PdfStructureTree();
    tree.assignMcid(tree.addElement(null, 'Figure', { altText: 'Gr\u00f6\u00dfe \u65e5' }), 0);

    const registry = new PdfObjectRegistry();
    const { dict } = tree.toDict(registry, []);
    const parentTree = registry.resolve(dict.get('/ParentTree') as PdfRef) as PdfDict;
    const nums = parentTree.get('/Nums') as PdfArray;
    const entry = registry.resolve(nums.items[1] as PdfRef) as PdfDict;

    expect(stringAt(entry, '/Alt').toText()).toBe('Gr\u00f6\u00dfe \u65e5');
  });

  it('writes the /IDTree keys and /ID entries as text strings sorted by their bytes', () => {
    const tree = new PdfStructureTree();
    for (const id of ['b', '\u00c9cole', 'a', 'Z', '\u65e5']) {
      tree.addElement(null, 'P', { id });
    }

    const registry = new PdfObjectRegistry();
    const { dict } = tree.toDict(registry, []);
    const idTree = registry.resolve(dict.get('/IDTree') as PdfRef) as PdfDict;
    const names = (idTree.get('/Names') as PdfArray).items;
    const keys = names.filter((_, index) => index % 2 === 0) as PdfString[];

    // Byte order (7.9.6): "Z" 5A, "a" 61, "b" 62, E-acute C9 (PDFDocEncoding), then FE FF for U+65E5.
    expect(keys.map((key) => key.toText())).toEqual(['Z', 'a', 'b', '\u00c9cole', '\u65e5']);
    for (let i = 1; i < keys.length; i++) {
      expect(PdfString.compare(keys[i - 1]!, keys[i]!)).toBeLessThan(0);
    }
    const entries = names.filter((_, index) => index % 2 === 1) as PdfRef[];
    for (const [index, ref] of entries.entries()) {
      const elemDict = registry.resolve(ref) as PdfDict;
      expect(stringAt(elemDict, '/ID').equals(keys[index]!)).toBe(true);
    }
  });
});
