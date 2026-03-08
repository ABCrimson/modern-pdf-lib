/**
 * @module annotation/types/popupAnnotation
 *
 * Popup annotation — a floating window that displays the text of its
 * parent annotation (typically a text/sticky note annotation).
 *
 * Popup annotations have no appearance of their own; the PDF viewer
 * renders them as a resizable window near the parent annotation.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.14 (Popup Annotations).
 */

import {
  PdfDict,
  PdfBool,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// PdfPopupAnnotation
// ---------------------------------------------------------------------------

/**
 * A popup annotation (subtype /Popup).
 *
 * Displays a floating window containing the text of its parent
 * annotation. The parent annotation references this popup via its
 * `/Popup` entry, and this popup references its parent via `/Parent`.
 */
export class PdfPopupAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Popup', dict);
  }

  /**
   * Create a new popup annotation.
   *
   * @param options.open  Whether the popup is initially open. Default: false.
   */
  static create(
    options: AnnotationOptions & {
      open?: boolean | undefined;
    },
  ): PdfPopupAnnotation {
    const dict = buildAnnotationDict('Popup', options);
    const annot = new PdfPopupAnnotation(dict);
    if (options.open !== undefined) {
      annot.setOpen(options.open);
    }
    return annot;
  }

  /**
   * Create a PdfPopupAnnotation from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    _resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfPopupAnnotation {
    return new PdfPopupAnnotation(dict);
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

  // -----------------------------------------------------------------------
  // Parent reference
  // -----------------------------------------------------------------------

  /**
   * Set the parent annotation reference.
   * The parent is the annotation whose text this popup displays.
   */
  setParent(parentRef: PdfRef): void {
    this.dict.set('/Parent', parentRef);
  }

  /** Get the parent annotation reference, if set. */
  getParent(): PdfRef | undefined {
    const obj = this.dict.get('/Parent');
    if (obj && obj.kind === 'ref') {
      return obj;
    }
    return undefined;
  }
}
