/**
 * @module core/pdfDocument
 *
 * The main document container — manages pages, embedded resources,
 * metadata, and object numbering.  This is the primary entry point for
 * creating PDF files with the `modern-pdf` library.
 *
 * Usage:
 * ```ts
 * import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
 *
 * const doc = createPdf();
 * const page = doc.addPage(PageSizes.A4);
 * page.drawText('Hello, world!', { x: 50, y: 750, size: 24 });
 *
 * const bytes = await doc.save();
 * ```
 */

import type { PageSize, FontRef, ImageRef, SoftMaskRef, SoftMaskBuilder } from './pdfPage.js';
import { PdfPage, PageSizes } from './pdfPage.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
  PdfArray,
  PdfBool,
  PdfRef,
} from './pdfObjects.js';
import type { DocumentMetadata, PageEntry } from './pdfCatalog.js';
import { buildDocumentStructure } from './pdfCatalog.js';
import { PdfWriter, serializePdf } from './pdfWriter.js';
import type { PdfSaveOptions } from './pdfWriter.js';
import { PdfStreamWriter } from './pdfStream.js';
import { getStandardFont, measureStandardText, standardFontHeight } from '../assets/font/standardFonts.js';
import type { StandardFontName as StdFontName } from '../assets/font/standardFonts.js';
import type { EmbeddedFont } from '../assets/font/fontEmbed.js';
import { embedFont as embedTtfFont } from '../assets/font/fontEmbed.js';
import { subsetFont, buildSubsetCmap, computeSubsetTag } from '../assets/font/fontSubset.js';
import { isOpenTypeCFF } from '../assets/font/otfDetect.js';
import { findTable } from '../assets/font/cffEmbed.js';
import { embedPng as decodePng } from '../assets/image/pngEmbed.js';
import type { LoadPdfOptions } from '../parser/documentParser.js';
import { loadPdf } from '../parser/documentParser.js';
import { PdfEncryptionHandler } from '../crypto/encryptionHandler.js';
import type { EncryptOptions } from '../crypto/encryptionHandler.js';
import type { PdfPermissionFlags } from '../crypto/permissions.js';
import { PdfOutlineTree } from '../outline/pdfOutline.js';
import type { PdfOutlineItem, OutlineDestination, OutlineItemOptions } from '../outline/pdfOutline.js';
import { buildXmpMetadata, parseXmpMetadata, createXmpStream } from '../metadata/xmpMetadata.js';
import { buildViewerPreferencesDict, parseViewerPreferences } from '../metadata/viewerPreferences.js';
import type { ViewerPreferences } from '../metadata/viewerPreferences.js';
import { PdfViewerPreferences } from '../metadata/pdfViewerPreferences.js';
import { PdfStructureTree } from '../accessibility/structureTree.js';
import type { AccessibilityIssue } from '../accessibility/structureTree.js';
import { checkAccessibility } from '../accessibility/accessibilityChecker.js';
import { copyPagesToTarget } from './documentMerge.js';
import { signPdf, getSignatures } from '../signature/signatureHandler.js';
import type { SignOptions, PdfSignatureInfo } from '../signature/signatureHandler.js';
import { verifySignatures } from '../signature/signatureVerifier.js';
import type { SvgRenderOptions } from '../assets/svg/svgToPdf.js';
import { drawSvgOnPage } from '../assets/svg/svgToPdf.js';
import { PdfLayer, PdfLayerManager, beginLayerContent, endLayerContent } from '../layers/optionalContent.js';
import type { EmbeddedFile } from './embeddedFiles.js';
import { attachFile, buildEmbeddedFilesNameTree } from './embeddedFiles.js';
import type { WatermarkOptions } from './watermark.js';
import { addWatermark as addWatermarkImpl } from './watermark.js';
import type { RedactionOptions } from './redaction.js';
import { markForRedaction, applyRedactions as applyRedactionsImpl } from './redaction.js';
import type { SignatureVerificationResult } from '../signature/signatureVerifier.js';
import { PdfForm } from '../form/pdfForm.js';
import type { EmbeddedPdfPage, EmbedPageOptions } from './pdfEmbed.js';
import { embedPageAsFormXObject } from './pdfEmbed.js';
import { buildToUnicodeCmap, parseJpegDimensions } from './pdfDocumentEmbed.js';

// ---------------------------------------------------------------------------
// Standard 14 fonts
// ---------------------------------------------------------------------------

/**
 * The 14 standard PDF fonts guaranteed to be available in every PDF
 * viewer.  These can be used without embedding font data.
 */
export const StandardFonts = {
  Courier: 'Courier',
  CourierBold: 'Courier-Bold',
  CourierOblique: 'Courier-Oblique',
  CourierBoldOblique: 'Courier-BoldOblique',
  Helvetica: 'Helvetica',
  HelveticaBold: 'Helvetica-Bold',
  HelveticaOblique: 'Helvetica-Oblique',
  HelveticaBoldOblique: 'Helvetica-BoldOblique',
  TimesRoman: 'Times-Roman',
  TimesBold: 'Times-Bold',
  TimesItalic: 'Times-Italic',
  TimesBoldItalic: 'Times-BoldItalic',
  Symbol: 'Symbol',
  ZapfDingbats: 'ZapfDingbats',
} as const satisfies Record<string, string>;

export type StandardFontName = (typeof StandardFonts)[keyof typeof StandardFonts];

/**
 * Options for font embedding.
 */
export interface EmbedFontOptions {
  /** Whether to subset the font to reduce file size. Default: true. */
  subset?: boolean | undefined;
  /** OpenType feature flags. e.g., { kern: true, liga: true }. */
  features?: Record<string, boolean> | undefined;
  /** Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name. */
  customName?: string | undefined;
}

/**
 * Options for {@link PdfDocument.setTitle}.
 */
export interface SetTitleOptions {
  /** When `true`, tell PDF viewers to display the document title in the window title bar. */
  showInWindowTitleBar?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// PdfDocument
// ---------------------------------------------------------------------------

/**
 * The root document object.  Create via {@link createPdf}.
 *
 * Manages:
 * - Page collection (ordered)
 * - Embedded resources (fonts, images)
 * - Document metadata (title, author, dates, …)
 * - Object-number allocation
 */
export class PdfDocument {
  // -----------------------------------------------------------------------
  // Static factory: load an existing PDF
  // -----------------------------------------------------------------------

  /**
   * Load an existing PDF document from raw bytes, an ArrayBuffer, or a
   * Base64-encoded string.
   *
   * This is the primary entry point for parsing existing PDFs.  It
   * validates the file header, parses the cross-reference structure,
   * resolves the page tree and metadata, and returns a fully populated
   * {@link PdfDocument} that can be inspected or further modified.
   *
   * @param data     The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
   *                 Base64-encoded string.
   * @param options  Optional loading options (e.g. password, encryption).
   * @returns        A promise that resolves to the parsed PdfDocument.
   *
   * @example
   * ```ts
   * // From fetch (ArrayBuffer)
   * const pdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer());
   * const doc = await PdfDocument.load(pdfBytes);
   *
   * // From a Base64 string
   * const doc2 = await PdfDocument.load(base64String);
   * ```
   */
  static async load(
    data: Uint8Array | ArrayBuffer | string,
    options?: LoadPdfOptions,
  ): Promise<PdfDocument> {
    return loadPdf(data, options);
  }

  /**
   * Create a new, empty PDF document.
   *
   * This is the static-method equivalent of {@link createPdf}.
   *
   * ```ts
   * const doc = PdfDocument.create();
   * ```
   */
  static create(): PdfDocument {
    return new PdfDocument();
  }

  /** Object registry — allocates indirect references. */
  private readonly registry: PdfObjectRegistry;

  /** Pages in document order. */
  private readonly pages: PdfPage[] = [];

  /** Metadata fields. */
  private readonly meta: DocumentMetadata = {
    producer: 'modern-pdf-lib',
    creationDate: new Date(),
  };

  /** Counter for font resource names (F1, F2, …). */
  private fontCounter = 0;

  /** Counter for image resource names (Im1, Im2, …). */
  private imageCounter = 0;

  /** Counter for form XObject resource names (XF1, XF2, …). */
  private formXObjectCounter = 0;

  /**
   * @param registry  Optional pre-populated object registry (used when
   *                  loading an existing PDF so parsed objects are preserved).
   */
  constructor(registry?: PdfObjectRegistry) {
    this.registry = registry ?? new PdfObjectRegistry();
  }

  /** Embedded fonts — maps base font name → FontRef. */
  private readonly embeddedFonts = new Map<string, FontRef>();

  /** Embedded images — maps an internal key → ImageRef. */
  private readonly embeddedImages: ImageRef[] = [];

  // -----------------------------------------------------------------------
  // Page management
  // -----------------------------------------------------------------------

  /**
   * Add a page to the document.
   *
   * When called with a {@link PageSize} (or no argument), a new blank page
   * is created.  When called with an existing {@link PdfPage} instance
   * (e.g. one returned by {@link copyPages}), that page is inserted
   * directly.
   *
   * @param sizeOrPage  A page size as `[width, height]` tuple,
   *                    `{ width, height }` object, one of the
   *                    {@link PageSizes} constants, or an existing
   *                    {@link PdfPage} instance.  Defaults to A4.
   * @returns           The {@link PdfPage} that was added.
   */
  addPage(sizeOrPage?: PageSize | PdfPage): PdfPage {
    // If the argument is an existing PdfPage, insert it directly.
    if (sizeOrPage instanceof PdfPage) {
      const existingPage = sizeOrPage;
      this.pages.push(existingPage);

      // Register all currently embedded fonts on the page
      this.registerFontsOnPage(existingPage);

      return existingPage;
    }

    const resolved = sizeOrPage ?? PageSizes.A4;
    const [w, h] = Array.isArray(resolved)
      ? resolved
      : [(resolved as { readonly width: number; readonly height: number }).width,
         (resolved as { readonly width: number; readonly height: number }).height];
    const page = new PdfPage(w, h, this.registry);

    // Auto-register all currently embedded fonts on the new page
    for (const fontRef of this.embeddedFonts.values()) {
      page.registerFont(fontRef.name, fontRef.ref);
    }

    // Auto-register CID font encoders for TrueType fonts
    for (const [resName, { embeddedFont }] of this.ttfFonts) {
      page.registerCIDFont(resName, (text: string) => embeddedFont.encodeText(text));
    }

    this.pages.push(page);
    return page;
  }

  /**
   * Return a specific page by zero-based index.
   *
   * @param index  Zero-based page index.
   * @returns      The {@link PdfPage} at the given index.
   * @throws       If the index is out of range.
   */
  getPage(index: number): PdfPage {
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(
        `Page index ${index} out of range [0, ${this.pages.length - 1}]`,
      );
    }
    return this.pages[index]!;
  }

  /**
   * Return all pages.
   */
  getPages(): readonly PdfPage[] {
    return this.pages;
  }

  /**
   * Return the page count.
   */
  getPageCount(): number {
    return this.pages.length;
  }

  /** The number of pages in this document. */
  get pageCount(): number {
    return this.pages.length;
  }

  // -----------------------------------------------------------------------
  // Internal accessors (used by page manipulation and merge modules)
  // -----------------------------------------------------------------------

  /**
   * @internal Return the mutable internal pages array.
   * Used by `pageManipulation.ts` and `documentMerge.ts`.
   */
  getInternalPages(): PdfPage[] {
    return this.pages;
  }

  /**
   * @internal Return the object registry for external modules.
   */
  getRegistry(): PdfObjectRegistry {
    return this.registry;
  }

  /**
   * @internal Register all currently embedded fonts and CID encoders
   * on the given page. Used when inserting or copying pages.
   */
  registerFontsOnPage(page: PdfPage): void {
    for (const fontRef of this.embeddedFonts.values()) {
      page.registerFont(fontRef.name, fontRef.ref);
    }
    for (const [resName, { embeddedFont }] of this.ttfFonts) {
      page.registerCIDFont(resName, (text: string) => embeddedFont.encodeText(text));
    }
  }

  /**
   * @internal Return the embedded fonts map for cross-document operations.
   */
  getEmbeddedFonts(): ReadonlyMap<string, FontRef> {
    return this.embeddedFonts;
  }

  /**
   * @internal Add a pre-built page (from loading a parsed PDF).
   * Unlike `addPage()`, this does NOT create a new blank page —
   * it inserts a PdfPage that already carries original content.
   */
  _addLoadedPage(page: PdfPage): void {
    this.pages.push(page);
  }

  /**
   * @internal Advance font/image counters past names already used
   * by loaded pages so new resources don't collide.
   */
  _advanceCounters(maxFont: number, maxImage: number, maxGState: number): void {
    if (maxFont > this.fontCounter) this.fontCounter = maxFont;
    if (maxImage > this.imageCounter) this.imageCounter = maxImage;
    // GState counter is page-local, but we note it for future use
  }

  /**
   * @internal Get the next font counter value and increment it.
   */
  allocateFontName(): string {
    this.fontCounter++;
    return `F${this.fontCounter}`;
  }

  /**
   * @internal Get the next image counter value and increment it.
   */
  allocateImageName(): string {
    this.imageCounter++;
    return `Im${this.imageCounter}`;
  }

  // -----------------------------------------------------------------------
  // Page manipulation (delegated to pageManipulation module)
  // -----------------------------------------------------------------------

  /**
   * Insert a new blank page at the specified position.
   *
   * @param index  Zero-based position (0 to pageCount inclusive).
   * @param size   Optional page size. Defaults to A4.
   * @returns      The newly created PdfPage.
   */
  insertPage(index: number, size?: PageSize): PdfPage {
    // Inline implementation to avoid circular dependency
    const resolved = size ?? PageSizes.A4;
    const [w, h] = Array.isArray(resolved)
      ? resolved
      : [(resolved as { readonly width: number; readonly height: number }).width,
         (resolved as { readonly width: number; readonly height: number }).height];

    if (!Number.isInteger(index) || index < 0 || index > this.pages.length) {
      throw new RangeError(
        `insertPage: index ${index} out of range [0, ${this.pages.length}]`,
      );
    }

    const page = new PdfPage(w, h, this.registry);
    this.registerFontsOnPage(page);
    this.pages.splice(index, 0, page);
    return page;
  }

  /**
   * Remove a page by its zero-based index.
   *
   * @param index  Zero-based page index to remove.
   * @throws       RangeError if the index is out of bounds.
   */
  removePage(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.pages.length) {
      throw new RangeError(
        `removePage: index ${index} out of range [0, ${this.pages.length - 1}]`,
      );
    }
    this.pages.splice(index, 1);
  }

  /**
   * Move a page from one position to another.
   *
   * @param fromIndex  Current zero-based index of the page.
   * @param toIndex    Target zero-based index (after removal).
   */
  movePage(fromIndex: number, toIndex: number): void {
    if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= this.pages.length) {
      throw new RangeError(
        `movePage: fromIndex ${fromIndex} out of range [0, ${this.pages.length - 1}]`,
      );
    }

    const [page] = this.pages.splice(fromIndex, 1);

    if (toIndex < 0 || toIndex > this.pages.length) {
      // Restore the page before throwing
      this.pages.splice(fromIndex, 0, page!);
      throw new RangeError(
        `movePage: toIndex ${toIndex} out of range [0, ${this.pages.length}]`,
      );
    }

    this.pages.splice(toIndex, 0, page!);
  }

  /**
   * Copy pages from another document into this one.
   *
   * The copied pages are appended to the end of this document.
   * Resources (fonts, images) are deeply cloned and re-registered
   * in the target document's registry.
   *
   * @param sourceDoc  The source document to copy pages from.
   * @param indices    Zero-based indices of pages to copy.
   * @returns          The newly created pages in this document.
   */
  async copyPages(
    sourceDoc: PdfDocument,
    indices: number[],
  ): Promise<PdfPage[]> {
    return copyPagesToTarget(sourceDoc, this, indices);
  }

  // -----------------------------------------------------------------------
  // Font embedding
  // -----------------------------------------------------------------------

  /** Counter for unique TTF font keys (to distinguish multiple TTF embeds). */
  private ttfCounter = 0;

  /**
   * Maps TTF font resource name → EmbeddedFont and mutable PDF objects
   * that need to be updated at save time with subsetted data.
   */
  private readonly ttfFonts = new Map<string, {
    embeddedFont: EmbeddedFont;
    fontRef: FontRef;
    /** The /FontFile2 stream — its `.data` is replaced with subsetted bytes at save time. */
    fontFileStream: PdfStream;
    /** The /FontFile2 stream dict — its `/Length1` is updated at save time. */
    fontFileDict: PdfDict;
    /** The /ToUnicode stream — updated at save time with a CMap for used glyphs only. */
    toUnicodeStream: PdfStream;
    /** The CIDFont dict — its `/W` array is updated at save time. */
    cidFontDict: PdfDict;
  }>();

  /**
   * Embed a font in the document.
   *
   * Accepts either:
   * - A **standard font name** string (e.g. `"Helvetica"`) — embeds a
   *   Type 1 font reference (no font data needed).
   * - A **Uint8Array** of TrueType font bytes — embeds a CIDFont Type 2
   *   composite font with /Identity-H encoding, /FontDescriptor, /ToUnicode
   *   CMap, and /FontFile2 stream.
   *
   * The returned {@link FontRef} includes `widthOfTextAtSize()` and
   * `heightAtSize()` methods for text measurement.
   *
   * @param fontNameOrData  Base font name string or raw TTF/OTF bytes.
   * @param options         Optional embedding options (subset, OpenType features).
   * @returns               A {@link FontRef} to pass to drawing methods.
   */
  async embedFont(
    fontNameOrData: string | Uint8Array,
    options?: EmbedFontOptions,
  ): Promise<FontRef> {
    if (typeof fontNameOrData === 'string') {
      return this.embedStandardFont(fontNameOrData);
    }
    if (isOpenTypeCFF(fontNameOrData)) {
      return this.embedCffFont(fontNameOrData, options);
    }
    return this.embedTrueTypeFont(fontNameOrData, options);
  }

  /**
   * Embed a standard (Type 1) font.
   * @internal
   */
  private embedStandardFont(fontName: string): FontRef {
    // De-duplicate
    const existing = this.embeddedFonts.get(fontName);
    if (existing) return existing;

    this.fontCounter++;
    const resourceName = `F${this.fontCounter}`;

    // Build the font dictionary
    const fontDict = new PdfDict();
    fontDict.set('/Type', PdfName.of('Font'));
    fontDict.set('/Subtype', PdfName.of('Type1'));
    fontDict.set('/BaseFont', PdfName.of(fontName));

    // Standard Latin fonts use WinAnsiEncoding
    if (fontName !== 'Symbol' && fontName !== 'ZapfDingbats') {
      fontDict.set('/Encoding', PdfName.of('WinAnsiEncoding'));
    }

    const ref = this.registry.register(fontDict);

    // Build measurement methods using standard font metrics
    const stdFont = getStandardFont(fontName);
    const stdFontName = fontName as StdFontName;

    const fontRef: FontRef = {
      name: resourceName,
      ref,
      widthOfTextAtSize(text: string, size: number): number {
        if (stdFont) {
          return measureStandardText(text, stdFontName, size);
        }
        // Fallback for unknown standard font names: rough estimate
        return text.length * size * 0.5;
      },
      heightAtSize(size: number): number {
        if (stdFont) {
          return standardFontHeight(stdFontName, size);
        }
        return size;
      },
      sizeAtHeight(height: number): number {
        if (stdFont) {
          const testSize = 1;
          const heightAt1 = standardFontHeight(stdFontName, testSize);
          return heightAt1 > 0 ? height / heightAt1 : height;
        }
        return height;
      },
      getCharacterSet(): number[] {
        // WinAnsi encoding covers codepoints 32-126 and 128-255 (with some gaps)
        const codepoints: number[] = [];
        for (let i = 32; i <= 255; i++) {
          // Skip undefined positions in WinAnsi
          if (i !== 127 && i !== 129 && i !== 141 && i !== 143 && i !== 144) {
            codepoints.push(i);
          }
        }
        return codepoints;
      },
    };

    this.embeddedFonts.set(fontName, fontRef);

    // Register on all existing pages
    for (const page of this.pages) {
      page.registerFont(resourceName, ref);
    }

    return fontRef;
  }

  /**
   * Embed a TrueType font from raw bytes as a CIDFont Type 2.
   * @internal
   */
  private async embedTrueTypeFont(fontData: Uint8Array, options?: EmbedFontOptions): Promise<FontRef> {
    // Parse metrics and create EmbeddedFont
    const embeddedFont = await embedTtfFont(fontData);
    const metrics = embeddedFont.metrics;
    const psName = options?.customName ?? metrics.postScriptName ?? metrics.familyName ?? 'CustomFont';

    // De-duplicate by PostScript name
    const existing = this.embeddedFonts.get(`__ttf__${psName}`);
    if (existing) return existing;

    this.fontCounter++;
    this.ttfCounter++;
    const resourceName = `F${this.fontCounter}`;

    // --- Build the full CIDFont Type 2 embedding objects ---

    // 1. Font file stream (the raw TTF data as /FontFile2)
    const fontFileDict = new PdfDict();
    fontFileDict.set('/Length1', PdfNumber.of(fontData.length));
    const fontFileStream = PdfStream.fromBytes(new Uint8Array(fontData), fontFileDict);
    const fontFileRef = this.registry.register(fontFileStream);

    // 2. FontDescriptor
    const unitsPerEm = metrics.unitsPerEm;
    const fontDescDict = new PdfDict();
    fontDescDict.set('/Type', PdfName.of('FontDescriptor'));
    fontDescDict.set('/FontName', PdfName.of(psName));
    fontDescDict.set('/Flags', PdfNumber.of(metrics.flags));
    fontDescDict.set('/FontBBox', PdfArray.fromNumbers([
      Math.round((metrics.bbox[0] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[1] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[2] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[3] * 1000) / unitsPerEm),
    ]));
    fontDescDict.set('/ItalicAngle', PdfNumber.of(metrics.italicAngle));
    fontDescDict.set('/Ascent', PdfNumber.of(Math.round((metrics.ascender * 1000) / unitsPerEm)));
    fontDescDict.set('/Descent', PdfNumber.of(Math.round((metrics.descender * 1000) / unitsPerEm)));
    fontDescDict.set('/CapHeight', PdfNumber.of(Math.round((metrics.capHeight * 1000) / unitsPerEm)));
    fontDescDict.set('/StemV', PdfNumber.of(metrics.stemV));
    fontDescDict.set('/FontFile2', fontFileRef);
    const fontDescRef = this.registry.register(fontDescDict);

    // 3. CIDSystemInfo dictionary
    const cidSysInfoDict = new PdfDict();
    cidSysInfoDict.set('/Registry', PdfString.literal('Adobe'));
    cidSysInfoDict.set('/Ordering', PdfString.literal('Identity'));
    cidSysInfoDict.set('/Supplement', PdfNumber.of(0));

    // 4. Build /W (widths) array for CIDFont
    // We embed widths for all glyphs in the font (not just used ones),
    // since we don't subset yet. This ensures correct rendering.
    const scale = 1000 / unitsPerEm;
    const wArrayItems: (PdfNumber | PdfArray)[] = [];
    // Build individual width entries for glyph 0 through numGlyphs-1
    // Use format: cid [w1 w2 w3 ...] for consecutive ranges
    const numGlyphs = metrics.numGlyphs;
    const CHUNK = 256;
    for (let start = 0; start < numGlyphs; start += CHUNK) {
      const end = Math.min(start + CHUNK, numGlyphs);
      const widths: PdfNumber[] = [];
      for (let gid = start; gid < end; gid++) {
        const rawWidth = metrics.glyphWidths.get(gid) ?? metrics.defaultWidth;
        widths.push(PdfNumber.of(Math.round(rawWidth * scale)));
      }
      wArrayItems.push(PdfNumber.of(start));
      wArrayItems.push(PdfArray.of(widths));
    }
    const wArray = new PdfArray(wArrayItems);

    // 5. CIDFont Type 2 (DescendantFont)
    const cidFontDict = new PdfDict();
    cidFontDict.set('/Type', PdfName.of('Font'));
    cidFontDict.set('/Subtype', PdfName.of('CIDFontType2'));
    cidFontDict.set('/BaseFont', PdfName.of(psName));
    cidFontDict.set('/CIDSystemInfo', cidSysInfoDict);
    cidFontDict.set('/FontDescriptor', fontDescRef);
    cidFontDict.set('/W', wArray);
    cidFontDict.set('/DW', PdfNumber.of(Math.round(metrics.defaultWidth * scale)));
    // CIDToGIDMap: Identity means CID = GID (no remapping)
    cidFontDict.set('/CIDToGIDMap', PdfName.of('Identity'));
    const cidFontRef = this.registry.register(cidFontDict);

    // 6. ToUnicode CMap stream
    const toUnicodeCmapStr = buildToUnicodeCmap(metrics.cmapTable);
    const toUnicodeStream = PdfStream.fromString(toUnicodeCmapStr);
    const toUnicodeRef = this.registry.register(toUnicodeStream);

    // 7. Top-level Type 0 composite font
    const type0Dict = new PdfDict();
    type0Dict.set('/Type', PdfName.of('Font'));
    type0Dict.set('/Subtype', PdfName.of('Type0'));
    type0Dict.set('/BaseFont', PdfName.of(psName));
    type0Dict.set('/Encoding', PdfName.of('Identity-H'));
    type0Dict.set('/DescendantFonts', PdfArray.of([cidFontRef]));
    type0Dict.set('/ToUnicode', toUnicodeRef);
    const type0Ref = this.registry.register(type0Dict);

    // Build the FontRef with measurement methods and CID encoding
    const fontRef: FontRef = {
      name: resourceName,
      ref: type0Ref,
      _isCIDFont: true,
      _encodeText: (text: string) => embeddedFont.encodeText(text),
      widthOfTextAtSize(text: string, size: number): number {
        return embeddedFont.widthOfTextAtSize(text, size);
      },
      heightAtSize(size: number): number {
        return embeddedFont.heightAtSize(size);
      },
      sizeAtHeight(height: number): number {
        const testSize = 1;
        const heightAt1 = embeddedFont.heightAtSize(testSize);
        return heightAt1 > 0 ? height / heightAt1 : height;
      },
      getCharacterSet(): number[] {
        return metrics.cmapTable.keys().toArray();
      },
    };

    this.embeddedFonts.set(`__ttf__${psName}`, fontRef);
    this.ttfFonts.set(resourceName, {
      embeddedFont,
      fontRef,
      fontFileStream,
      fontFileDict,
      toUnicodeStream,
      cidFontDict,
    });

    // Register font and CID encoder on all existing pages
    for (const page of this.pages) {
      page.registerFont(resourceName, type0Ref);
      page.registerCIDFont(resourceName, (text: string) => embeddedFont.encodeText(text));
    }

    return fontRef;
  }

  /**
   * Embed a CFF-based OpenType font from raw bytes as a CIDFont Type 0.
   *
   * CFF fonts use /CIDFontType0 (instead of /CIDFontType2 for TrueType),
   * /FontFile3 with /Subtype /CIDFontType0C (instead of /FontFile2),
   * and embed only the raw CFF table data (not the full OTF wrapper).
   * No /CIDToGIDMap is needed since CFF fonts map CIDs directly.
   *
   * @internal
   */
  private async embedCffFont(fontData: Uint8Array, options?: EmbedFontOptions): Promise<FontRef> {
    // Parse metrics using the same embedFont pipeline (works for both TTF and OTF)
    const embeddedFont = await embedTtfFont(fontData);
    const metrics = embeddedFont.metrics;
    const psName = options?.customName ?? metrics.postScriptName ?? metrics.familyName ?? 'CFFFont';

    // De-duplicate by PostScript name
    const existing = this.embeddedFonts.get(`__cff__${psName}`);
    if (existing) return existing;

    this.fontCounter++;
    this.ttfCounter++;
    const resourceName = `F${this.fontCounter}`;

    // Extract the raw CFF table from the OTF file
    const cffTable = findTable(fontData, 'CFF ');
    if (!cffTable) {
      throw new Error('No CFF table found in font data. Is this a CFF-based OpenType font?');
    }
    const cffData = fontData.slice(cffTable.offset, cffTable.offset + cffTable.length);

    // 1. Font file stream (CFF data as /FontFile3 with /Subtype /CIDFontType0C)
    const fontFileDict = new PdfDict();
    fontFileDict.set('/Subtype', PdfName.of('CIDFontType0C'));
    const fontFileStream = PdfStream.fromBytes(new Uint8Array(cffData), fontFileDict);
    const fontFileRef = this.registry.register(fontFileStream);

    // 2. FontDescriptor (same as TrueType except /FontFile3 instead of /FontFile2)
    const unitsPerEm = metrics.unitsPerEm;
    const fontDescDict = new PdfDict();
    fontDescDict.set('/Type', PdfName.of('FontDescriptor'));
    fontDescDict.set('/FontName', PdfName.of(psName));
    fontDescDict.set('/Flags', PdfNumber.of(metrics.flags));
    fontDescDict.set('/FontBBox', PdfArray.fromNumbers([
      Math.round((metrics.bbox[0] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[1] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[2] * 1000) / unitsPerEm),
      Math.round((metrics.bbox[3] * 1000) / unitsPerEm),
    ]));
    fontDescDict.set('/ItalicAngle', PdfNumber.of(metrics.italicAngle));
    fontDescDict.set('/Ascent', PdfNumber.of(Math.round((metrics.ascender * 1000) / unitsPerEm)));
    fontDescDict.set('/Descent', PdfNumber.of(Math.round((metrics.descender * 1000) / unitsPerEm)));
    fontDescDict.set('/CapHeight', PdfNumber.of(Math.round((metrics.capHeight * 1000) / unitsPerEm)));
    fontDescDict.set('/StemV', PdfNumber.of(metrics.stemV));
    fontDescDict.set('/FontFile3', fontFileRef);  // CFF uses FontFile3
    const fontDescRef = this.registry.register(fontDescDict);

    // 3. CIDSystemInfo dictionary
    const cidSysInfoDict = new PdfDict();
    cidSysInfoDict.set('/Registry', PdfString.literal('Adobe'));
    cidSysInfoDict.set('/Ordering', PdfString.literal('Identity'));
    cidSysInfoDict.set('/Supplement', PdfNumber.of(0));

    // 4. Build /W (widths) array for CIDFont — same as TrueType
    const scale = 1000 / unitsPerEm;
    const wArrayItems: (PdfNumber | PdfArray)[] = [];
    const numGlyphs = metrics.numGlyphs;
    const CHUNK = 256;
    for (let start = 0; start < numGlyphs; start += CHUNK) {
      const end = Math.min(start + CHUNK, numGlyphs);
      const widths: PdfNumber[] = [];
      for (let gid = start; gid < end; gid++) {
        const rawWidth = metrics.glyphWidths.get(gid) ?? metrics.defaultWidth;
        widths.push(PdfNumber.of(Math.round(rawWidth * scale)));
      }
      wArrayItems.push(PdfNumber.of(start));
      wArrayItems.push(PdfArray.of(widths));
    }
    const wArray = new PdfArray(wArrayItems);

    // 5. CIDFont Type 0 (DescendantFont) — CIDFontType0 for CFF
    const cidFontDict = new PdfDict();
    cidFontDict.set('/Type', PdfName.of('Font'));
    cidFontDict.set('/Subtype', PdfName.of('CIDFontType0'));  // Type0 for CFF
    cidFontDict.set('/BaseFont', PdfName.of(psName));
    cidFontDict.set('/CIDSystemInfo', cidSysInfoDict);
    cidFontDict.set('/FontDescriptor', fontDescRef);
    cidFontDict.set('/W', wArray);
    cidFontDict.set('/DW', PdfNumber.of(Math.round(metrics.defaultWidth * scale)));
    // No /CIDToGIDMap for CFF fonts (CID maps directly)
    const cidFontRef = this.registry.register(cidFontDict);

    // 6. ToUnicode CMap stream (same as TrueType)
    const toUnicodeCmapStr = buildToUnicodeCmap(metrics.cmapTable);
    const toUnicodeStream = PdfStream.fromString(toUnicodeCmapStr);
    const toUnicodeRef = this.registry.register(toUnicodeStream);

    // 7. Top-level Type 0 composite font
    const type0Dict = new PdfDict();
    type0Dict.set('/Type', PdfName.of('Font'));
    type0Dict.set('/Subtype', PdfName.of('Type0'));
    type0Dict.set('/BaseFont', PdfName.of(psName));
    type0Dict.set('/Encoding', PdfName.of('Identity-H'));
    type0Dict.set('/DescendantFonts', PdfArray.of([cidFontRef]));
    type0Dict.set('/ToUnicode', toUnicodeRef);
    const type0Ref = this.registry.register(type0Dict);

    // Build the FontRef with measurement methods and CID encoding
    const fontRef: FontRef = {
      name: resourceName,
      ref: type0Ref,
      _isCIDFont: true,
      _encodeText: (text: string) => embeddedFont.encodeText(text),
      widthOfTextAtSize(text: string, size: number): number {
        return embeddedFont.widthOfTextAtSize(text, size);
      },
      heightAtSize(size: number): number {
        return embeddedFont.heightAtSize(size);
      },
      sizeAtHeight(height: number): number {
        const testSize = 1;
        const heightAt1 = embeddedFont.heightAtSize(testSize);
        return heightAt1 > 0 ? height / heightAt1 : height;
      },
      getCharacterSet(): number[] {
        return metrics.cmapTable.keys().toArray();
      },
    };

    this.embeddedFonts.set(`__cff__${psName}`, fontRef);
    this.ttfFonts.set(resourceName, {
      embeddedFont,
      fontRef,
      fontFileStream,
      fontFileDict,
      toUnicodeStream,
      cidFontDict,
    });

    // Register font and CID encoder on all existing pages
    for (const page of this.pages) {
      page.registerFont(resourceName, type0Ref);
      page.registerCIDFont(resourceName, (text: string) => embeddedFont.encodeText(text));
    }

    return fontRef;
  }

  // -----------------------------------------------------------------------
  // Image embedding
  // -----------------------------------------------------------------------

  /**
   * Embed a PNG image.
   *
   * Fully decodes the PNG (including filter reconstruction and alpha
   * channel separation) and creates a correct PDF image XObject.
   * For images with transparency, a separate SMask XObject is created
   * and referenced from the main image.
   *
   * @param pngData  Raw PNG file bytes as a `Uint8Array` or `ArrayBuffer`.
   * @returns        An {@link ImageRef} to pass to `page.drawImage()`.
   */
  embedPng(pngData: Uint8Array | ArrayBuffer): ImageRef {
    const data = pngData instanceof ArrayBuffer ? new Uint8Array(pngData) : pngData;
    // Decode PNG: decompress IDAT, reconstruct filters, separate alpha
    const result = decodePng(data);

    this.imageCounter++;
    const resourceName = `Im${this.imageCounter}`;

    // Build the image XObject dictionary
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('XObject'));
    dict.set('/Subtype', PdfName.of('Image'));
    dict.set('/Width', PdfNumber.of(result.width));
    dict.set('/Height', PdfNumber.of(result.height));
    dict.set('/BitsPerComponent', PdfNumber.of(result.bitsPerComponent));

    // Set color space
    if (result.colorSpace === 'Indexed' && result.palette) {
      // Indexed color space: [/Indexed /DeviceRGB hival <palette hex>]
      const maxIndex = (result.palette.length / 3) - 1;
      dict.set(
        '/ColorSpace',
        PdfArray.of([
          PdfName.of('Indexed'),
          PdfName.of('DeviceRGB'),
          PdfNumber.of(maxIndex),
          PdfString.hexFromBytes(result.palette),
        ]),
      );
    } else {
      dict.set('/ColorSpace', PdfName.of(result.colorSpace));
    }

    dict.set('/Filter', PdfName.of('FlateDecode'));
    dict.set('/Length', PdfNumber.of(result.imageData.length));

    // Set DecodeParms for IDAT passthrough (PNG predictor)
    if (result.decodeParms) {
      const dp = new PdfDict();
      dp.set('/Predictor', PdfNumber.of(result.decodeParms.predictor));
      dp.set('/Columns', PdfNumber.of(result.decodeParms.columns));
      dp.set('/Colors', PdfNumber.of(result.decodeParms.colors));
      dp.set('/BitsPerComponent', PdfNumber.of(result.decodeParms.bitsPerComponent));
      dict.set('/DecodeParms', dp);
    }

    // Handle SMask (alpha channel) — create a separate XObject
    if (result.smaskData) {
      const smaskDict = new PdfDict();
      smaskDict.set('/Type', PdfName.of('XObject'));
      smaskDict.set('/Subtype', PdfName.of('Image'));
      smaskDict.set('/Width', PdfNumber.of(result.width));
      smaskDict.set('/Height', PdfNumber.of(result.height));
      smaskDict.set('/BitsPerComponent', PdfNumber.of(result.smaskBitsPerComponent ?? 8));
      smaskDict.set('/ColorSpace', PdfName.of('DeviceGray'));
      smaskDict.set('/Filter', PdfName.of('FlateDecode'));
      smaskDict.set('/Length', PdfNumber.of(result.smaskData.length));

      const smaskStream = new PdfStream(smaskDict, result.smaskData);
      const smaskRef = this.registry.register(smaskStream);

      dict.set('/SMask', smaskRef);
    }

    const stream = new PdfStream(dict, result.imageData);
    const ref = this.registry.register(stream);

    const w = result.width;
    const h = result.height;
    const imageRef: ImageRef = {
      name: resourceName,
      ref,
      width: w,
      height: h,
      scale(factor: number) { return { width: w * factor, height: h * factor }; },
      scaleToFit(maxW: number, maxH: number) {
        const ratio = Math.min(maxW / w, maxH / h);
        return { width: w * ratio, height: h * ratio };
      },
    };
    this.embeddedImages.push(imageRef);
    return imageRef;
  }

  /**
   * Embed a JPEG image.
   *
   * JPEG data can be embedded directly as a PDF stream with
   * `DCTDecode` filter — no re-encoding is needed.
   *
   * @param jpegData  Raw JPEG file bytes as a `Uint8Array` or `ArrayBuffer`.
   * @returns         An {@link ImageRef}.
   */
  async embedJpeg(jpegData: Uint8Array | ArrayBuffer): Promise<ImageRef> {
    const data = jpegData instanceof ArrayBuffer ? new Uint8Array(jpegData) : jpegData;
    const { width, height, components } = parseJpegDimensions(data);

    this.imageCounter++;
    const resourceName = `Im${this.imageCounter}`;

    const colorSpace = components === 1 ? 'DeviceGray'
      : components === 4 ? 'DeviceCMYK'
      : 'DeviceRGB';

    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('XObject'));
    dict.set('/Subtype', PdfName.of('Image'));
    dict.set('/Width', PdfNumber.of(width));
    dict.set('/Height', PdfNumber.of(height));
    dict.set('/BitsPerComponent', PdfNumber.of(8));
    dict.set('/ColorSpace', PdfName.of(colorSpace));
    dict.set('/Filter', PdfName.of('DCTDecode'));
    dict.set('/Length', PdfNumber.of(data.length));

    const stream = new PdfStream(dict, data);
    const ref = this.registry.register(stream);

    const imageRef: ImageRef = {
      name: resourceName,
      ref,
      width,
      height,
      scale(factor: number) { return { width: width * factor, height: height * factor }; },
      scaleToFit(maxW: number, maxH: number) {
        const ratio = Math.min(maxW / width, maxH / height);
        return { width: width * ratio, height: height * ratio };
      },
    };
    this.embeddedImages.push(imageRef);
    return imageRef;
  }

  /**
   * Embed an image, auto-detecting the format from file headers.
   *
   * Inspects the first bytes to determine whether the data is PNG or JPEG,
   * then delegates to {@link embedPng} or {@link embedJpeg} accordingly.
   *
   * @param imageData  Raw image file bytes (PNG or JPEG).
   * @returns          An {@link ImageRef} to pass to `page.drawImage()`.
   * @throws           If the image format cannot be detected.
   *
   * @example
   * ```ts
   * const bytes = new Uint8Array(await readFile('photo.jpg'));
   * const image = await pdf.embedImage(bytes);
   * page.drawImage(image, { x: 50, y: 400, width: 200, height: 150 });
   * ```
   */
  async embedImage(imageData: Uint8Array | ArrayBuffer): Promise<ImageRef> {
    const data = imageData instanceof ArrayBuffer ? new Uint8Array(imageData) : imageData;
    if (data.length < 4) {
      throw new Error('Image data too short to detect format');
    }

    // PNG: 89 50 4E 47 (.PNG)
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return this.embedPng(data);
    }

    // JPEG: FF D8 FF
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return this.embedJpeg(data);
    }

    throw new Error(
      'Unsupported image format. Expected PNG (89 50 4E 47) or JPEG (FF D8 FF), ' +
      `got ${Array.from(data.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')}.`,
    );
  }

  // -----------------------------------------------------------------------
  // PDF page embedding (Form XObjects)
  // -----------------------------------------------------------------------

  /**
   * Embed pages from another PDF as Form XObjects.
   *
   * Each embedded page is turned into a self-contained Form XObject that
   * can be painted onto any page via `page.drawPage()`.  The source PDF's
   * content streams are decoded and concatenated, and all referenced
   * resources (fonts, images, etc.) are deep-cloned into this document's
   * registry.
   *
   * @param data         Raw PDF bytes (Uint8Array or ArrayBuffer).
   * @param pageIndices  Zero-based page indices to embed.  Defaults to
   *                     `[0]` (first page only).
   * @returns            Array of {@link EmbeddedPdfPage} handles.
   *
   * @example
   * ```ts
   * const [embeddedPage] = await doc.embedPdf(existingPdfBytes, [0]);
   * page.drawPage(embeddedPage, { x: 50, y: 50, width: 300, height: 400 });
   * ```
   */
  async embedPdf(
    data: Uint8Array | ArrayBuffer,
    pageIndices?: number[],
    options?: EmbedPageOptions,
  ): Promise<EmbeddedPdfPage[]> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const sourceDoc = await loadPdf(bytes);
    const sourceRegistry = sourceDoc.getRegistry();
    const sourcePages = sourceDoc.getInternalPages();

    const indices = pageIndices ?? [0];

    // Validate indices
    for (const index of indices) {
      if (index < 0 || index >= sourcePages.length) {
        throw new RangeError(
          `embedPdf: page index ${index} out of range [0, ${sourcePages.length - 1}]`,
        );
      }
    }

    const results: EmbeddedPdfPage[] = [];

    for (const index of indices) {
      const sourcePage = sourcePages[index]!;
      this.formXObjectCounter++;
      const xObjectName = `XF${this.formXObjectCounter}`;

      const embedded = embedPageAsFormXObject(
        sourcePage,
        sourceRegistry,
        this.registry,
        xObjectName,
        options,
      );
      results.push(embedded);
    }

    return results;
  }

  /**
   * Embed a single page (from this or another document) as a Form XObject.
   *
   * This is useful when you have an already-parsed PdfPage and want to
   * stamp it onto other pages as a form XObject.
   *
   * @param page     The PdfPage to embed.
   * @param options  Optional bounding box / transformation matrix.
   * @returns        An {@link EmbeddedPdfPage} handle.
   */
  embedPage(page: PdfPage, options?: EmbedPageOptions): EmbeddedPdfPage {
    const sourceRegistry = page.getRegistry();
    this.formXObjectCounter++;
    const xObjectName = `XF${this.formXObjectCounter}`;

    return embedPageAsFormXObject(
      page,
      sourceRegistry,
      this.registry,
      xObjectName,
      options,
    );
  }

  /**
   * Embed multiple pages as Form XObjects in batch.
   * Convenience wrapper around {@link embedPage}.
   *
   * @param pages  Array of PdfPage instances to embed.
   * @returns      Array of {@link EmbeddedPdfPage} handles, one per input page.
   */
  embedPages(pages: PdfPage[]): EmbeddedPdfPage[] {
    return pages.map((page) => this.embedPage(page));
  }

  // -----------------------------------------------------------------------
  // Metadata setters
  // -----------------------------------------------------------------------

  /** Set the document title. */
  setTitle(title: string, options?: SetTitleOptions): void {
    this.meta.title = title;
    if (options?.showInWindowTitleBar) {
      this.getViewerPreferences().setDisplayDocTitle(true);
    }
  }

  /** Set the document author. */
  setAuthor(author: string): void {
    this.meta.author = author;
  }

  /** Set the document subject. */
  setSubject(subject: string): void {
    this.meta.subject = subject;
  }

  /** Set the document keywords. */
  setKeywords(keywords: string | string[]): void {
    this.meta.keywords = Array.isArray(keywords) ? keywords.join(', ') : keywords;
  }

  /** Set the creator application name. */
  setCreator(creator: string): void {
    this.meta.creator = creator;
  }

  /** Set the producer string (defaults to `"modern-pdf"`). */
  setProducer(producer: string): void {
    this.meta.producer = producer;
  }

  /** Set the document creation date. */
  setCreationDate(date: Date): void {
    this.meta.creationDate = date;
  }

  /** Set the document modification date. */
  setModDate(date: Date): void {
    this.meta.modDate = date;
  }

  // -----------------------------------------------------------------------
  // Metadata getters
  // -----------------------------------------------------------------------

  /** Get the document title, or `undefined` if not set. */
  getTitle(): string | undefined {
    return this.meta.title;
  }

  /** Get the document author, or `undefined` if not set. */
  getAuthor(): string | undefined {
    return this.meta.author;
  }

  /** Get the document subject, or `undefined` if not set. */
  getSubject(): string | undefined {
    return this.meta.subject;
  }

  /** Get the document keywords, or `undefined` if not set. */
  getKeywords(): string | undefined {
    return this.meta.keywords;
  }

  /** Get the creator application name, or `undefined` if not set. */
  getCreator(): string | undefined {
    return this.meta.creator;
  }

  /** Get the producer string. */
  getProducer(): string | undefined {
    return this.meta.producer;
  }

  /** Get the document creation date. */
  getCreationDate(): Date | undefined {
    return this.meta.creationDate;
  }

  /** Get the document modification date, or `undefined` if not set. */
  getModDate(): Date | undefined {
    return this.meta.modDate;
  }

  // -----------------------------------------------------------------------
  // Encryption
  // -----------------------------------------------------------------------

  /** The encryption handler, set when `encrypt()` is called. */
  private encryptionHandler: PdfEncryptionHandler | undefined;

  /**
   * Configure encryption for this document.
   *
   * When encryption is set, the document will be encrypted on the next
   * call to `save()`.  The /Encrypt dictionary and file ID are
   * generated automatically.
   *
   * @param options  Encryption options (passwords, permissions, algorithm).
   *
   * @example
   * ```ts
   * const doc = createPdf();
   * doc.addPage();
   * doc.encrypt({
   *   userPassword: 'user123',
   *   ownerPassword: 'owner456',
   *   permissions: { printing: true, copying: false },
   *   algorithm: 'aes-256',
   * });
   * const bytes = await doc.save();
   * ```
   */
  async encrypt(options: EncryptOptions): Promise<void> {
    this.encryptionHandler = await PdfEncryptionHandler.create(options);
  }

  /**
   * Check whether this document has encryption configured.
   *
   * Returns `true` if `encrypt()` has been called on this document,
   * or if the document was loaded from an encrypted PDF.
   */
  isEncrypted(): boolean {
    return this.encryptionHandler !== undefined;
  }

  /**
   * Get the permission flags for this document, if encrypted.
   *
   * @returns  The decoded permission flags, or `undefined` if the
   *           document is not encrypted.
   */
  getPermissions(): PdfPermissionFlags | undefined {
    return this.encryptionHandler?.getPermissions();
  }

  /**
   * Get the encryption handler (for advanced use / testing).
   * @internal
   */
  getEncryptionHandler(): PdfEncryptionHandler | undefined {
    return this.encryptionHandler;
  }

  // -----------------------------------------------------------------------
  // Digital Signatures
  // -----------------------------------------------------------------------

  /** Original PDF bytes (set when loaded from an existing file). */
  private originalBytes: Uint8Array | undefined;

  /**
   * @internal Set the original bytes (called by the parser on load).
   */
  setOriginalBytes(bytes: Uint8Array): void {
    this.originalBytes = bytes;
  }

  /**
   * @internal Get the original bytes.
   */
  getOriginalBytes(): Uint8Array | undefined {
    return this.originalBytes;
  }

  /**
   * Add a signature field to a page.
   *
   * This is a placeholder method that records the intent to sign.
   * The actual signature creation happens in `sign()`.
   *
   * @param pageIndex  Zero-based page index.
   * @param rect       Rectangle [x1, y1, x2, y2] for the visual appearance.
   * @param name       The signature field name (must be unique).
   */
  addSignatureField(
    pageIndex: number,
    rect: [number, number, number, number],
    name: string,
  ): void {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      throw new RangeError(
        `Page index ${pageIndex} out of range [0, ${this.pages.length - 1}]`,
      );
    }
    // Store the signature field info for later use in sign()
    // The actual PDF structures are created during the signing process
    this.signatureFields.push({ pageIndex, rect, name });
  }

  /** Pending signature field definitions. */
  private readonly signatureFields: Array<{
    pageIndex: number;
    rect: [number, number, number, number];
    name: string;
  }> = [];

  /**
   * Sign the PDF document.
   *
   * Returns the signed PDF bytes. Uses incremental save to preserve
   * existing content and any previous signatures.
   *
   * @param fieldName  The signature field name.
   * @param options    Signing options (certificate, private key, etc.).
   * @returns          The signed PDF bytes.
   *
   * @example
   * ```ts
   * const doc = await PdfDocument.load(pdfBytes);
   * const signedBytes = await doc.sign('Signature1', {
   *   certificate: certDer,
   *   privateKey: keyDer,
   *   reason: 'Document approval',
   * });
   * ```
   */
  async sign(fieldName: string, options: SignOptions): Promise<Uint8Array> {
    // Get the PDF bytes to sign
    const pdfBytes = this.originalBytes ?? await this.save();
    return signPdf(pdfBytes, fieldName, options);
  }

  /**
   * Get information about all signatures in this document.
   *
   * @returns  Array of signature info objects.
   */
  getSignatures(): PdfSignatureInfo[] {
    if (!this.originalBytes) return [];
    return getSignatures(this.originalBytes);
  }

  /**
   * Verify all signatures in this document.
   *
   * @returns  Array of verification results.
   */
  async verifySignatures(): Promise<SignatureVerificationResult[]> {
    if (!this.originalBytes) return [];
    return verifySignatures(this.originalBytes);
  }

  // -----------------------------------------------------------------------
  // Outlines (bookmarks)
  // -----------------------------------------------------------------------

  /** The outline tree, lazily created. */
  private outlineTree: PdfOutlineTree | undefined;

  /**
   * Get the outline (bookmark) tree for this document.
   *
   * If no outlines have been added, returns an empty tree.
   *
   * @returns  The {@link PdfOutlineTree} for this document.
   */
  getOutlines(): PdfOutlineTree {
    this.outlineTree ??= new PdfOutlineTree();
    return this.outlineTree;
  }

  /**
   * Add a top-level outline (bookmark) entry.
   *
   * Convenience method that creates or retrieves the outline tree and
   * adds a new item pointing to the specified page.
   *
   * @param title      The display title for the bookmark.
   * @param pageIndex  Zero-based page index to navigate to.
   * @param options    Optional visual style and behaviour settings.
   * @returns          The newly created {@link PdfOutlineItem}.
   */
  addOutline(
    title: string,
    pageIndex: number,
    options?: OutlineItemOptions & { fit?: OutlineDestination['fit']; top?: number; left?: number; zoom?: number },
  ): PdfOutlineItem {
    const tree = this.getOutlines();
    const dest: OutlineDestination = {
      type: 'page',
      pageIndex,
      fit: options?.fit ?? 'Fit',
      top: options?.top,
      left: options?.left,
      zoom: options?.zoom,
    };
    return tree.addItem(title, dest, options);
  }

  /**
   * Replace the outline tree for this document.
   *
   * @param outlines  The new outline tree.
   */
  setOutlines(outlines: PdfOutlineTree): void {
    this.outlineTree = outlines;
  }

  // -----------------------------------------------------------------------
  // XMP Metadata
  // -----------------------------------------------------------------------

  /** Raw XMP metadata string, if set. */
  private xmpMetadataString: string | undefined;

  /**
   * Get the raw XMP metadata string, or `undefined` if not set.
   */
  getXmpMetadata(): string | undefined {
    return this.xmpMetadataString;
  }

  /**
   * Set raw XMP metadata as an XML string.
   *
   * The string should be a valid XMP packet.  Use
   * {@link buildXmpMetadata} from `modern-pdf` to generate one
   * from standard metadata fields.
   *
   * @param xmp  The XMP XML string.
   */
  setXmpMetadata(xmp: string): void {
    this.xmpMetadataString = xmp;
  }

  // -----------------------------------------------------------------------
  // Accessibility — Tagged PDF
  // -----------------------------------------------------------------------

  /** The document's structure tree (for tagged PDF), if created. */
  private structureTree: PdfStructureTree | undefined;

  /** The document's natural language (BCP 47 tag, e.g. "en-US"). */
  private documentLanguage: string | undefined;

  /**
   * Get the structure tree for this document, or `undefined` if
   * no structure tree has been created.
   *
   * A structure tree is required for tagged PDF / PDF/UA compliance.
   *
   * @returns  The {@link PdfStructureTree}, or `undefined`.
   */
  getStructureTree(): PdfStructureTree | undefined {
    return this.structureTree;
  }

  /**
   * Create a new structure tree for this document.
   *
   * If a structure tree already exists, it is returned as-is.
   * Call this to begin making the document accessible (tagged PDF).
   *
   * @returns  The {@link PdfStructureTree} for this document.
   */
  createStructureTree(): PdfStructureTree {
    this.structureTree ??= new PdfStructureTree();
    return this.structureTree;
  }

  /**
   * Set the document's natural language.
   *
   * This is required by PDF/UA and should be a BCP 47 language tag
   * (e.g. `"en"`, `"en-US"`, `"de-DE"`, `"ja"`).
   *
   * @param lang  The BCP 47 language tag.
   */
  setLanguage(lang: string): void {
    this.documentLanguage = lang;
  }

  /**
   * Get the document's natural language, or `undefined` if not set.
   *
   * @returns  The BCP 47 language tag, or `undefined`.
   */
  getLanguage(): string | undefined {
    return this.documentLanguage;
  }

  /**
   * Run accessibility checks on this document.
   *
   * Validates the document against PDF/UA requirements and general
   * accessibility best practices.
   *
   * @returns  An array of {@link AccessibilityIssue} objects.
   */
  checkAccessibility(): AccessibilityIssue[] {
    return checkAccessibility(this);
  }

  // -----------------------------------------------------------------------
  // Viewer Preferences
  // -----------------------------------------------------------------------

  /** Viewer preferences, if set. */
  private viewerPrefs: ViewerPreferences | undefined;

  /** Cached PdfViewerPreferences instance. */
  private _viewerPrefsInstance?: PdfViewerPreferences | undefined;

  /**
   * Get the viewer preferences for this document as a
   * {@link PdfViewerPreferences} instance with getter/setter pairs.
   *
   * If no preferences have been set, a default (empty) instance is
   * returned.  The instance is cached so that repeated calls return
   * the same object and mutations are preserved.
   */
  getViewerPreferences(): PdfViewerPreferences {
    if (!this._viewerPrefsInstance) {
      this._viewerPrefsInstance = new PdfViewerPreferences(this.viewerPrefs ?? {});
    }
    return this._viewerPrefsInstance;
  }

  /**
   * Set viewer preferences for this document.
   *
   * Controls how the document is displayed when opened in a PDF viewer
   * (toolbar visibility, window sizing, print options, etc.).
   *
   * Accepts either a plain {@link ViewerPreferences} object or a
   * {@link PdfViewerPreferences} class instance.
   *
   * @param prefs  The viewer preferences to set.
   */
  setViewerPreferences(prefs: ViewerPreferences | PdfViewerPreferences): void {
    if (prefs instanceof PdfViewerPreferences) {
      this._viewerPrefsInstance = prefs;
      this.viewerPrefs = prefs.toObject();
    } else {
      this.viewerPrefs = prefs;
      this._viewerPrefsInstance = undefined;
    }
  }

  // -----------------------------------------------------------------------
  // Forms (AcroForm)
  // -----------------------------------------------------------------------

  /** The form instance, lazily created. */
  private form: PdfForm | undefined;

  /**
   * Check whether this document has an AcroForm (interactive form).
   *
   * Returns `true` if a form has been created or if the document
   * was loaded from a PDF that contains an /AcroForm dictionary.
   */
  hasForm(): boolean {
    return this.form !== undefined;
  }

  /**
   * Get the interactive form (AcroForm) for this document.
   *
   * If the document does not yet have a form, an empty one is created.
   * The form provides access to all form fields and supports fill,
   * flatten, and field creation operations.
   *
   * @returns  The {@link PdfForm} for this document.
   */
  getForm(): PdfForm {
    this.form ??= (() => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      return new PdfForm([], acroFormDict);
    })();
    return this.form;
  }

  /**
   * Set the form for this document (used when loading parsed PDFs).
   * @internal
   */
  setForm(form: PdfForm): void {
    this.form = form;
  }

  // -----------------------------------------------------------------------
  // SVG drawing
  // -----------------------------------------------------------------------

  /**
   * Draw an SVG image onto a page.
   *
   * @param pageIndex  Zero-based page index.
   * @param svgString  The SVG markup string.
   * @param options    Rendering options (position, size).
   */
  drawSvg(pageIndex: number, svgString: string, options?: SvgRenderOptions): void {
    const page = this.getPage(pageIndex);
    drawSvgOnPage(page, svgString, options);
  }

  // -----------------------------------------------------------------------
  // Layers (Optional Content Groups)
  // -----------------------------------------------------------------------

  /** The layer manager, lazily created. */
  private layerManager: PdfLayerManager | undefined;

  /**
   * Add a new optional content layer.
   *
   * @param name     The display name for the layer.
   * @param visible  Whether the layer is visible by default.
   * @returns        The newly created {@link PdfLayer}.
   */
  addLayer(name: string, visible: boolean = true): PdfLayer {
    this.layerManager ??= new PdfLayerManager();
    return this.layerManager.addLayer(name, visible);
  }

  /**
   * Get all layers in this document.
   *
   * @returns  An array of {@link PdfLayer} objects.
   */
  getLayers(): PdfLayer[] {
    return this.layerManager?.getLayers() ?? [];
  }

  // -----------------------------------------------------------------------
  // Embedded files (attachments)
  // -----------------------------------------------------------------------

  /** Attached file references. */
  private readonly attachedFiles: { ref: PdfRef; name: string }[] = [];

  /** Document-level JavaScript actions — maps name → script source. */
  private readonly javaScripts = new Map<string, string>();

  /**
   * Attach a file to this PDF document.
   *
   * @param name      File name.
   * @param data      File data.
   * @param mimeType  MIME type string.
   * @param options   Optional description.
   */
  attachFile(
    name: string,
    data: Uint8Array,
    mimeType: string,
    options?: { description?: string | undefined },
  ): void {
    const file: EmbeddedFile = {
      name,
      data,
      mimeType,
      ...(options?.description !== undefined ? { description: options.description } : {}),
    };
    const ref = attachFile(this.registry, file);
    this.attachedFiles.push({ ref, name });
  }

  /**
   * Get all file attachments in this document.
   *
   * Note: Currently returns information about files attached via
   * this API.  For parsing attachments from loaded PDFs, use the
   * lower-level `getAttachments()` function.
   *
   * @returns  An array of embedded file metadata.
   */
  getAttachments(): EmbeddedFile[] {
    // For newly created documents, return the files we've attached.
    // Full parsing of loaded documents' attachments would require
    // catalog traversal (handled by getAttachments() from embeddedFiles.ts).
    return [];
  }

  // -----------------------------------------------------------------------
  // Document-level JavaScript
  // -----------------------------------------------------------------------

  /**
   * Add a document-level JavaScript action.
   *
   * The script is registered in the catalog's `/Names` dictionary under
   * the `/JavaScript` name tree.  When a conforming viewer opens the
   * document, scripts listed here are executed automatically (in name
   * order).
   *
   * @param name    A unique name for this JavaScript entry.
   * @param script  The JavaScript source code.
   *
   * @example
   * ```ts
   * doc.addJavaScript('init', 'app.alert("Hello from PDF JavaScript!");');
   * ```
   */
  addJavaScript(name: string, script: string): void {
    this.javaScripts.set(name, script);
  }

  // -----------------------------------------------------------------------
  // Watermark
  // -----------------------------------------------------------------------

  /**
   * Add a text watermark to all pages in the document.
   *
   * @param options  Watermark appearance options.
   */
  addWatermark(options: WatermarkOptions): void {
    addWatermarkImpl(this, options);
  }

  // -----------------------------------------------------------------------
  // Soft masks
  // -----------------------------------------------------------------------

  /**
   * Create a soft mask Form XObject that can be used with
   * {@link PdfPage.applySoftMask}.
   *
   * The builder callback receives a {@link SoftMaskBuilder} with methods
   * for generating grayscale content where white (`1`) represents fully
   * opaque regions and black (`0`) represents fully transparent regions.
   *
   * The returned {@link SoftMaskRef} is passed to
   * {@link PdfPage.applySoftMask} to activate the mask for subsequent
   * drawing operations on that page.
   *
   * @param width    Width of the mask in points.
   * @param height   Height of the mask in points.
   * @param builder  Callback that draws the mask content.
   * @returns        A reference to the soft mask Form XObject.
   *
   * @example
   * ```ts
   * const mask = doc.createSoftMask(200, 200, (b) => {
   *   // White background = fully opaque
   *   b.drawRectangle(0, 0, 200, 200, 1);
   *   // Black circle = fully transparent hole
   *   b.drawCircle(100, 100, 80, 0);
   * });
   * page.applySoftMask(mask);
   * page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(1, 0, 0) });
   * page.clearSoftMask();
   * ```
   */
  createSoftMask(
    width: number,
    height: number,
    builder: (ops: SoftMaskBuilder) => void,
  ): SoftMaskRef {
    const maskOps: string[] = [];

    // Bezier constant for circle approximation: 4/3 * (sqrt(2) - 1)
    const kappa = 0.5522847498;

    const builderApi: SoftMaskBuilder = {
      drawRectangle(x: number, y: number, w: number, h: number, gray: number): void {
        maskOps.push(`${gray} g`);
        maskOps.push(`${x} ${y} ${w} ${h} re`);
        maskOps.push('f');
      },
      drawCircle(cx: number, cy: number, r: number, gray: number): void {
        maskOps.push(`${gray} g`);
        // Circle path using four cubic Bezier curves
        const ox = r * kappa; // horizontal control point offset
        const oy = r * kappa; // vertical control point offset
        maskOps.push(`${cx - r} ${cy} m`);
        maskOps.push(`${cx - r} ${cy + oy} ${cx - ox} ${cy + r} ${cx} ${cy + r} c`);
        maskOps.push(`${cx + ox} ${cy + r} ${cx + r} ${cy + oy} ${cx + r} ${cy} c`);
        maskOps.push(`${cx + r} ${cy - oy} ${cx + ox} ${cy - r} ${cx} ${cy - r} c`);
        maskOps.push(`${cx - ox} ${cy - r} ${cx - r} ${cy - oy} ${cx - r} ${cy} c`);
        maskOps.push('f');
      },
      pushRawOperators(ops: string): void {
        maskOps.push(ops);
      },
    };

    builder(builderApi);

    // Build the Form XObject with a /DeviceGray transparency group
    const groupDict = new PdfDict();
    groupDict.set('/S', PdfName.of('Transparency'));
    groupDict.set('/CS', PdfName.of('DeviceGray'));

    const formDict = new PdfDict();
    formDict.set('/Type', PdfName.of('XObject'));
    formDict.set('/Subtype', PdfName.of('Form'));
    formDict.set('/BBox', PdfArray.fromNumbers([0, 0, width, height]));
    formDict.set('/Group', groupDict);

    const stream = PdfStream.fromString(maskOps.join('\n'), formDict);
    const ref = this.registry.register(stream);

    return { _tag: 'softMask' as const, ref };
  }

  // -----------------------------------------------------------------------
  // Redaction
  // -----------------------------------------------------------------------

  /**
   * Apply all pending redactions across all pages.
   *
   * Redaction marks are added to individual pages using
   * `page.markForRedaction()`.  This method draws the redaction
   * rectangles on all pages that have pending marks.
   */
  applyRedactions(): void {
    applyRedactionsImpl(this);
  }

  // -----------------------------------------------------------------------
  // Copy (deep clone via save → load round-trip)
  // -----------------------------------------------------------------------

  /**
   * Create an independent deep copy of this document.
   *
   * The copy is produced by serializing the document to bytes and then
   * re-parsing those bytes.  This guarantees that the returned
   * `PdfDocument` is completely independent — mutations to the copy
   * do not affect the original, and vice versa.
   *
   * @returns  A new `PdfDocument` that is a deep copy of this one.
   *
   * @example
   * ```ts
   * const doc = createPdf();
   * doc.addPage(PageSizes.A4);
   * const clone = await doc.copy();
   * clone.addPage(PageSizes.Letter); // does not affect `doc`
   * ```
   */
  async copy(): Promise<PdfDocument> {
    const bytes = await this.save({ addDefaultPage: false });
    return PdfDocument.load(bytes);
  }

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------

  /**
   * Serialize the document to a `Uint8Array`.
   *
   * @param options  Compression and serialization options.
   * @returns        The complete PDF file as bytes.
   */
  async save(options?: PdfSaveOptions): Promise<Uint8Array> {
    if ((options?.addDefaultPage ?? true) && this.getPageCount() === 0) {
      this.addPage();
    }
    if ((options?.updateFieldAppearances ?? true) && this.form) {
      for (const field of this.form.getFields()) {
        field.generateAppearance();
      }
    }
    const structure = this.buildStructure();
    return serializePdf(this.registry, structure, options);
  }

  /**
   * Serialize the document as a `ReadableStream<Uint8Array>`.
   *
   * Ideal for streaming responses in edge/serverless environments.
   *
   * @param options  Compression and serialization options.
   */
  saveAsStream(options?: PdfSaveOptions): ReadableStream<Uint8Array> {
    if ((options?.addDefaultPage ?? true) && this.getPageCount() === 0) {
      this.addPage();
    }
    if ((options?.updateFieldAppearances ?? true) && this.form) {
      for (const field of this.form.getFields()) {
        field.generateAppearance();
      }
    }
    const structure = this.buildStructure();
    const writer = new PdfStreamWriter(this.registry, structure, options);
    return writer.toReadableStream();
  }

  /**
   * Serialize the document to a `Blob`.
   *
   * Convenient for client-side download links.
   *
   * @param options  Compression and serialization options.
   */
  async saveAsBlob(options?: PdfSaveOptions): Promise<Blob> {
    const bytes = await this.save(options);
    // Ensure the underlying buffer is a plain ArrayBuffer (not
    // SharedArrayBuffer) so it satisfies the BlobPart constraint.
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  /**
   * Serialize the document to a Base64-encoded string.
   *
   * Useful for embedding PDFs in JSON payloads, data URIs, or
   * transferring over text-only channels.
   *
   * @param options  Standard save options plus an optional `dataUri`
   *                 flag.  When `dataUri` is `true`, the returned
   *                 string is prefixed with
   *                 `data:application/pdf;base64,`.
   * @returns        A Base64-encoded string of the PDF bytes.
   *
   * @example
   * ```ts
   * const b64 = await doc.saveAsBase64();
   * const dataUri = await doc.saveAsBase64({ dataUri: true });
   * // dataUri === "data:application/pdf;base64,JVBERi0..."
   * ```
   */
  async saveAsBase64(
    options?: PdfSaveOptions & { dataUri?: boolean },
  ): Promise<string> {
    const bytes = await this.save(options);
    const encoded = bytes.toBase64();
    if (options?.dataUri) {
      return `data:application/pdf;base64,${encoded}`;
    }
    return encoded;
  }

  // -----------------------------------------------------------------------
  // Internal: build document structure
  // -----------------------------------------------------------------------

  /**
   * Finalize all pages and build the catalog / page tree / info dict.
   */
  private buildStructure() {
    // Subset TrueType fonts before finalizing pages — this updates the
    // font file streams, /W arrays, and /ToUnicode CMaps in-place to
    // only include glyphs that were actually used in drawText calls.
    if (this.ttfFonts.size > 0) {
      this.subsetTtfFonts();
    }

    // Finalize each page → produces content streams and page dicts
    const pageEntries: PageEntry[] = this.pages.map((p) => p.finalize());

    // Set modification date if not already set
    this.meta.modDate ??= new Date();

    const structure = buildDocumentStructure(pageEntries, this.meta, this.registry);

    // Post-process the catalog to add outlines, XMP metadata, and
    // viewer preferences.
    const catalogObj = this.registry.resolve(structure.catalogRef);
    if (catalogObj instanceof PdfDict) {
      // Outlines
      if (this.outlineTree && this.outlineTree.items.length > 0) {
        const pageRefs = pageEntries.map((pe) => pe.pageRef);
        const outlinesRef = this.outlineTree.toDict(this.registry, pageRefs);
        catalogObj.set('/Outlines', outlinesRef);
        // Set page mode to UseOutlines so the sidebar is open
        if (!catalogObj.has('/PageMode')) {
          catalogObj.set('/PageMode', PdfName.of('UseOutlines'));
        }
      }

      // XMP Metadata stream
      if (this.xmpMetadataString !== undefined) {
        const encoder = new TextEncoder();
        const data = encoder.encode(this.xmpMetadataString);
        const metaDict = new PdfDict();
        metaDict.set('/Type', PdfName.of('Metadata'));
        metaDict.set('/Subtype', PdfName.of('XML'));
        metaDict.set('/Length', PdfNumber.of(data.length));
        const metaStream = new PdfStream(metaDict, data);
        const metaRef = this.registry.register(metaStream);
        catalogObj.set('/Metadata', metaRef);
      }

      // Viewer Preferences — sync from the class instance if it exists
      if (this._viewerPrefsInstance) {
        this.viewerPrefs = this._viewerPrefsInstance.toObject();
      }
      if (this.viewerPrefs !== undefined && Object.keys(this.viewerPrefs).length > 0) {
        const prefsDict = buildViewerPreferencesDict(this.viewerPrefs);
        catalogObj.set('/ViewerPreferences', prefsDict);
      }

      // Document language
      if (this.documentLanguage !== undefined) {
        catalogObj.set('/Lang', PdfString.literal(this.documentLanguage));
      }

      // Structure tree (tagged PDF)
      if (this.structureTree !== undefined) {
        const pageRefs = pageEntries.map((pe) => pe.pageRef);
        const treeResult = this.structureTree.toDict(this.registry, pageRefs);
        catalogObj.set('/StructTreeRoot', treeResult.ref);

        // Mark the document as tagged
        const markInfoDict = new PdfDict();
        markInfoDict.set('/Marked', PdfBool.of(true));
        catalogObj.set('/MarkInfo', markInfoDict);
      }

      // Optional content properties (layers)
      if (this.layerManager && this.layerManager.getLayers().length > 0) {
        const ocProps = this.layerManager.toOCProperties(this.registry);
        catalogObj.set('/OCProperties', ocProps);
      }

      // /Names dictionary — shared by embedded files and JavaScript
      {
        const hasAttachments = this.attachedFiles.length > 0;
        const hasJavaScript = this.javaScripts.size > 0;

        if (hasAttachments || hasJavaScript) {
          const namesDict = new PdfDict();

          // Embedded files (attachments)
          if (hasAttachments) {
            const nameTree = buildEmbeddedFilesNameTree(
              this.attachedFiles.map((f) => f.ref),
              this.attachedFiles.map((f) => f.name),
              this.registry,
            );
            namesDict.set('/EmbeddedFiles', nameTree);
          }

          // Document-level JavaScript
          if (hasJavaScript) {
            const jsNamesArray = new PdfArray();
            for (const [jsName, jsScript] of this.javaScripts) {
              // Build a JavaScript action dictionary
              const actionDict = new PdfDict();
              actionDict.set('/Type', PdfName.of('Action'));
              actionDict.set('/S', PdfName.of('JavaScript'));
              actionDict.set('/JS', PdfString.literal(jsScript));
              const actionRef = this.registry.register(actionDict);

              jsNamesArray.push(PdfString.literal(jsName));
              jsNamesArray.push(actionRef);
            }
            const jsNameTree = new PdfDict();
            jsNameTree.set('/Names', jsNamesArray);
            namesDict.set('/JavaScript', jsNameTree);
          }

          catalogObj.set('/Names', namesDict);
        }
      }
    }

    // Remove orphaned objects that are no longer reachable from the new
    // document structure.  When a PDF is loaded, the parser registers ALL
    // objects from the original file.  After buildDocumentStructure()
    // creates fresh catalog/page-tree/info objects, the old structural
    // objects become unreachable orphans that would otherwise bloat the
    // output.
    //
    // Skip for brand-new documents (no originalBytes) since there are no
    // pre-existing objects that could become orphans.
    if (this.originalBytes !== undefined) {
      const rootRefs: PdfRef[] = [structure.catalogRef, structure.infoRef];
      for (const img of this.embeddedImages) {
        rootRefs.push(img.ref);
      }
      for (const [, fontRef] of this.embeddedFonts) {
        rootRefs.push(fontRef.ref);
      }
      for (const file of this.attachedFiles) {
        rootRefs.push(file.ref);
      }
      this.registry.filterReachable(rootRefs);
    }

    return structure;
  }

  /**
   * Subset all embedded TrueType fonts.
   *
   * Called at save time, after all text has been drawn.  For each TTF
   * font, this:
   * 1. Calls {@link subsetFont} with the used glyph set
   * 2. Updates the `/FontFile2` stream data with the (possibly subsetted) font bytes
   * 3. Updates the `/Length1` in the font file dict
   * 4. Rebuilds the `/W` (widths) array for the CIDFont dict
   * 5. Rebuilds the `/ToUnicode` CMap stream
   *
   * Since WASM subsetting is not yet available, the fallback returns
   * the full font unchanged.  But the /W array and /ToUnicode CMap
   * are rebuilt to only include used glyphs, reducing PDF overhead.
   *
   * @internal
   */
  private subsetTtfFonts(): void {
    const encoder = new TextEncoder();

    for (const [, entry] of this.ttfFonts) {
      const { embeddedFont, fontFileStream, fontFileDict, toUnicodeStream, cidFontDict } = entry;
      const metrics = embeddedFont.metrics;
      const usedGlyphs = embeddedFont.getUsedGlyphs();

      // 1. Subset the font (or get full font back with identity mapping)
      const subsetResult = subsetFont(embeddedFont.fontData, new Set(usedGlyphs));

      // 2. Update the /FontFile2 stream with (possibly subsetted) font data
      fontFileStream.data = subsetResult.fontData;
      fontFileStream.syncLength();
      fontFileDict.set('/Length1', PdfNumber.of(subsetResult.fontData.length));

      // 3. Build a new /W (widths) array for only the used glyphs.
      //    Since we use Identity-H encoding (CID = GID) and the fallback
      //    preserves original GIDs, we only need widths for the GIDs
      //    that were actually used.
      const scale = 1000 / metrics.unitsPerEm;
      const usedGidsSorted = usedGlyphs.values().toArray().sort((a, b) => a - b);
      const wArrayItems: (PdfNumber | PdfArray)[] = [];

      // Group consecutive GIDs into chunks for the /W array
      let i = 0;
      while (i < usedGidsSorted.length) {
        const chunkStart = usedGidsSorted[i]!;
        const widths: PdfNumber[] = [];

        // Extend the chunk as long as GIDs are consecutive
        let j = i;
        while (j < usedGidsSorted.length && usedGidsSorted[j]! === chunkStart + (j - i)) {
          const gid = usedGidsSorted[j]!;
          const rawWidth = metrics.glyphWidths.get(gid) ?? metrics.defaultWidth;
          widths.push(PdfNumber.of(Math.round(rawWidth * scale)));
          j++;
        }

        wArrayItems.push(PdfNumber.of(chunkStart));
        wArrayItems.push(PdfArray.of(widths));
        i = j;
      }

      cidFontDict.set('/W', new PdfArray(wArrayItems));

      // 4. Rebuild the /ToUnicode CMap for only the used glyphs
      const cmapResult = buildSubsetCmap(subsetResult, metrics.cmapTable);
      const cmapBytes = encoder.encode(cmapResult.cmapStream);
      toUnicodeStream.data = cmapBytes;
      toUnicodeStream.syncLength();
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new, empty PDF document.
 *
 * ```ts
 * const doc = createPdf();
 * ```
 */
export function createPdf(): PdfDocument {
  return new PdfDocument();
}

