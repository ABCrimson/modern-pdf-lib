/**
 * @module core/pdfDocumentBuilder
 *
 * Fluent builder for creating PDF documents with a chainable API.
 *
 * Wraps {@link PdfDocument} with a builder pattern so that metadata,
 * pages, resources, and document-level settings can be configured
 * through method chaining instead of imperative calls.
 *
 * Usage:
 * ```ts
 * import { PdfDocumentBuilder, PageSizes, rgb } from 'modern-pdf-lib';
 *
 * const bytes = await PdfDocumentBuilder.create()
 *   .setTitle('My Document')
 *   .setAuthor('John Doe')
 *   .addPage(PageSizes.A4, page => {
 *     page.drawText('Hello, World!', { x: 50, y: 750, size: 24 });
 *     page.drawRectangle({ x: 50, y: 700, width: 200, height: 50, color: rgb(0.8, 0.8, 0.8) });
 *   })
 *   .addPage(PageSizes.Letter, page => {
 *     page.drawText('Page 2', { x: 50, y: 750, size: 18 });
 *   })
 *   .encrypt({ userPassword: 'secret', ownerPassword: 'owner' })
 *   .save();
 * ```
 */

import type { PdfPage, PageSize, FontRef, ImageRef } from './pdfPage.js';
import { PdfDocument } from './pdfDocument.js';
import type { SetTitleOptions } from './pdfDocument.js';
import type { PdfSaveOptions } from './pdfWriter.js';
import type { EncryptOptions } from '../crypto/encryptionHandler.js';
import type { LoadPdfOptions } from '../parser/documentParser.js';
import type { PageLabelRange } from './pageLabels.js';
import { setPageLabels } from './pageLabels.js';
import type { AddBookmarkOptions, BookmarkRef } from './outlines.js';
import { addBookmark } from './outlines.js';

// ---------------------------------------------------------------------------
// PdfDocumentBuilder
// ---------------------------------------------------------------------------

/**
 * Fluent builder for creating PDF documents with a chainable API.
 *
 * Methods that don't require async return `this` for chaining.
 * Methods that require async operations (font/image embedding) use
 * a callback pattern so the builder chain can continue synchronously.
 *
 * Use {@link getDocument} as an escape hatch to access the underlying
 * {@link PdfDocument} directly when the builder API is insufficient.
 *
 * @example
 * ```ts
 * const bytes = await PdfDocumentBuilder.create()
 *   .setTitle('Report')
 *   .setAuthor('Acme Corp')
 *   .addPage(PageSizes.A4, page => {
 *     page.drawText('Hello, World!', { x: 50, y: 750, size: 24 });
 *   })
 *   .save();
 * ```
 */
export class PdfDocumentBuilder {
  private readonly doc: PdfDocument;

  /** Deferred async operations queued up during chaining. */
  private readonly deferredOps: Array<() => Promise<void>> = [];

  /**
   * @param doc  The underlying document to wrap.  Use the static
   *             factory methods ({@link create}, {@link load}) instead.
   */
  private constructor(doc: PdfDocument) {
    this.doc = doc;
  }

  // -------------------------------------------------------------------------
  // Static factories
  // -------------------------------------------------------------------------

  /**
   * Create a new, empty builder wrapping a fresh {@link PdfDocument}.
   *
   * @returns  A new builder instance.
   */
  static create(): PdfDocumentBuilder {
    return new PdfDocumentBuilder(PdfDocument.create());
  }

  /**
   * Load an existing PDF into the builder.
   *
   * @param data     The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
   *                 Base64-encoded string.
   * @param options  Optional loading options (e.g. password).
   * @returns        A promise that resolves to the builder wrapping the
   *                 loaded document.
   */
  static async load(
    data: Uint8Array | ArrayBuffer | string,
    options?: LoadPdfOptions,
  ): Promise<PdfDocumentBuilder> {
    const doc = await PdfDocument.load(data, options);
    return new PdfDocumentBuilder(doc);
  }

  // -------------------------------------------------------------------------
  // Metadata (chainable — all return `this`)
  // -------------------------------------------------------------------------

  /**
   * Set the document title.
   *
   * @param title    The title string.
   * @param options  Optional display options (e.g. show in window title bar).
   */
  setTitle(title: string, options?: SetTitleOptions): this {
    this.doc.setTitle(title, options);
    return this;
  }

  /** Set the document author. */
  setAuthor(author: string): this {
    this.doc.setAuthor(author);
    return this;
  }

  /** Set the document subject. */
  setSubject(subject: string): this {
    this.doc.setSubject(subject);
    return this;
  }

  /** Set the document keywords. */
  setKeywords(keywords: string[]): this {
    this.doc.setKeywords(keywords);
    return this;
  }

  /** Set the producer string. */
  setProducer(producer: string): this {
    this.doc.setProducer(producer);
    return this;
  }

  /** Set the creator application name. */
  setCreator(creator: string): this {
    this.doc.setCreator(creator);
    return this;
  }

  /** Set the document creation date. */
  setCreationDate(date: Date): this {
    this.doc.setCreationDate(date);
    return this;
  }

  /** Set the document modification date. */
  setModificationDate(date: Date): this {
    this.doc.setModDate(date);
    return this;
  }

  /**
   * Set the document's natural language (BCP 47 tag).
   *
   * @param lang  BCP 47 language tag (e.g. `"en"`, `"en-US"`, `"de-DE"`).
   */
  setLanguage(lang: string): this {
    this.doc.setLanguage(lang);
    return this;
  }

  // -------------------------------------------------------------------------
  // Pages (chainable with optional callback)
  // -------------------------------------------------------------------------

  /**
   * Add a page to the document.
   *
   * @param size   Page size as a `[width, height]` tuple, `{ width, height }`
   *               object, or one of the {@link PageSizes} constants.
   *               Defaults to A4 when omitted.
   * @param setup  Optional callback invoked with the newly created page.
   *               Use this to draw content on the page inline.
   */
  addPage(size?: PageSize, setup?: (page: PdfPage) => void): this {
    const page = this.doc.addPage(size);
    setup?.(page);
    return this;
  }

  /**
   * Add multiple pages with the same size and optional per-page setup.
   *
   * @param count  Number of pages to add.
   * @param size   Page size (defaults to A4).
   * @param setup  Optional callback invoked for each page with its
   *               zero-based index within this batch.
   */
  addPages(
    count: number,
    size?: PageSize,
    setup?: (page: PdfPage, index: number) => void,
  ): this {
    for (let i = 0; i < count; i++) {
      const page = this.doc.addPage(size);
      setup?.(page, i);
    }
    return this;
  }

  // -------------------------------------------------------------------------
  // Async resource embedding (callback pattern)
  // -------------------------------------------------------------------------

  /**
   * Embed a font and use it in a callback.
   *
   * Because font embedding is async (for TrueType fonts), this method
   * defers the operation and executes it when {@link save} is called.
   * The callback receives the {@link FontRef} and the builder so that
   * further pages can reference the font.
   *
   * @param fontNameOrData  Standard font name string or raw TTF/OTF bytes.
   * @param callback        Invoked with the embedded font reference and
   *                        the builder instance for continued chaining.
   */
  withFont(
    fontNameOrData: string | Uint8Array,
    callback: (font: FontRef, builder: PdfDocumentBuilder) => void,
  ): this {
    this.deferredOps.push(async () => {
      const font = await this.doc.embedFont(fontNameOrData);
      callback(font, this);
    });
    return this;
  }

  /**
   * Embed an image and use it in a callback.
   *
   * Because image embedding may be async (for JPEG, WebP, TIFF), this
   * method defers the operation and executes it when {@link save} is
   * called.  The callback receives the {@link ImageRef} and the builder.
   *
   * @param imageData  Raw image bytes (PNG, JPEG, WebP, or TIFF).
   * @param callback   Invoked with the embedded image reference and
   *                   the builder instance.
   */
  withImage(
    imageData: Uint8Array,
    callback: (image: ImageRef, builder: PdfDocumentBuilder) => void,
  ): this {
    this.deferredOps.push(async () => {
      const image = await this.doc.embedImage(imageData);
      callback(image, this);
    });
    return this;
  }

  // -------------------------------------------------------------------------
  // Document-level settings (chainable)
  // -------------------------------------------------------------------------

  /**
   * Configure encryption for this document.
   *
   * The encryption is applied when {@link save} serializes the document.
   *
   * @param options  Encryption options (passwords, algorithm, permissions).
   */
  encrypt(options: EncryptOptions): this {
    this.deferredOps.push(async () => {
      await this.doc.encrypt(options);
    });
    return this;
  }

  /**
   * Set page label ranges for the document.
   *
   * Page labels control how page numbers are displayed in the PDF
   * viewer's navigation controls and thumbnail panel.
   *
   * @param labels  An array of label range definitions, sorted by
   *                `startPage` in ascending order.
   */
  setPageLabels(labels: PageLabelRange[]): this {
    setPageLabels(this.doc, labels);
    return this;
  }

  /**
   * Add a bookmark (outline entry) to the document.
   *
   * @param options  Bookmark configuration (title, page, nesting, style).
   * @returns        The builder (for continued chaining).  The
   *                 {@link BookmarkRef} is not returned — use
   *                 {@link getDocument} if you need nested bookmarks.
   */
  addBookmark(options: AddBookmarkOptions): this {
    addBookmark(this.doc, options);
    return this;
  }

  // -------------------------------------------------------------------------
  // Build / escape hatch
  // -------------------------------------------------------------------------

  /**
   * Serialize the document to a `Uint8Array`.
   *
   * Executes all deferred async operations (font/image embedding,
   * encryption setup) before serializing.
   *
   * @param options  Compression and serialization options.
   * @returns        The complete PDF file as bytes.
   */
  async save(options?: PdfSaveOptions): Promise<Uint8Array> {
    // Execute all deferred operations in order
    for (const op of this.deferredOps) {
      await op();
    }
    // Clear deferred ops so save() is idempotent
    this.deferredOps.length = 0;

    return this.doc.save(options);
  }

  /**
   * Escape hatch — return the underlying {@link PdfDocument}.
   *
   * Use this when you need access to APIs not exposed by the builder
   * (e.g. `copyPages`, `getPage`, `embedPage`, advanced outline
   * manipulation, etc.).
   *
   * **Note:** Deferred operations (from {@link withFont}, {@link withImage},
   * {@link encrypt}) are NOT executed when calling this method.  They
   * are only resolved when {@link save} is called.
   */
  getDocument(): PdfDocument {
    return this.doc;
  }
}
