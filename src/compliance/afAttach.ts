/**
 * @module compliance/afAttach
 *
 * Attach embedded / associated files to any PDF object.
 *
 * The Associated Files mechanism (`/AF`) lets a PDF declare that one or more
 * embedded files are *associated* with a given object.  ISO 32000-2 allows the
 * `/AF` key on the document catalog (§7.11.4) as well as on individual objects
 * — page dictionaries, annotation dictionaries, Form/Image XObject stream
 * dictionaries, and structure elements (§14.13).  Because every one of those
 * targets is a plain {@link PdfDict}, the same helper attaches `/AF` uniformly.
 *
 * In addition, a *document-level* associated file must also be reachable
 * through the catalog's embedded-files name tree
 * (`/Names` → `/EmbeddedFiles` → `/Names`).  {@link createAssociatedFile} (in
 * `associatedFiles.ts`) intentionally leaves that wiring to the caller;
 * {@link registerEmbeddedFile} completes it.
 *
 * These are pure builders: they mutate the supplied dictionaries in place and
 * return nothing.  Object numbers / serialization remain the writer's concern.
 *
 * Reference: ISO 32000-2:2020, §7.11.4 (embedded file streams) and §14.13
 * (associated files).
 */

import { embeddedFileKeyEncoding } from '../core/embeddedFiles.js';
import { PdfDict, PdfArray, PdfString } from '../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../core/pdfObjects.js';
import { buildAfArray } from './associatedFiles.js';

// ---------------------------------------------------------------------------
// Generic /AF attachment
// ---------------------------------------------------------------------------

/**
 * Attach one or more associated files to any PDF object via its `/AF` key.
 *
 * Works uniformly for the document catalog, a page dictionary, an annotation
 * dictionary, a Form/Image XObject stream's dictionary, or a structure-element
 * dictionary — all of which are plain {@link PdfDict} instances.
 *
 * If `target` has no `/AF` yet, a fresh array (built with
 * {@link buildAfArray}) is set.  If `/AF` is already a {@link PdfArray}, the
 * new refs are appended to it, preserving the existing entries and order.  Any
 * other (malformed) `/AF` value is replaced with a fresh array.
 *
 * @param target        The object dictionary to attach the files to.
 * @param fileSpecRefs  Indirect references to file-specification dictionaries.
 */
export function attachAssociatedFiles(target: PdfDict, fileSpecRefs: readonly PdfRef[]): void {
  const existing = target.get('/AF');
  if (existing instanceof PdfArray) {
    for (const ref of fileSpecRefs) {
      existing.push(ref);
    }
    return;
  }
  target.set('/AF', buildAfArray([...fileSpecRefs]));
}

// ---------------------------------------------------------------------------
// Document-level embedded-file registration
// ---------------------------------------------------------------------------

/**
 * Locate the `/EmbeddedFiles` name-tree `/Names` array on the catalog,
 * creating the intermediate `/Names` and `/EmbeddedFiles` dictionaries (and
 * the leaf `/Names` array) if they do not yet exist.  Existing dictionaries
 * are reused in place rather than replaced.
 */
function ensureEmbeddedFilesNames(catalog: PdfDict): PdfArray {
  const namesEntry = catalog.get('/Names');
  const namesDict = namesEntry instanceof PdfDict ? namesEntry : new PdfDict();
  if (namesDict !== namesEntry) {
    catalog.set('/Names', namesDict);
  }

  const efEntry = namesDict.get('/EmbeddedFiles');
  const efDict = efEntry instanceof PdfDict ? efEntry : new PdfDict();
  if (efDict !== efEntry) {
    namesDict.set('/EmbeddedFiles', efDict);
  }

  const leafEntry = efDict.get('/Names');
  const leaf = leafEntry instanceof PdfArray ? leafEntry : new PdfArray();
  if (leaf !== leafEntry) {
    efDict.set('/Names', leaf);
  }

  return leaf;
}

/**
 * Insert a `[name, fileSpecRef]` pair into an embedded-files name-tree `/Names`
 * array, keeping the array sorted by name.  The array is a flat sequence of
 * alternating key/value entries: `[ name0, ref0, name1, ref1, … ]`.
 *
 * Every key is written in the one encoding `embeddedFileKeyEncoding` gives for
 * the names of the tree (a key already in the array is written again in it),
 * and the pairs are sorted by the bytes of their keys (ISO 32000-2 7.9.6), so
 * the byte order is the order of the text that qpdf checks. A pair whose key is
 * not a string keeps its place after the string keys.
 */
function insertNamePairSorted(leaf: PdfArray, name: string, fileSpecRef: PdfRef): void {
  const items = leaf.items;
  const pairs: { key: PdfObject; value: PdfObject | undefined }[] = [];
  for (const [i, key] of items.entries()) {
    if (i % 2 === 0) pairs.push({ key, value: items[i + 1] });
  }
  const encoding = embeddedFileKeyEncoding([
    ...pairs.flatMap(({ key }) => (key instanceof PdfString ? [key.toText()] : [])),
    name,
  ]);
  for (const pair of pairs) {
    if (pair.key instanceof PdfString) pair.key = PdfString.fromText(pair.key.toText(), encoding);
  }
  pairs.push({ key: PdfString.fromText(name, encoding), value: fileSpecRef });
  const sorted = pairs.toSorted((a, b) =>
    a.key instanceof PdfString
      ? b.key instanceof PdfString
        ? PdfString.compare(a.key, b.key)
        : -1
      : b.key instanceof PdfString
        ? 1
        : 0,
  );
  items.splice(
    0,
    items.length,
    ...sorted.flatMap(({ key, value }) => (value === undefined ? [key] : [key, value])),
  );
}

/**
 * Complete {@link createAssociatedFile}'s "caller responsibility" by wiring a
 * file-specification reference into the document catalog at the *document
 * level*.
 *
 * Two things happen:
 *  1. The pair `[name, fileSpecRef]` is added to the catalog's `/Names` →
 *     `/EmbeddedFiles` → `/Names` array, with every key of the array in one
 *     text-string encoding and the pairs sorted by the bytes of their keys
 *     (as required for a name tree).
 *     The intermediate dictionaries and the leaf array are created on demand
 *     and reused if already present.
 *  2. `fileSpecRef` is added to the catalog's `/AF` array (via
 *     {@link attachAssociatedFiles}).
 *
 * @param catalog      The document catalog dictionary.
 * @param name         The name under which the file is registered in the tree.
 * @param fileSpecRef  Indirect reference to the file-specification dictionary.
 * @throws {UnencodableTextError} For a name with a character no text string holds (a lone surrogate or U+001B),
 *   and for a key of the tree whose text holds one.
 */
export function registerEmbeddedFile(catalog: PdfDict, name: string, fileSpecRef: PdfRef): void {
  const leaf = ensureEmbeddedFilesNames(catalog);
  insertNamePairSorted(leaf, name, fileSpecRef);
  attachAssociatedFiles(catalog, [fileSpecRef]);
}
