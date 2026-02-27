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
  PdfName,
  PdfString,
  PdfRef,
  PdfStream,
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
    expect((fObj as PdfString).value).toBe('report.pdf');
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
    expect((descObj as PdfString).value).toBe('Test data file');
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
    const nameTree = buildEmbeddedFilesNameTree(
      [ref1, ref2],
      ['hello.txt', 'data.json'],
      registry,
    );

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

    // Check first file
    expect(attachments[0]!.name).toBe('hello.txt');
    expect(new TextDecoder().decode(attachments[0]!.data)).toBe('Hello!');
    expect(attachments[0]!.description).toBe('A greeting');

    // Check second file
    expect(attachments[1]!.name).toBe('data.json');
    expect(new TextDecoder().decode(attachments[1]!.data)).toBe('{"key": "value"}');
  });
});
