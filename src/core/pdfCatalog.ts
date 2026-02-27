/**
 * @module core/pdfCatalog
 *
 * Builds the PDF document catalog (`/Catalog`), page tree (`/Pages`),
 * and document information dictionary (`/Info`).
 *
 * Reference: PDF 1.7 spec, §7.7.2 (Document Catalog),
 *            §7.7.3 (Page Tree), §14.3.3 (Document Information Dictionary).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfString,
} from './pdfObjects.js';
import type { PdfObjectRegistry } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// PDF date formatting
// ---------------------------------------------------------------------------

/**
 * Format a `Date` as a PDF date string.
 *
 * PDF dates follow the form: `D:YYYYMMDDHHmmSSOHH'mm`
 *
 * - `O` is the relationship to UT: `+`, `-`, or `Z`.
 * - The trailing `HH'mm` is the UT offset.
 *
 * @param date  A JavaScript Date object.
 * @returns     A PDF date string wrapped in parentheses.
 */
export function formatPdfDate(date: Date): string {
  const pad2 = (n: number) => n.toString().padStart(2, '0');

  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  const seconds = pad2(date.getUTCSeconds());

  return `D:${year}${month}${day}${hours}${minutes}${seconds}Z`;
}

// ---------------------------------------------------------------------------
// Document metadata
// ---------------------------------------------------------------------------

/** Metadata fields for the /Info dictionary. */
export interface DocumentMetadata {
  title?: string | undefined;
  author?: string | undefined;
  subject?: string | undefined;
  keywords?: string | undefined;
  creator?: string | undefined;
  producer?: string | undefined;
  creationDate?: Date | undefined;
  modDate?: Date | undefined;
}

/**
 * Build the `/Info` dictionary from metadata.
 *
 * @param meta      Document metadata.
 * @param registry  Object registry — the info dict is registered as an
 *                  indirect object.
 * @returns         The indirect reference to the `/Info` dict.
 */
export function buildInfoDict(
  meta: DocumentMetadata,
  registry: PdfObjectRegistry,
): PdfRef {
  const dict = new PdfDict();

  if (meta.title !== undefined) {
    dict.set('/Title', PdfString.literal(meta.title));
  }
  if (meta.author !== undefined) {
    dict.set('/Author', PdfString.literal(meta.author));
  }
  if (meta.subject !== undefined) {
    dict.set('/Subject', PdfString.literal(meta.subject));
  }
  if (meta.keywords !== undefined) {
    dict.set('/Keywords', PdfString.literal(meta.keywords));
  }
  if (meta.creator !== undefined) {
    dict.set('/Creator', PdfString.literal(meta.creator));
  }

  // Producer — always set a default if not provided
  const producer = meta.producer ?? 'modern-pdf-lib';
  dict.set('/Producer', PdfString.literal(producer));

  if (meta.creationDate !== undefined) {
    dict.set('/CreationDate', PdfString.literal(formatPdfDate(meta.creationDate)));
  }
  if (meta.modDate !== undefined) {
    dict.set('/ModDate', PdfString.literal(formatPdfDate(meta.modDate)));
  }

  return registry.register(dict);
}

// ---------------------------------------------------------------------------
// Page tree
// ---------------------------------------------------------------------------

/**
 * Represents a single page's key refs for building the page tree.
 */
export interface PageEntry {
  /** Indirect reference for this page object. */
  readonly pageRef: PdfRef;
  /** Full media box `[llx, lly, urx, ury]`. */
  readonly mediaBox?: readonly [number, number, number, number] | undefined;
  /** Width of the page (points). */
  readonly width: number;
  /** Height of the page (points). */
  readonly height: number;
  /**
   * Content stream reference(s).
   *
   * A single PdfRef for newly created pages, or an array for loaded pages
   * that may have multiple content streams (or original + appended).
   */
  readonly contentStreamRefs: PdfRef | readonly PdfRef[];
  /** Resources dictionary (fonts, images, etc.). */
  readonly resources: PdfDict;
  /** Optional rotation in degrees (0, 90, 180, 270). */
  readonly rotation?: number | undefined;
  /** Optional crop box `[llx, lly, urx, ury]`. */
  readonly cropBox?: readonly [number, number, number, number] | undefined;
  /** Optional bleed box `[llx, lly, urx, ury]`. */
  readonly bleedBox?: readonly [number, number, number, number] | undefined;
  /** Optional art box `[llx, lly, urx, ury]`. */
  readonly artBox?: readonly [number, number, number, number] | undefined;
  /** Optional trim box `[llx, lly, urx, ury]`. */
  readonly trimBox?: readonly [number, number, number, number] | undefined;
  /** Optional annotation indirect references. */
  readonly annotationRefs?: readonly PdfRef[] | undefined;
}

/**
 * Build the `/Pages` tree and individual `/Page` dictionaries.
 *
 * This implementation uses a flat page tree (a single `/Pages` node)
 * which is correct for documents with up to several thousand pages.
 *
 * @param pages     Ordered list of page entries.
 * @param registry  Object registry.
 * @returns         The indirect reference to the root `/Pages` node.
 */
export function buildPageTree(
  pages: readonly PageEntry[],
  registry: PdfObjectRegistry,
): PdfRef {
  // Allocate the /Pages reference first so that child /Page dicts can
  // point back to their parent.
  const pagesRef = registry.allocate();

  const kids = new PdfArray();

  for (const page of pages) {
    const pageDict = new PdfDict();
    pageDict.set('/Type', PdfName.of('Page'));
    pageDict.set('/Parent', pagesRef);
    // MediaBox — use explicit mediaBox if provided, otherwise default [0,0,w,h]
    if (page.mediaBox !== undefined) {
      pageDict.set('/MediaBox', PdfArray.fromNumbers([...page.mediaBox]));
    } else {
      pageDict.set('/MediaBox', PdfArray.fromNumbers([0, 0, page.width, page.height]));
    }

    // /Contents — single ref or array of refs
    const csRefs = page.contentStreamRefs;
    if (csRefs instanceof PdfRef) {
      pageDict.set('/Contents', csRefs);
    } else if (csRefs.length === 1) {
      pageDict.set('/Contents', csRefs[0]!);
    } else if (csRefs.length > 1) {
      pageDict.set('/Contents', PdfArray.of([...csRefs]));
    }

    pageDict.set('/Resources', page.resources);

    // Optional rotation
    if (page.rotation !== undefined && page.rotation !== 0) {
      pageDict.set('/Rotate', PdfNumber.of(page.rotation));
    }

    // Optional crop box
    if (page.cropBox !== undefined) {
      pageDict.set('/CropBox', PdfArray.fromNumbers([...page.cropBox]));
    }

    // Optional bleed box
    if (page.bleedBox !== undefined) {
      pageDict.set('/BleedBox', PdfArray.fromNumbers([...page.bleedBox]));
    }

    // Optional art box
    if (page.artBox !== undefined) {
      pageDict.set('/ArtBox', PdfArray.fromNumbers([...page.artBox]));
    }

    // Optional trim box
    if (page.trimBox !== undefined) {
      pageDict.set('/TrimBox', PdfArray.fromNumbers([...page.trimBox]));
    }

    // Optional annotations
    if (page.annotationRefs !== undefined && page.annotationRefs.length > 0) {
      pageDict.set('/Annots', PdfArray.of([...page.annotationRefs]));
    }

    // Register the page dict with the pre-allocated ref
    registry.registerWithRef(page.pageRef, pageDict);
    kids.push(page.pageRef);
  }

  // Build the /Pages dict
  const pagesDict = new PdfDict();
  pagesDict.set('/Type', PdfName.of('Pages'));
  pagesDict.set('/Kids', kids);
  pagesDict.set('/Count', PdfNumber.of(pages.length));

  registry.assign(pagesRef, pagesDict);

  return pagesRef;
}

// ---------------------------------------------------------------------------
// Document catalog
// ---------------------------------------------------------------------------

/** Options for building the catalog. */
export interface CatalogOptions {
  /** Page layout hint. */
  pageLayout?:
    | 'SinglePage'
    | 'OneColumn'
    | 'TwoColumnLeft'
    | 'TwoColumnRight'
    | 'TwoPageLeft'
    | 'TwoPageRight'
    | undefined;
  /** Page mode hint. */
  pageMode?:
    | 'UseNone'
    | 'UseOutlines'
    | 'UseThumbs'
    | 'FullScreen'
    | 'UseOC'
    | 'UseAttachments'
    | undefined;
  /** The natural language of the document content (e.g. `en-US`). */
  lang?: string | undefined;
}

/**
 * Build the `/Catalog` dictionary.
 *
 * @param pagesRef  Indirect reference to the root `/Pages` node.
 * @param registry  Object registry.
 * @param options   Optional catalog-level settings.
 * @returns         The indirect reference to the `/Catalog` dict.
 */
export function buildCatalog(
  pagesRef: PdfRef,
  registry: PdfObjectRegistry,
  options?: CatalogOptions,
): PdfRef {
  const catalog = new PdfDict();
  catalog.set('/Type', PdfName.of('Catalog'));
  catalog.set('/Pages', pagesRef);

  if (options?.pageLayout !== undefined) {
    catalog.set('/PageLayout', PdfName.of(options.pageLayout));
  }
  if (options?.pageMode !== undefined) {
    catalog.set('/PageMode', PdfName.of(options.pageMode));
  }
  if (options?.lang !== undefined) {
    catalog.set('/Lang', PdfString.literal(options.lang));
  }

  return registry.register(catalog);
}

// ---------------------------------------------------------------------------
// Full document structure builder
// ---------------------------------------------------------------------------

/**
 * High-level helper that wires together the catalog, page tree, and info
 * dict, returning all the references the writer needs.
 */
export interface DocumentStructure {
  /** Reference to the /Catalog. */
  catalogRef: PdfRef;
  /** Reference to the /Info dict. */
  infoRef: PdfRef;
  /** Reference to the /Pages node. */
  pagesRef: PdfRef;
}

/**
 * Build the complete document structure.
 *
 * @param pages     Page entries (already have refs allocated).
 * @param meta      Document metadata.
 * @param registry  Object registry.
 * @param options   Optional catalog settings.
 */
export function buildDocumentStructure(
  pages: readonly PageEntry[],
  meta: DocumentMetadata,
  registry: PdfObjectRegistry,
  options?: CatalogOptions,
): DocumentStructure {
  const pagesRef = buildPageTree(pages, registry);
  const catalogRef = buildCatalog(pagesRef, registry, options);
  const infoRef = buildInfoDict(meta, registry);

  return { catalogRef, infoRef, pagesRef };
}
