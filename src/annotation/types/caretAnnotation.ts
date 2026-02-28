/**
 * @module annotation/types/caretAnnotation
 *
 * Caret annotation — marks a text insertion point in the document.
 *
 * A caret annotation indicates where text should be inserted. It is
 * typically used in document review workflows to suggest additions.
 * The annotation renders as a caret (^) symbol at the specified
 * location.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.11 (Caret Annotations).
 */

import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Caret symbol
// ---------------------------------------------------------------------------

/**
 * Symbol displayed by the caret annotation.
 *
 * - `'None'` — No symbol (just the caret marker).
 * - `'P'` — A paragraph symbol, indicating a new paragraph should
 *   be inserted at this location.
 */
export type CaretSymbol = 'None' | 'P';

// ---------------------------------------------------------------------------
// PdfCaretAnnotation
// ---------------------------------------------------------------------------

/**
 * A caret annotation (subtype /Caret).
 *
 * Marks an insertion point in the text. Used in review workflows
 * to indicate where new content should be added.
 */
export class PdfCaretAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Caret', dict);
  }

  /**
   * Create a new caret annotation.
   *
   * @param options.symbol  The caret symbol. Default: 'None'.
   * @param options.caretRect  The inner rectangle (RD) that describes
   *   the difference between the annotation rect and the actual caret
   *   position. Format: [left, bottom, right, top] insets.
   */
  static create(
    options: AnnotationOptions & {
      symbol?: CaretSymbol | undefined;
      caretRect?: [number, number, number, number] | undefined;
    },
  ): PdfCaretAnnotation {
    const dict = buildAnnotationDict('Caret', options);
    const annot = new PdfCaretAnnotation(dict);
    if (options.symbol !== undefined) {
      annot.setSymbol(options.symbol);
    }
    if (options.caretRect !== undefined) {
      annot.setCaretRect(options.caretRect);
    }
    return annot;
  }

  /**
   * Create a PdfCaretAnnotation from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    _resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfCaretAnnotation {
    return new PdfCaretAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Symbol
  // -----------------------------------------------------------------------

  /** Get the caret symbol. Defaults to 'None'. */
  getSymbol(): CaretSymbol {
    const obj = this.dict.get('/Sy');
    if (obj && obj.kind === 'name') {
      const val = obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
      if (val === 'P') return 'P';
    }
    return 'None';
  }

  /** Set the caret symbol. */
  setSymbol(symbol: CaretSymbol): void {
    this.dict.set('/Sy', PdfName.of(symbol));
  }

  // -----------------------------------------------------------------------
  // Caret inner rectangle (RD)
  // -----------------------------------------------------------------------

  /**
   * Get the inner rectangle differences (RD entry).
   * Returns [left, bottom, right, top] insets from the annotation rect.
   */
  getCaretRect(): [number, number, number, number] | undefined {
    const obj = this.dict.get('/RD');
    if (obj && obj.kind === 'array' && obj.items.length === 4) {
      return obj.items.map((item) => {
        if (item.kind === 'number') return item.value;
        return 0;
      }) as [number, number, number, number];
    }
    return undefined;
  }

  /** Set the inner rectangle differences (RD entry). */
  setCaretRect(rd: [number, number, number, number]): void {
    this.dict.set('/RD', PdfArray.of(rd.map(PdfNumber.of)));
  }
}
