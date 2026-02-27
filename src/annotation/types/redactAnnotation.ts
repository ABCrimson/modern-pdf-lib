/**
 * @module annotation/types/redactAnnotation
 *
 * Redact annotation — marks a region of the page for redaction.
 * When applied, the redacted content is permanently removed and
 * the area is covered with an overlay.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.23 (Redaction Annotations).
 */

import {
  PdfDict,
  PdfArray,
  PdfNumber,
  PdfString,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// PdfRedactAnnotation
// ---------------------------------------------------------------------------

/**
 * A redaction annotation (subtype /Redact).
 *
 * Marks content for redaction.  The annotation itself is a marker;
 * the actual redaction (content removal) must be applied separately.
 */
export class PdfRedactAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Redact', dict);
  }

  /**
   * Create a new redact annotation.
   */
  static create(
    options: AnnotationOptions & {
      overlayText?: string | undefined;
      interiorColor?: { r: number; g: number; b: number } | undefined;
      quadPoints?: number[] | undefined;
    },
  ): PdfRedactAnnotation {
    const dict = buildAnnotationDict('Redact', options);
    const annot = new PdfRedactAnnotation(dict);
    if (options.overlayText !== undefined) {
      annot.setOverlayText(options.overlayText);
    }
    if (options.interiorColor !== undefined) {
      annot.setInteriorColor(options.interiorColor);
    }
    if (options.quadPoints !== undefined) {
      annot.setQuadPoints(options.quadPoints);
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfRedactAnnotation {
    return new PdfRedactAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Overlay text
  // -----------------------------------------------------------------------

  /** Get the overlay text displayed after redaction is applied. */
  getOverlayText(): string | undefined {
    const obj = this.dict.get('/OverlayText');
    if (obj && obj.kind === 'string') {
      return obj.value;
    }
    return undefined;
  }

  /** Set the overlay text. */
  setOverlayText(text: string): void {
    this.dict.set('/OverlayText', PdfString.literal(text));
  }

  // -----------------------------------------------------------------------
  // Interior color
  // -----------------------------------------------------------------------

  /** Get the interior (fill) color used after redaction. */
  getInteriorColor(): { r: number; g: number; b: number } | undefined {
    const obj = this.dict.get('/IC');
    if (obj && obj.kind === 'array' && obj.items.length >= 3) {
      return {
        r: (obj.items[0] as PdfNumber | undefined)?.value ?? 0,
        g: (obj.items[1] as PdfNumber | undefined)?.value ?? 0,
        b: (obj.items[2] as PdfNumber | undefined)?.value ?? 0,
      };
    }
    return undefined;
  }

  /** Set the interior color. */
  setInteriorColor(color: { r: number; g: number; b: number }): void {
    this.dict.set('/IC', PdfArray.fromNumbers([color.r, color.g, color.b]));
  }

  // -----------------------------------------------------------------------
  // Quad points
  // -----------------------------------------------------------------------

  /** Get the quad points (regions to redact). */
  getQuadPoints(): number[] | undefined {
    const obj = this.dict.get('/QuadPoints');
    if (obj && obj.kind === 'array') {
      return obj.items
        .filter((item): item is PdfNumber => item.kind === 'number')
        .map((item) => item.value);
    }
    return undefined;
  }

  /** Set the quad points. */
  setQuadPoints(points: number[]): void {
    this.dict.set('/QuadPoints', PdfArray.fromNumbers(points));
  }
}
