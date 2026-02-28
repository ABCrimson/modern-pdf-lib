/**
 * @module annotation/types/fileAttachmentAnnotation
 *
 * File attachment annotation — embeds a file as an inline annotation
 * on a page, displayed as a clickable icon.
 *
 * Unlike document-level attachments (via `attachFile()`), file attachment
 * annotations are positioned on a specific page and rendered as an icon
 * that users can click to open or save the embedded file.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.15 (File Attachment Annotations).
 */

import {
  PdfDict,
  PdfName,
  PdfString,
  PdfNumber,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef, PdfObjectRegistry } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Icon names (PDF spec Table 177)
// ---------------------------------------------------------------------------

/**
 * Standard icon names for file attachment annotations.
 *
 * - `'GraphPushPin'` — A push pin on a graph (default).
 * - `'PaperclipTag'` — A paper clip with a tag.
 * - `'Paperclip'` — A paper clip.
 * - `'Tag'` — A tag label.
 */
export type FileAttachmentIcon =
  | 'GraphPushPin'
  | 'PaperclipTag'
  | 'Paperclip'
  | 'Tag';

// ---------------------------------------------------------------------------
// PdfFileAttachmentAnnotation
// ---------------------------------------------------------------------------

/**
 * A file attachment annotation (subtype /FileAttachment).
 *
 * Embeds a file directly in the annotation, rendered as a clickable
 * icon on the page. When the user clicks the icon, the PDF viewer
 * allows them to open or save the embedded file.
 */
export class PdfFileAttachmentAnnotation extends PdfAnnotation {
  /** The raw file data to embed. */
  private fileData: Uint8Array | undefined;
  /** The filename to display. */
  private fileName: string | undefined;
  /** Optional MIME type. */
  private mimeType: string | undefined;
  /** Optional file description. */
  private fileDescription: string | undefined;

  constructor(dict: PdfDict) {
    super('FileAttachment', dict);
  }

  /**
   * Create a new file attachment annotation.
   *
   * @param options.file       The file data to embed.
   * @param options.fileName   The filename (e.g., 'invoice.xml').
   * @param options.mimeType   Optional MIME type (e.g., 'application/xml').
   * @param options.description Optional description of the file.
   * @param options.icon       Icon to display. Default: 'GraphPushPin'.
   */
  static create(
    options: AnnotationOptions & {
      file: Uint8Array;
      fileName: string;
      mimeType?: string | undefined;
      description?: string | undefined;
      icon?: FileAttachmentIcon | undefined;
    },
  ): PdfFileAttachmentAnnotation {
    const dict = buildAnnotationDict('FileAttachment', options);
    const annot = new PdfFileAttachmentAnnotation(dict);

    annot.fileData = options.file;
    annot.fileName = options.fileName;
    annot.mimeType = options.mimeType;
    annot.fileDescription = options.description;

    if (options.icon !== undefined) {
      annot.setIcon(options.icon);
    }

    return annot;
  }

  /**
   * Create a PdfFileAttachmentAnnotation from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    _resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfFileAttachmentAnnotation {
    return new PdfFileAttachmentAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Icon
  // -----------------------------------------------------------------------

  /** Get the icon name. Defaults to 'GraphPushPin'. */
  getIcon(): FileAttachmentIcon {
    const obj = this.dict.get('/Name');
    if (obj && obj.kind === 'name') {
      const val = obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
      if (['GraphPushPin', 'PaperclipTag', 'Paperclip', 'Tag'].includes(val)) {
        return val as FileAttachmentIcon;
      }
    }
    return 'GraphPushPin';
  }

  /** Set the icon name. */
  setIcon(icon: FileAttachmentIcon): void {
    this.dict.set('/Name', PdfName.of(icon));
  }

  // -----------------------------------------------------------------------
  // File specification
  // -----------------------------------------------------------------------

  /** Get the filename, if set. */
  getFileName(): string | undefined {
    // Check the /FS dict for /F or /UF entries
    const fs = this.dict.get('/FS');
    if (fs && fs.kind === 'dict') {
      const uf = fs.get('/UF');
      if (uf && uf.kind === 'string') return uf.value;
      const f = fs.get('/F');
      if (f && f.kind === 'string') return f.value;
    }
    return this.fileName;
  }

  /**
   * Build the file specification dictionary and register the embedded
   * file stream. Call this before serializing the annotation.
   *
   * @param registry  The document's object registry.
   * @returns  The annotation dict with `/FS` referencing the file.
   */
  buildFileSpec(registry: PdfObjectRegistry): PdfDict {
    if (!this.fileData || !this.fileName) {
      return this.dict;
    }

    // Build the embedded file stream
    const efStreamDict = new PdfDict();
    efStreamDict.set('/Type', PdfName.of('EmbeddedFile'));
    if (this.mimeType) {
      efStreamDict.set('/Subtype', PdfName.of(this.mimeType.replace('/', '#2F')));
    }

    const params = new PdfDict();
    params.set('/Size', PdfNumber.of(this.fileData.length));
    efStreamDict.set('/Params', params);

    const efStream = new PdfStream(efStreamDict, this.fileData);
    const efRef = registry.register(efStream);

    // Build the EF dictionary
    const efDict = new PdfDict();
    efDict.set('/F', efRef);

    // Build the file spec dictionary
    const fsDict = new PdfDict();
    fsDict.set('/Type', PdfName.of('Filespec'));
    fsDict.set('/F', PdfString.literal(this.fileName));
    fsDict.set('/UF', PdfString.literal(this.fileName));
    fsDict.set('/EF', efDict);
    if (this.fileDescription) {
      fsDict.set('/Desc', PdfString.literal(this.fileDescription));
    }

    const fsRef = registry.register(fsDict);
    this.dict.set('/FS', fsRef);

    return this.dict;
  }
}
