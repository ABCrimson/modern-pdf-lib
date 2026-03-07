/**
 * Tests for PDF/A-3 Associated Files (/AF) support.
 *
 * Covers:
 * - createAssociatedFile returns fileSpecRef and streamRef
 * - createAssociatedFile creates file spec with correct /Type
 * - createAssociatedFile sets /AFRelationship
 * - createAssociatedFile sets /F and /UF filenames
 * - createAssociatedFile embeds the correct data
 * - createAssociatedFile handles description
 * - createAssociatedFile handles creation date
 * - createAssociatedFile handles modification date
 * - buildAfArray creates PdfArray from refs
 * - All AFRelationship values are valid
 * - createAssociatedFile works with XML data (ZUGFeRD use case)
 * - createAssociatedFile works with binary data
 */

import { describe, it, expect } from 'vitest';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfStream,
  PdfName,
  PdfString,
  PdfNumber,
  PdfArray,
  PdfRef,
} from '../../src/core/pdfObjects.js';
import {
  createAssociatedFile,
  buildAfArray,
} from '../../src/compliance/associatedFiles.js';
import type {
  AFRelationship,
  AssociatedFileOptions,
} from '../../src/compliance/associatedFiles.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function makeRegistry(): PdfObjectRegistry {
  return new PdfObjectRegistry();
}

function makeOptions(overrides?: Partial<AssociatedFileOptions>): AssociatedFileOptions {
  return {
    data: encoder.encode('hello world'),
    filename: 'test.txt',
    mimeType: 'text/plain',
    relationship: 'Unspecified',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAssociatedFile', () => {
  it('returns fileSpecRef and streamRef', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(registry, makeOptions());

    expect(result.fileSpecRef).toBeInstanceOf(PdfRef);
    expect(result.streamRef).toBeInstanceOf(PdfRef);
    // They should be different objects with different object numbers
    expect(result.fileSpecRef.objectNumber).not.toBe(result.streamRef.objectNumber);
  });

  it('creates file spec with correct /Type', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(registry, makeOptions());

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    expect(fileSpec).toBeInstanceOf(PdfDict);

    const typeEntry = fileSpec.get('/Type') as PdfName;
    expect(typeEntry).toBeInstanceOf(PdfName);
    expect(typeEntry.value).toBe('/Filespec');
  });

  it('sets /AFRelationship correctly', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ relationship: 'Alternative' }),
    );

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    const rel = fileSpec.get('/AFRelationship') as PdfName;
    expect(rel).toBeInstanceOf(PdfName);
    expect(rel.value).toBe('/Alternative');
  });

  it('sets /F and /UF filenames', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ filename: 'invoice.xml' }),
    );

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;

    const f = fileSpec.get('/F') as PdfString;
    expect(f).toBeInstanceOf(PdfString);
    expect(f.value).toBe('invoice.xml');

    const uf = fileSpec.get('/UF') as PdfString;
    expect(uf).toBeInstanceOf(PdfString);
    expect(uf.value).toBe('invoice.xml');
  });

  it('embeds the correct data in the stream', () => {
    const registry = makeRegistry();
    const data = encoder.encode('test data payload');
    const result = createAssociatedFile(registry, makeOptions({ data }));

    const stream = registry.resolve(result.streamRef) as PdfStream;
    expect(stream).toBeInstanceOf(PdfStream);
    expect(stream.data).toEqual(data);
  });

  it('handles description', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ description: 'ZUGFeRD invoice data' }),
    );

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    const desc = fileSpec.get('/Desc') as PdfString;
    expect(desc).toBeInstanceOf(PdfString);
    expect(desc.value).toBe('ZUGFeRD invoice data');
  });

  it('omits /Desc when description is not provided', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(registry, makeOptions());

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    expect(fileSpec.has('/Desc')).toBe(false);
  });

  it('handles creation date', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ creationDate: '20260301120000' }),
    );

    const stream = registry.resolve(result.streamRef) as PdfStream;
    const params = stream.dict.get('/Params') as PdfDict;
    expect(params).toBeInstanceOf(PdfDict);

    const creationDate = params.get('/CreationDate') as PdfString;
    expect(creationDate).toBeInstanceOf(PdfString);
    expect(creationDate.value).toBe('D:20260301120000');
  });

  it('handles modification date', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ modificationDate: '20260307093000' }),
    );

    const stream = registry.resolve(result.streamRef) as PdfStream;
    const params = stream.dict.get('/Params') as PdfDict;
    expect(params).toBeInstanceOf(PdfDict);

    const modDate = params.get('/ModDate') as PdfString;
    expect(modDate).toBeInstanceOf(PdfString);
    expect(modDate.value).toBe('D:20260307093000');
  });

  it('sets /Size in params to the data length', () => {
    const registry = makeRegistry();
    const data = new Uint8Array(42);
    const result = createAssociatedFile(registry, makeOptions({ data }));

    const stream = registry.resolve(result.streamRef) as PdfStream;
    const params = stream.dict.get('/Params') as PdfDict;
    const size = params.get('/Size') as PdfNumber;
    expect(size).toBeInstanceOf(PdfNumber);
    expect(size.value).toBe(42);
  });

  it('sets the embedded file stream /Type and /Subtype correctly', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(
      registry,
      makeOptions({ mimeType: 'text/xml' }),
    );

    const stream = registry.resolve(result.streamRef) as PdfStream;
    const type = stream.dict.get('/Type') as PdfName;
    expect(type.value).toBe('/EmbeddedFile');

    const subtype = stream.dict.get('/Subtype') as PdfName;
    // text/xml -> text#2Fxml
    expect(subtype.value).toBe('/text#2Fxml');
  });

  it('sets /EF dictionary with /F and /UF pointing to the stream', () => {
    const registry = makeRegistry();
    const result = createAssociatedFile(registry, makeOptions());

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    const ef = fileSpec.get('/EF') as PdfDict;
    expect(ef).toBeInstanceOf(PdfDict);

    const fRef = ef.get('/F') as PdfRef;
    expect(fRef).toBeInstanceOf(PdfRef);
    expect(fRef.objectNumber).toBe(result.streamRef.objectNumber);

    const ufRef = ef.get('/UF') as PdfRef;
    expect(ufRef).toBeInstanceOf(PdfRef);
    expect(ufRef.objectNumber).toBe(result.streamRef.objectNumber);
  });

  it('works with XML data — ZUGFeRD / Factur-X use case', () => {
    const registry = makeRegistry();
    const xmlData = encoder.encode(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">' +
      '<rsm:ExchangedDocument><ram:ID>INV-2026-001</ram:ID></rsm:ExchangedDocument>' +
      '</rsm:CrossIndustryInvoice>',
    );

    const result = createAssociatedFile(registry, {
      data: xmlData,
      filename: 'factur-x.xml',
      mimeType: 'text/xml',
      relationship: 'Alternative',
      description: 'Factur-X invoice data (BASIC profile)',
    });

    expect(result.fileSpecRef).toBeInstanceOf(PdfRef);
    expect(result.streamRef).toBeInstanceOf(PdfRef);

    // Verify the stream has the XML data
    const stream = registry.resolve(result.streamRef) as PdfStream;
    expect(stream.data).toEqual(xmlData);

    // Verify relationship
    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    const rel = fileSpec.get('/AFRelationship') as PdfName;
    expect(rel.value).toBe('/Alternative');

    // Verify description
    const desc = fileSpec.get('/Desc') as PdfString;
    expect(desc.value).toBe('Factur-X invoice data (BASIC profile)');
  });

  it('works with binary data', () => {
    const registry = makeRegistry();
    const binaryData = new Uint8Array(256);
    for (let i = 0; i < 256; i++) binaryData[i] = i;

    const result = createAssociatedFile(registry, {
      data: binaryData,
      filename: 'attachment.bin',
      mimeType: 'application/octet-stream',
      relationship: 'Supplement',
    });

    const stream = registry.resolve(result.streamRef) as PdfStream;
    expect(stream.data).toEqual(binaryData);
    expect(stream.data.length).toBe(256);

    const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
    const rel = fileSpec.get('/AFRelationship') as PdfName;
    expect(rel.value).toBe('/Supplement');
  });
});

describe('buildAfArray', () => {
  it('creates a PdfArray from file spec references', () => {
    const ref1 = PdfRef.of(10);
    const ref2 = PdfRef.of(20);
    const ref3 = PdfRef.of(30);

    const array = buildAfArray([ref1, ref2, ref3]);

    expect(array).toBeInstanceOf(PdfArray);
    expect(array.length).toBe(3);
    expect(array.items[0]).toBe(ref1);
    expect(array.items[1]).toBe(ref2);
    expect(array.items[2]).toBe(ref3);
  });

  it('creates an empty PdfArray when given no refs', () => {
    const array = buildAfArray([]);
    expect(array).toBeInstanceOf(PdfArray);
    expect(array.length).toBe(0);
  });
});

describe('AFRelationship values', () => {
  const allRelationships: AFRelationship[] = [
    'Source',
    'Data',
    'Alternative',
    'Supplement',
    'EncryptedPayload',
    'FormData',
    'Schema',
    'Unspecified',
  ];

  it.each(allRelationships)(
    'creates a valid associated file with relationship "%s"',
    (relationship) => {
      const registry = makeRegistry();
      const result = createAssociatedFile(
        registry,
        makeOptions({ relationship }),
      );

      const fileSpec = registry.resolve(result.fileSpecRef) as PdfDict;
      const rel = fileSpec.get('/AFRelationship') as PdfName;
      expect(rel.value).toBe(`/${relationship}`);
    },
  );
});
