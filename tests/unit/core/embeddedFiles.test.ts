/**
 * Tests for embedded file attachments.
 *
 * Covers:
 * - Attaching files to a PDF registry
 * - Building embedded files name tree
 * - Retrieving attachments from a catalog dictionary
 * - Roundtrip: attach then retrieve
 */

import { describe, it, expect } from 'vitest';
import {
  attachFile,
  getAttachments,
  buildEmbeddedFilesNameTree,
} from '../../../src/core/embeddedFiles.js';
import type { EmbeddedFile } from '../../../src/core/embeddedFiles.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfArray,
  PdfString,
  PdfStream,
  PdfRef,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function makeFile(name: string, content: string, mimeType: string = 'text/plain'): EmbeddedFile {
  return {
    name,
    data: encoder.encode(content),
    mimeType,
  };
}

// ---------------------------------------------------------------------------
// attachFile
// ---------------------------------------------------------------------------

describe('attachFile', () => {
  it('should return an indirect reference', () => {
    const registry = new PdfObjectRegistry();
    const file = makeFile('test.txt', 'Hello, world!');
    const ref = attachFile(registry, file);
    expect(ref).toBeDefined();
    expect(ref.kind).toBe('ref');
  });

  it('should register both stream and filespec objects', () => {
    const registry = new PdfObjectRegistry();
    const file = makeFile('readme.md', '# README');
    const ref = attachFile(registry, file);

    // The filespec should be resolvable
    const obj = registry.resolve(ref);
    expect(obj).toBeDefined();
    expect(obj!.kind).toBe('dict');
  });

  it('should store filename in the filespec', () => {
    const registry = new PdfObjectRegistry();
    const file = makeFile('report.pdf', 'data', 'application/pdf');
    const ref = attachFile(registry, file);

    const obj = registry.resolve(ref);
    const dict = obj as PdfDict;

    // /F and /UF should contain the filename
    const fObj = dict.get('/F');
    expect(fObj).toBeDefined();
    expect(fObj!.kind).toBe('string');
    expect((fObj as PdfString).toText()).toBe('report.pdf');
  });

  it('should include optional description', () => {
    const registry = new PdfObjectRegistry();
    const file: EmbeddedFile = {
      name: 'data.csv',
      data: encoder.encode('a,b,c'),
      mimeType: 'text/csv',
      description: 'Test data file',
    };
    const ref = attachFile(registry, file);

    const obj = registry.resolve(ref);
    const dict = obj as PdfDict;
    const descObj = dict.get('/Desc');
    expect(descObj).toBeDefined();
    expect((descObj as PdfString).toText()).toBe('Test data file');
  });

  it('should set /AFRelationship', () => {
    const registry = new PdfObjectRegistry();
    const file = makeFile('test.txt', 'data');
    const ref = attachFile(registry, file);

    const obj = registry.resolve(ref);
    const dict = obj as PdfDict;
    const afObj = dict.get('/AFRelationship');
    expect(afObj).toBeDefined();
    expect(afObj!.kind).toBe('name');
  });
});

// ---------------------------------------------------------------------------
// buildEmbeddedFilesNameTree
// ---------------------------------------------------------------------------

describe('buildEmbeddedFilesNameTree', () => {
  it('should build a name tree with /Names array', () => {
    const registry = new PdfObjectRegistry();
    const file1 = makeFile('a.txt', 'aaa');
    const file2 = makeFile('b.txt', 'bbb');
    const ref1 = attachFile(registry, file1);
    const ref2 = attachFile(registry, file2);

    const nameTree = buildEmbeddedFilesNameTree([ref1, ref2], ['a.txt', 'b.txt'], registry);
    expect(nameTree.kind).toBe('dict');

    const namesArr = nameTree.get('/Names');
    expect(namesArr).toBeDefined();
    expect(namesArr!.kind).toBe('array');

    // Should have 4 items: [name1, ref1, name2, ref2]
    const arr = namesArr as PdfArray;
    expect(arr.length).toBe(4);
  });

  it('should handle single file', () => {
    const registry = new PdfObjectRegistry();
    const ref = attachFile(registry, makeFile('only.txt', 'solo'));
    const nameTree = buildEmbeddedFilesNameTree([ref], ['only.txt'], registry);
    const arr = nameTree.get('/Names') as PdfArray;
    expect(arr.length).toBe(2);
  });

  it('should handle empty file list', () => {
    const registry = new PdfObjectRegistry();
    const nameTree = buildEmbeddedFilesNameTree([], [], registry);
    const arr = nameTree.get('/Names') as PdfArray;
    expect(arr.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getAttachments
// ---------------------------------------------------------------------------

describe('getAttachments', () => {
  it('should return empty array when no /Names in catalog', () => {
    const catalog = new PdfDict();
    const result = getAttachments(catalog, () => new PdfDict());
    expect(result).toEqual([]);
  });

  it('should return empty array when /EmbeddedFiles is missing', () => {
    const namesDict = new PdfDict();
    const catalog = new PdfDict();
    catalog.set('/Names', namesDict);

    const result = getAttachments(catalog, () => new PdfDict());
    expect(result).toEqual([]);
  });

  it('should roundtrip attach and retrieve files', () => {
    const registry = new PdfObjectRegistry();

    // Attach files
    const file1: EmbeddedFile = {
      name: 'hello.txt',
      data: encoder.encode('Hello!'),
      mimeType: 'text/plain',
      description: 'A greeting',
    };
    const file2: EmbeddedFile = {
      name: 'data.json',
      data: encoder.encode('{"key": "value"}'),
      mimeType: 'application/json',
    };

    const ref1 = attachFile(registry, file1);
    const ref2 = attachFile(registry, file2);

    // Build name tree
    const nameTree = buildEmbeddedFilesNameTree([ref1, ref2], ['hello.txt', 'data.json'], registry);

    // Build a catalog-like dict
    const namesDict = new PdfDict();
    namesDict.set('/EmbeddedFiles', nameTree);
    const catalog = new PdfDict();
    catalog.set('/Names', namesDict);

    // Resolver that looks up objects in the registry
    const resolver = (ref: PdfRef) => {
      return registry.resolve(ref) ?? new PdfDict();
    };

    const attachments = getAttachments(catalog, resolver);
    expect(attachments).toHaveLength(2);

    // The name tree is sorted by key (ISO 32000-2 7.9.6): data.json comes before hello.txt.
    expect(attachments[0]!.name).toBe('data.json');
    expect(new TextDecoder().decode(attachments[0]!.data)).toBe('{"key": "value"}');

    expect(attachments[1]!.name).toBe('hello.txt');
    expect(new TextDecoder().decode(attachments[1]!.data)).toBe('Hello!');
    expect(attachments[1]!.description).toBe('A greeting');
  });
});

describe('getAttachments reads text strings as text', () => {
  /** A catalog holding one file, its filespec built by hand so each string is chosen exactly. */
  function catalogWith(
    key: PdfString,
    specEntries: Record<string, PdfString>,
    registry: PdfObjectRegistry,
  ): PdfDict {
    const efStream = PdfStream.fromBytes(encoder.encode('data'));
    const efRefDict = new PdfDict();
    efRefDict.set('/F', registry.register(efStream));
    const spec = new PdfDict();
    spec.set('/EF', efRefDict);
    for (const [name, value] of Object.entries(specEntries)) spec.set(name, value);
    const names = new PdfArray();
    names.push(key);
    names.push(registry.register(spec));
    const tree = new PdfDict();
    tree.set('/Names', names);
    const namesDict = new PdfDict();
    namesDict.set('/EmbeddedFiles', tree);
    const catalog = new PdfDict();
    catalog.set('/Names', namesDict);
    return catalog;
  }

  const resolveIn = (registry: PdfObjectRegistry) => (ref: PdfRef) =>
    registry.resolve(ref) ?? new PdfDict();

  it('decodes a UTF-16BE /UF and /Desc', () => {
    const registry = new PdfObjectRegistry();
    const catalog = catalogWith(
      PdfString.fromText('key'),
      { '/UF': PdfString.fromText('日本語.txt'), '/Desc': PdfString.fromText('Größe €') },
      registry,
    );

    const [attachment] = getAttachments(catalog, resolveIn(registry));

    expect(attachment!.name).toBe('日本語.txt');
    expect(attachment!.description).toBe('Größe €');
  });

  it('decodes the name-tree key when the filespec names no file', () => {
    const registry = new PdfObjectRegistry();
    const catalog = catalogWith(PdfString.fromText('Größe 日本.txt'), {}, registry);

    const [attachment] = getAttachments(catalog, resolveIn(registry));

    expect(attachment!.name).toBe('Größe 日本.txt');
  });

  it('falls back to /F when /UF is absent', () => {
    const registry = new PdfObjectRegistry();
    const catalog = catalogWith(
      PdfString.fromText('key'),
      { '/F': PdfString.fromText('Größe.txt') },
      registry,
    );

    const [attachment] = getAttachments(catalog, resolveIn(registry));

    expect(attachment!.name).toBe('Größe.txt');
  });
});

describe('attachFile writes text strings and ASCII dates', () => {
  function filespecOf(file: EmbeddedFile): PdfDict {
    const registry = new PdfObjectRegistry();
    return registry.resolve(attachFile(registry, file)) as PdfDict;
  }

  it('writes /F, /UF and /Desc as PDF text strings', () => {
    const filespec = filespecOf({
      ...makeFile('日本語 €.txt', 'x'),
      description: 'Größe 😀',
    });

    expect((filespec.get('/F') as PdfString).toBytes()).toEqual(
      PdfString.fromText('日本語 €.txt').toBytes(),
    );
    expect((filespec.get('/UF') as PdfString).toBytes()).toEqual(
      PdfString.fromText('日本語 €.txt').toBytes(),
    );
    expect((filespec.get('/UF') as PdfString).toText()).toBe('日本語 €.txt');
    expect((filespec.get('/Desc') as PdfString).toBytes()).toEqual(
      PdfString.fromText('Größe 😀').toBytes(),
    );
  });

  it('writes a name of PDFDocEncoding characters as one byte each', () => {
    const filespec = filespecOf(makeFile('Größe.txt', 'x'));

    expect([...(filespec.get('/UF') as PdfString).toBytes()]).toEqual([
      0x47, 0x72, 0xf6, 0xdf, 0x65, 0x2e, 0x74, 0x78, 0x74,
    ]);
  });

  it('writes the dates as ASCII strings', () => {
    const registry = new PdfObjectRegistry();
    const filespec = registry.resolve(
      attachFile(registry, {
        ...makeFile('d.txt', 'x'),
        creationDate: new Date(Date.UTC(2024, 2, 8, 13, 45, 9)),
        modificationDate: new Date(Date.UTC(2025, 0, 2, 3, 4, 5)),
      }),
    ) as PdfDict;
    const efRefDict = filespec.get('/EF') as PdfDict;
    const stream = registry.resolve(efRefDict.get('/F') as PdfRef) as PdfStream;
    const params = stream.dict.get('/Params') as PdfDict;

    expect((params.get('/CreationDate') as PdfString).toText()).toBe('D:20240308134509Z');
    expect((params.get('/ModDate') as PdfString).toText()).toBe('D:20250102030405Z');
  });
});

describe('buildEmbeddedFilesNameTree keys', () => {
  const registry = new PdfObjectRegistry();
  const refs = ['a', 'b', 'c', 'd'].map((n) => attachFile(registry, makeFile(`${n}.bin`, n)));

  function keysOf(names: string[]): PdfString[] {
    const tree = buildEmbeddedFilesNameTree(refs.slice(0, names.length), names, registry);
    const items = (tree.get('/Names') as PdfArray).items;
    return items.filter((_, i) => i % 2 === 0) as PdfString[];
  }

  it('writes each key as a PDF text string', () => {
    const [key] = keysOf(['日本語.txt']);

    expect(key!.toBytes()).toEqual(PdfString.fromText('日本語.txt').toBytes());
    expect(key!.toText()).toBe('日本語.txt');
  });

  it('sorts the keys by their bytes and keeps each file with its key', () => {
    // PDFDocEncoding: the euro sign is byte 0xA0, "é" is 0xE9, "日" starts the UTF-16BE mark 0xFE 0xFF.
    const names = ['日.txt', 'é.txt', 'b.txt', '€.txt'];
    const tree = buildEmbeddedFilesNameTree(refs, names, registry);
    const items = (tree.get('/Names') as PdfArray).items;

    const keys = items.filter((_, i) => i % 2 === 0) as PdfString[];
    expect(keys.map((k) => k.toText())).toEqual(['b.txt', '€.txt', 'é.txt', '日.txt']);
    expect(items.filter((_, i) => i % 2 === 1)).toEqual([refs[2], refs[3], refs[1], refs[0]]);
    for (let i = 1; i < keys.length; i++) {
      expect(PdfString.compare(keys[i - 1]!, keys[i]!)).toBeLessThan(0);
    }
  });
});
