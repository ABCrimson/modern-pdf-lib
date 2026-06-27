/**
 * Tests for AF (Associated Files) attachment helpers.
 *
 * Covers:
 * - attachAssociatedFiles: sets /AF on a fresh target, appends on a second call
 *   (works uniformly for catalog/page/annotation/XObject/structure dicts).
 * - registerEmbeddedFile: wires a file-spec into the catalog
 *   /Names/EmbeddedFiles name tree AND the catalog /AF array, keeping the
 *   name-tree pairs sorted by name.
 *
 * Reference: ISO 32000-2:2020 §7.11.4 (doc-level) and §14.13 (object-level).
 */

import { describe, it, expect } from 'vitest';
import {
  attachAssociatedFiles,
  registerEmbeddedFile,
} from '../../../src/compliance/afAttach.js';
import { createAssociatedFile } from '../../../src/compliance/associatedFiles.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfArray,
  PdfString,
  PdfRef,
} from '../../../src/core/pdfObjects.js';
import type { PdfObject } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asArray(obj: PdfObject | undefined): PdfArray {
  expect(obj).toBeInstanceOf(PdfArray);
  return obj as PdfArray;
}

function asDict(obj: PdfObject | undefined): PdfDict {
  expect(obj).toBeInstanceOf(PdfDict);
  return obj as PdfDict;
}

function makeFileSpec(registry: PdfObjectRegistry, filename: string): PdfRef {
  const { fileSpecRef } = createAssociatedFile(registry, {
    data: new TextEncoder().encode('<x/>'),
    filename,
    mimeType: 'text/xml',
    relationship: 'Data',
  });
  return fileSpecRef;
}

// ---------------------------------------------------------------------------
// attachAssociatedFiles
// ---------------------------------------------------------------------------

describe('attachAssociatedFiles', () => {
  it('sets /AF to an array of the file-spec refs on a fresh dict', () => {
    const registry = new PdfObjectRegistry();
    const ref = makeFileSpec(registry, 'data.xml');

    const target = new PdfDict();
    attachAssociatedFiles(target, [ref]);

    const af = asArray(target.get('/AF'));
    expect(af.length).toBe(1);
    expect(af.items[0]).toBe(ref);
  });

  it('appends to an existing /AF array on a second call (length grows)', () => {
    const registry = new PdfObjectRegistry();
    const ref1 = makeFileSpec(registry, 'a.xml');
    const ref2 = makeFileSpec(registry, 'b.xml');

    const target = new PdfDict();
    attachAssociatedFiles(target, [ref1]);
    attachAssociatedFiles(target, [ref2]);

    const af = asArray(target.get('/AF'));
    expect(af.length).toBe(2);
    expect(af.items[0]).toBe(ref1);
    expect(af.items[1]).toBe(ref2);
  });

  it('appends multiple refs at once and preserves order', () => {
    const registry = new PdfObjectRegistry();
    const ref1 = makeFileSpec(registry, 'a.xml');
    const ref2 = makeFileSpec(registry, 'b.xml');
    const ref3 = makeFileSpec(registry, 'c.xml');

    const target = new PdfDict();
    attachAssociatedFiles(target, [ref1]);
    attachAssociatedFiles(target, [ref2, ref3]);

    const af = asArray(target.get('/AF'));
    expect(af.length).toBe(3);
    expect(af.items).toEqual([ref1, ref2, ref3]);
  });

  it('works uniformly on an annotation/XObject-style dict', () => {
    const registry = new PdfObjectRegistry();
    const ref = makeFileSpec(registry, 'note.xml');

    // Any PdfDict works — here a synthetic annotation dict.
    const annot = new PdfDict();
    attachAssociatedFiles(annot, [ref]);

    expect(asArray(annot.get('/AF')).items[0]).toBe(ref);
  });

  it('is a no-op for /AF when given an empty ref list on a fresh dict', () => {
    const target = new PdfDict();
    attachAssociatedFiles(target, []);

    const af = asArray(target.get('/AF'));
    expect(af.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// registerEmbeddedFile
// ---------------------------------------------------------------------------

describe('registerEmbeddedFile', () => {
  it('adds the name+ref to /Names/EmbeddedFiles/Names and to catalog /AF', () => {
    const registry = new PdfObjectRegistry();
    const ref = makeFileSpec(registry, 'data.xml');

    const catalog = new PdfDict();
    registerEmbeddedFile(catalog, 'data.xml', ref);

    // /AF on the catalog contains the ref.
    const af = asArray(catalog.get('/AF'));
    expect(af.items).toContain(ref);

    // /Names -> /EmbeddedFiles -> /Names = [ name, ref ].
    const names = asDict(catalog.get('/Names'));
    const embeddedFiles = asDict(names.get('/EmbeddedFiles'));
    const efNames = asArray(embeddedFiles.get('/Names'));

    expect(efNames.length).toBe(2);
    const nameEntry = efNames.items[0];
    expect(nameEntry).toBeInstanceOf(PdfString);
    expect((nameEntry as PdfString).value).toBe('data.xml');
    expect(efNames.items[1]).toBe(ref);
  });

  it('appends additional files keeping the name tree sorted by name', () => {
    const registry = new PdfObjectRegistry();
    const refZ = makeFileSpec(registry, 'zebra.xml');
    const refA = makeFileSpec(registry, 'apple.xml');
    const refM = makeFileSpec(registry, 'mango.xml');

    const catalog = new PdfDict();
    registerEmbeddedFile(catalog, 'zebra.xml', refZ);
    registerEmbeddedFile(catalog, 'apple.xml', refA);
    registerEmbeddedFile(catalog, 'mango.xml', refM);

    const names = asDict(catalog.get('/Names'));
    const embeddedFiles = asDict(names.get('/EmbeddedFiles'));
    const efNames = asArray(embeddedFiles.get('/Names'));

    // 3 pairs => 6 entries.
    expect(efNames.length).toBe(6);

    const sortedNames = [
      (efNames.items[0] as PdfString).value,
      (efNames.items[2] as PdfString).value,
      (efNames.items[4] as PdfString).value,
    ];
    expect(sortedNames).toEqual(['apple.xml', 'mango.xml', 'zebra.xml']);

    // Each name is immediately followed by its own ref.
    expect(efNames.items[1]).toBe(refA);
    expect(efNames.items[3]).toBe(refM);
    expect(efNames.items[5]).toBe(refZ);

    // All three refs appear in the catalog /AF array.
    const af = asArray(catalog.get('/AF'));
    expect(af.items).toEqual(expect.arrayContaining([refA, refM, refZ]));
    expect(af.length).toBe(3);
  });

  it('reuses an existing /Names and /EmbeddedFiles dict when present', () => {
    const registry = new PdfObjectRegistry();
    const ref1 = makeFileSpec(registry, 'first.xml');
    const ref2 = makeFileSpec(registry, 'second.xml');

    const catalog = new PdfDict();
    registerEmbeddedFile(catalog, 'first.xml', ref1);
    const namesAfterFirst = catalog.get('/Names');

    registerEmbeddedFile(catalog, 'second.xml', ref2);
    const namesAfterSecond = catalog.get('/Names');

    // Same /Names dict object reused, not replaced.
    expect(namesAfterSecond).toBe(namesAfterFirst);

    const efNames = asArray(
      asDict(asDict(catalog.get('/Names')).get('/EmbeddedFiles')).get('/Names'),
    );
    expect(efNames.length).toBe(4);
  });
});
