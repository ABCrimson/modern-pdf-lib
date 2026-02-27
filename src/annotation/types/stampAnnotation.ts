/**
 * @module annotation/types/stampAnnotation
 *
 * Stamp annotation — displays a predefined or custom rubber stamp
 * on the page (e.g. "Approved", "Draft", "Confidential").
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.12 (Rubber Stamp Annotations).
 */

import {
  PdfDict,
  PdfName,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Standard stamp names (PDF spec Table 181)
// ---------------------------------------------------------------------------

/** Standard stamp names defined in the PDF specification. */
export type StandardStampName =
  | 'Approved'
  | 'Experimental'
  | 'NotApproved'
  | 'AsIs'
  | 'Expired'
  | 'NotForPublicRelease'
  | 'Confidential'
  | 'Final'
  | 'Sold'
  | 'Departmental'
  | 'ForComment'
  | 'TopSecret'
  | 'Draft'
  | 'ForPublicRelease';

// ---------------------------------------------------------------------------
// PdfStampAnnotation
// ---------------------------------------------------------------------------

/**
 * A stamp annotation (subtype /Stamp).
 *
 * Displays a graphical stamp on the page, similar to a rubber stamp
 * applied to a physical document.
 */
export class PdfStampAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Stamp', dict);
  }

  /**
   * Create a new stamp annotation.
   */
  static create(
    options: AnnotationOptions & {
      stampName?: string | undefined;
    },
  ): PdfStampAnnotation {
    const dict = buildAnnotationDict('Stamp', options);
    const annot = new PdfStampAnnotation(dict);
    annot.setStampName(options.stampName ?? 'Draft');
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfStampAnnotation {
    return new PdfStampAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Stamp name
  // -----------------------------------------------------------------------

  /** Get the stamp name (e.g. 'Approved', 'Draft'). */
  getStampName(): string {
    const obj = this.dict.get('/Name');
    if (obj && obj.kind === 'name') {
      return obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
    }
    return 'Draft';
  }

  /** Set the stamp name. */
  setStampName(name: string): void {
    this.dict.set('/Name', PdfName.of(name));
  }
}
