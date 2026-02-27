/**
 * @module annotation/types/textAnnotation
 *
 * Sticky note (text) annotation — a small icon that, when clicked,
 * opens a popup window containing the annotation text.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.4 (Text Annotations).
 */

import {
  PdfDict,
  PdfName,
  PdfString,
  PdfBool,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Icon names (PDF spec Table 172)
// ---------------------------------------------------------------------------

/** Standard icon names for text annotations. */
export type TextAnnotationIcon =
  | 'Comment'
  | 'Key'
  | 'Note'
  | 'Help'
  | 'NewParagraph'
  | 'Paragraph'
  | 'Insert';

// ---------------------------------------------------------------------------
// PdfTextAnnotation
// ---------------------------------------------------------------------------

/**
 * A sticky note annotation (subtype /Text).
 *
 * Displays a small icon on the page; clicking the icon opens a popup
 * containing the annotation's text.
 */
export class PdfTextAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Text', dict);
  }

  /**
   * Create a new text (sticky note) annotation.
   */
  static create(
    options: AnnotationOptions & {
      icon?: TextAnnotationIcon | undefined;
      open?: boolean | undefined;
    },
  ): PdfTextAnnotation {
    const dict = buildAnnotationDict('Text', options);
    const annot = new PdfTextAnnotation(dict);
    if (options.icon !== undefined) {
      annot.setIcon(options.icon);
    }
    if (options.open !== undefined) {
      annot.setOpen(options.open);
    }
    return annot;
  }

  /**
   * Create a PdfTextAnnotation from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfTextAnnotation {
    return new PdfTextAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Icon
  // -----------------------------------------------------------------------

  /** Get the icon name. Defaults to 'Note'. */
  getIcon(): string {
    const obj = this.dict.get('/Name');
    if (obj && obj.kind === 'name') {
      return obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
    }
    return 'Note';
  }

  /** Set the icon name. */
  setIcon(icon: string): void {
    this.dict.set('/Name', PdfName.of(icon));
  }

  // -----------------------------------------------------------------------
  // Open state
  // -----------------------------------------------------------------------

  /** Whether the popup is initially open. */
  isOpen(): boolean {
    const obj = this.dict.get('/Open');
    if (obj && obj.kind === 'bool') {
      return obj.value;
    }
    return false;
  }

  /** Set the initial open state. */
  setOpen(open: boolean): void {
    this.dict.set('/Open', PdfBool.of(open));
  }
}
