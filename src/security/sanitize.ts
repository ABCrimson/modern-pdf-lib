/**
 * @module security/sanitize
 *
 * PDF sanitizer — produce a cleaned copy of a PDF with active / hidden
 * content neutralised.
 *
 * The sanitizer removes four classes of potentially dangerous or
 * privacy-leaking content from a document, each independently toggleable:
 *
 * - **javascript** — document-level JavaScript: the catalog's
 *   `/Names → /JavaScript` name tree (ISO 32000-1 §7.7.4 / §12.6.4.16)
 *   and the catalog's `/AA` (document additional-actions) dictionary
 *   (§12.6.3) plus any page-level `/AA`.
 * - **openActions** — the catalog's auto-run `/OpenAction` (§12.3.4 / §12.6.4).
 * - **embeddedFiles** — embedded file attachments: the catalog's
 *   `/Names → /EmbeddedFiles` name tree (§7.7.4 / §7.11.4) and the
 *   PDF 2.0 catalog `/AF` (associated files) array (§7.11.4).
 * - **metadata** — the XMP `/Metadata` stream (§14.3.2) and the document
 *   information `/Info` dictionary (§14.3.3).
 *
 * Implementation strategy (verified against this library's parser/writer):
 * the cleaned bytes are produced by mutating the *parsed object graph* in
 * place and re-serializing the registry directly through
 * {@link serializePdf}, **without** rebuilding the catalog. This is what
 * lets a disabled option genuinely preserve its content — the original
 * catalog (minus the removed references) is written verbatim.
 *
 * Removing a reference from the catalog is not sufficient on its own: the
 * underlying object (a JavaScript action dictionary, an `/EmbeddedFile`
 * stream, an XMP metadata stream, …) would otherwise remain physically
 * present in the output as an orphan. To guarantee the payload bytes are
 * actually gone, after deleting references this module runs the registry's
 * reachability filter from the catalog + info roots, dropping every object
 * no longer referenced.
 *
 * @packageDocumentation
 */

import { loadPdf } from '../parser/documentParser.js';
import { serializePdf } from '../core/pdfWriter.js';
import type { PdfSaveOptions } from '../core/pdfWriter.js';
import type { DocumentStructure } from '../core/pdfCatalog.js';
import { buildInfoDict } from '../core/pdfCatalog.js';
import type { DocumentMetadata } from '../core/pdfCatalog.js';
import {
  PdfDict,
  PdfName,
  PdfRef,
  PdfArray,
  PdfStream,
  PdfString,
} from '../core/pdfObjects.js';
import type {
  PdfObject,
  PdfObjectRegistry,
} from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Options controlling which classes of content the sanitizer removes.
 *
 * Every flag defaults to `true` — i.e. by default all four classes are
 * stripped. Set a flag to `false` to preserve that class.
 */
export interface SanitizeOptions {
  /** Remove document JavaScript (`/Names /JavaScript` + `/AA`). Default `true`. */
  javascript?: boolean | undefined;
  /** Remove the auto-run `/OpenAction`. Default `true`. */
  openActions?: boolean | undefined;
  /** Remove embedded files (`/Names /EmbeddedFiles` + `/AF`). Default `true`. */
  embeddedFiles?: boolean | undefined;
  /** Strip the XMP `/Metadata` stream + the `/Info` dictionary. Default `true`. */
  metadata?: boolean | undefined;
}

/** Identifies a class of content that the sanitizer can remove. */
export type SanitizeClass =
  | 'javascript'
  | 'openActions'
  | 'embeddedFiles'
  | 'metadata';

/** A human-readable summary of what {@link sanitizePdf} actually removed. */
export interface SanitizeReport {
  /**
   * The classes of content that were present in the source PDF and have
   * been removed. Only classes that were actually present (and enabled)
   * appear here — a clean document yields an empty array.
   */
  removed: SanitizeClass[];
}

// ---------------------------------------------------------------------------
// Internal: resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a {@link PdfObject} that may be an indirect reference to its
 * underlying value using the registry. Non-refs are returned as-is.
 * Returns `undefined` if a ref cannot be resolved.
 */
function resolve(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfObject | undefined {
  if (obj === undefined) return undefined;
  if (obj instanceof PdfRef) return registry.resolve(obj);
  return obj;
}

/** Resolve `obj` and return it only if it is a {@link PdfDict}. */
function asDict(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfDict | undefined {
  const resolved = resolve(obj, registry);
  return resolved instanceof PdfDict ? resolved : undefined;
}

/** Read a {@link PdfString} value, resolving an indirect reference if needed. */
function asStringValue(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): string | undefined {
  const resolved = resolve(obj, registry);
  return resolved instanceof PdfString ? resolved.value : undefined;
}

// ---------------------------------------------------------------------------
// Internal: catalog discovery
// ---------------------------------------------------------------------------

/**
 * The catalog dictionary plus its indirect reference, as found in the
 * registry. The reference is required to seed the writer's trailer
 * (`/Root`) and the reachability walk.
 */
interface CatalogEntry {
  ref: PdfRef;
  dict: PdfDict;
}

/**
 * Collect every distinct `/Type /Catalog` dictionary registered in the
 * document, paired with its reference. A well-formed PDF has exactly one,
 * but malformed or incrementally-updated files can register more than one;
 * sanitizing all of them is the conservative, correct choice. The first
 * entry is treated as the document root.
 */
function findCatalogEntries(registry: PdfObjectRegistry): CatalogEntry[] {
  const byObjNum = new Map<number, CatalogEntry>();
  for (const { ref, object } of registry) {
    if (object instanceof PdfDict) {
      const type = object.get('/Type');
      if (type instanceof PdfName && type.value === '/Catalog') {
        // De-duplicate by object number (the parser may register the same
        // catalog object more than once during page-tree resolution).
        if (!byObjNum.has(ref.objectNumber)) {
          byObjNum.set(ref.objectNumber, { ref, dict: object });
        }
      }
    }
  }
  return [...byObjNum.values()];
}

/** Collect every distinct `/Type /Page` dictionary in the registry. */
function findPages(registry: PdfObjectRegistry): PdfDict[] {
  const pages = new Set<PdfDict>();
  for (const { object } of registry) {
    if (object instanceof PdfDict) {
      const type = object.get('/Type');
      if (type instanceof PdfName && type.value === '/Page') {
        pages.add(object);
      }
    }
  }
  return [...pages];
}

// ---------------------------------------------------------------------------
// Internal: name-tree presence detection
// ---------------------------------------------------------------------------

/**
 * Determine whether a PDF name tree (ISO 32000-1 §7.7.4) contains at least
 * one entry. A name-tree node holds either a `/Names` array of
 * `[key value key value …]` pairs (leaf) or a `/Kids` array of child node
 * references (intermediate). The tree is walked recursively with a visited
 * guard against cyclic references in malformed files.
 */
function nameTreeHasEntries(
  node: PdfObject | undefined,
  registry: PdfObjectRegistry,
  visited: Set<PdfDict> = new Set(),
): boolean {
  const dict = asDict(node, registry);
  if (dict === undefined || visited.has(dict)) return false;
  visited.add(dict);

  const names = resolve(dict.get('/Names'), registry);
  if (names instanceof PdfArray && names.length >= 2) {
    return true;
  }

  const kids = resolve(dict.get('/Kids'), registry);
  if (kids instanceof PdfArray) {
    for (const kid of kids.items) {
      if (nameTreeHasEntries(kid, registry, visited)) return true;
    }
  }

  return false;
}

/** Return the catalog's resolved `/Names` sub-dictionary, if present. */
function getNamesDict(
  catalog: PdfDict,
  registry: PdfObjectRegistry,
): PdfDict | undefined {
  return asDict(catalog.get('/Names'), registry);
}

// ---------------------------------------------------------------------------
// Internal: action (JavaScript) detection
// ---------------------------------------------------------------------------

/**
 * Determine whether an additional-actions (`/AA`) dictionary contains any
 * action whose `/S` (action type) is `/JavaScript`. Each value in an `/AA`
 * dictionary is itself an action dictionary (§12.6.3).
 */
function aaHasJavaScript(
  aa: PdfDict | undefined,
  registry: PdfObjectRegistry,
): boolean {
  if (aa === undefined) return false;
  for (const [, value] of aa) {
    const action = asDict(value, registry);
    if (action === undefined) continue;
    const s = action.get('/S');
    if (s instanceof PdfName && s.value === '/JavaScript') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Internal: /Info metadata extraction
// ---------------------------------------------------------------------------

/**
 * Descriptive `/Info` keys that constitute identifying metadata. The
 * auto-generated `/Producer`, `/CreationDate`, and `/ModDate` are NOT
 * treated as "present" for reporting purposes: a freshly created document
 * carries those by default and must still be considered clean. (When
 * metadata removal runs, the entire `/Info` dict is dropped regardless.)
 */
const DESCRIPTIVE_INFO_KEYS = [
  '/Title',
  '/Author',
  '/Subject',
  '/Keywords',
  '/Creator',
] as const;

/**
 * Locate the trailer's `/Info` dictionary in the registry. The parser does
 * not expose the trailer publicly, so the Info dict is identified
 * structurally: it is a dictionary that is NOT a catalog/page/pages node
 * and carries at least one recognised document-information key.
 */
function findInfoDict(
  registry: PdfObjectRegistry,
  catalogs: readonly CatalogEntry[],
): PdfDict | undefined {
  const catalogDicts = new Set(catalogs.map((c) => c.dict));
  const INFO_KEYS = [
    '/Title',
    '/Author',
    '/Subject',
    '/Keywords',
    '/Creator',
    '/Producer',
    '/CreationDate',
    '/ModDate',
    '/Trapped',
  ];
  for (const { object } of registry) {
    if (!(object instanceof PdfDict) || catalogDicts.has(object)) continue;
    const type = object.get('/Type');
    if (type instanceof PdfName) {
      // /Info dicts are typeless; anything with a structural /Type is not one.
      const v = type.value;
      if (v === '/Catalog' || v === '/Pages' || v === '/Page' || v === '/Font') {
        continue;
      }
    }
    if (INFO_KEYS.some((k) => object.has(k))) {
      return object;
    }
  }
  return undefined;
}

/** Read descriptive metadata from an `/Info` dict into a typed bag. */
function readInfoMetadata(
  info: PdfDict | undefined,
  registry: PdfObjectRegistry,
): DocumentMetadata {
  const meta: DocumentMetadata = {};
  if (info === undefined) return meta;
  const title = asStringValue(info.get('/Title'), registry);
  if (title !== undefined) meta.title = title;
  const author = asStringValue(info.get('/Author'), registry);
  if (author !== undefined) meta.author = author;
  const subject = asStringValue(info.get('/Subject'), registry);
  if (subject !== undefined) meta.subject = subject;
  const keywords = asStringValue(info.get('/Keywords'), registry);
  if (keywords !== undefined) meta.keywords = keywords;
  const creator = asStringValue(info.get('/Creator'), registry);
  if (creator !== undefined) meta.creator = creator;
  const producer = asStringValue(info.get('/Producer'), registry);
  if (producer !== undefined) meta.producer = producer;
  return meta;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce a cleaned copy of a PDF with active / hidden content neutralised.
 *
 * Loads the PDF, removes each enabled class of content from the parsed
 * object graph, prunes the orphaned objects, re-serializes the cleaned
 * document, and returns the new bytes alongside a report listing the
 * classes that were actually present and removed.
 *
 * @param pdf      The source PDF bytes.
 * @param options  Which classes to remove (each defaults to `true`).
 * @returns        The cleaned PDF bytes and a {@link SanitizeReport}.
 *
 * @example
 * ```ts
 * const { pdf, report } = await sanitizePdf(bytes);
 * // report.removed === ['javascript', 'embeddedFiles', 'metadata']
 * ```
 */
export async function sanitizePdf(
  pdf: Uint8Array,
  options?: SanitizeOptions,
): Promise<{ pdf: Uint8Array; report: SanitizeReport }> {
  const removeJavaScript = options?.javascript ?? true;
  const removeOpenActions = options?.openActions ?? true;
  const removeEmbeddedFiles = options?.embeddedFiles ?? true;
  const removeMetadata = options?.metadata ?? true;

  const doc = await loadPdf(pdf);
  const registry = doc.getRegistry();
  const catalogs = findCatalogEntries(registry);

  if (catalogs.length === 0) {
    // No catalog → nothing structural to sanitize. Return the input as-is
    // rather than fabricate a removal we did not perform.
    return { pdf, report: { removed: [] } };
  }

  const pages = findPages(registry);
  const infoDict = findInfoDict(registry, catalogs);
  const removed = new Set<SanitizeClass>();

  // ---- 1. Document JavaScript: /Names /JavaScript name tree + /AA -------
  if (removeJavaScript) {
    for (const { dict: catalog } of catalogs) {
      const names = getNamesDict(catalog, registry);
      if (names !== undefined && nameTreeHasEntries(names.get('/JavaScript'), registry)) {
        removed.add('javascript');
      }
      if (aaHasJavaScript(asDict(catalog.get('/AA'), registry), registry)) {
        removed.add('javascript');
      }
    }
    for (const page of pages) {
      if (aaHasJavaScript(asDict(page.get('/AA'), registry), registry)) {
        removed.add('javascript');
      }
    }

    for (const { dict: catalog } of catalogs) {
      const names = getNamesDict(catalog, registry);
      if (names !== undefined) {
        names.delete('/JavaScript');
        if (names.size === 0) catalog.delete('/Names');
      }
      catalog.delete('/AA');
    }
    for (const page of pages) {
      page.delete('/AA');
    }
  }

  // ---- 2. Auto-run /OpenAction -----------------------------------------
  if (removeOpenActions) {
    for (const { dict: catalog } of catalogs) {
      if (catalog.has('/OpenAction')) {
        removed.add('openActions');
        catalog.delete('/OpenAction');
      }
    }
  }

  // ---- 3. Embedded files: /Names /EmbeddedFiles name tree + /AF --------
  if (removeEmbeddedFiles) {
    for (const { dict: catalog } of catalogs) {
      const names = getNamesDict(catalog, registry);
      if (names !== undefined && nameTreeHasEntries(names.get('/EmbeddedFiles'), registry)) {
        removed.add('embeddedFiles');
      }
      const af = resolve(catalog.get('/AF'), registry);
      if (af instanceof PdfArray && af.length > 0) {
        removed.add('embeddedFiles');
      }
    }

    for (const { dict: catalog } of catalogs) {
      const names = getNamesDict(catalog, registry);
      if (names !== undefined) {
        names.delete('/EmbeddedFiles');
        if (names.size === 0) catalog.delete('/Names');
      }
      catalog.delete('/AF');
    }
  }

  // ---- 4. Metadata: XMP /Metadata stream + /Info dictionary ------------
  // Preserve the descriptive metadata so a disabled `metadata` option can
  // round-trip it back into a rebuilt /Info dict.
  const preservedMeta = readInfoMetadata(infoDict, registry);

  if (removeMetadata) {
    let metadataPresent = false;

    for (const { dict: catalog } of catalogs) {
      if (resolve(catalog.get('/Metadata'), registry) instanceof PdfStream) {
        metadataPresent = true;
      }
    }
    if (
      infoDict !== undefined &&
      DESCRIPTIVE_INFO_KEYS.some((k) => infoDict.has(k))
    ) {
      metadataPresent = true;
    }
    if (metadataPresent) removed.add('metadata');

    // Strip the XMP /Metadata reference from every catalog.
    for (const { dict: catalog } of catalogs) {
      catalog.delete('/Metadata');
    }
    // Empty the /Info dict (it is dropped from the trailer below).
    if (infoDict !== undefined) {
      for (const [key] of [...infoDict]) infoDict.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // Re-serialize the mutated registry directly (no catalog rebuild).
  // -----------------------------------------------------------------------
  const root = catalogs[0]!;
  const pagesRef = root.dict.get('/Pages');

  // Build the /Info reference for the trailer.
  let infoRef: PdfRef;
  if (removeMetadata) {
    // Fresh, empty info dict (producer only — no leaked descriptive fields).
    infoRef = buildInfoDict({}, registry);
  } else {
    // Preserve the original descriptive metadata.
    infoRef = buildInfoDict(preservedMeta, registry);
  }

  const structure: DocumentStructure = {
    catalogRef: root.ref,
    infoRef,
    // `pagesRef` should always be an indirect reference in a valid PDF; if
    // it is not (malformed file), fall back to the catalog ref so the
    // writer's object-stream protection list still receives a valid ref.
    pagesRef: pagesRef instanceof PdfRef ? pagesRef : root.ref,
  };

  // Drop objects orphaned by the deletions above so their bytes do not
  // linger in the output. Walk from the catalog + the new info dict.
  registry.filterReachable([structure.catalogRef, structure.infoRef]);

  const saveOptions: PdfSaveOptions = { compress: true };
  const cleaned = await serializePdf(registry, structure, saveOptions);

  return { pdf: cleaned, report: { removed: [...removed] } };
}
