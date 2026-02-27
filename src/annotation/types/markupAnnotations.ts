/**
 * @module annotation/types/markupAnnotations
 *
 * Text markup annotations: Highlight, Underline, Squiggly, StrikeOut.
 *
 * These annotations use QuadPoints to define the regions of text they
 * mark.  Each quad is 8 numbers: the four corners of a quadrilateral
 * covering the text.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.10 (Text Markup Annotations).
 */

import {
  PdfDict,
  PdfArray,
  PdfNumber,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationType, AnnotationOptions } from '../pdfAnnotation.js';
import {
  generateHighlightAppearance,
  generateUnderlineAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
} from '../appearanceGenerator.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Extract QuadPoints from a dictionary. */
function getQuadPointsFromDict(dict: PdfDict): number[] {
  const obj = dict.get('/QuadPoints');
  if (obj && obj.kind === 'array') {
    return obj.items
      .filter((item): item is PdfNumber => item.kind === 'number')
      .map((item) => item.value);
  }
  return [];
}

/** Set QuadPoints on a dictionary. */
function setQuadPointsOnDict(dict: PdfDict, points: number[]): void {
  dict.set('/QuadPoints', PdfArray.fromNumbers(points));
}

/** Create quad points from a rectangle (for convenience). */
function rectToQuadPoints(rect: [number, number, number, number]): number[] {
  const [x1, y1, x2, y2] = rect;
  // QuadPoints order: bottom-left, bottom-right, top-left, top-right
  return [x1, y2, x2, y2, x1, y1, x2, y1];
}

// ---------------------------------------------------------------------------
// PdfHighlightAnnotation
// ---------------------------------------------------------------------------

/**
 * Highlight annotation (subtype /Highlight).
 *
 * Highlights text with a translucent colour overlay.
 */
export class PdfHighlightAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Highlight', dict);
  }

  /** Create a new highlight annotation. */
  static create(
    options: AnnotationOptions & { quadPoints?: number[] | undefined },
  ): PdfHighlightAnnotation {
    const dict = buildAnnotationDict('Highlight', options);
    const annot = new PdfHighlightAnnotation(dict);
    const qp = options.quadPoints ?? rectToQuadPoints(options.rect);
    annot.setQuadPoints(qp);
    return annot;
  }

  /**
   * Convenience: create a highlight for a rectangle region.
   */
  static createForRect(
    rect: [number, number, number, number],
    color?: { r: number; g: number; b: number } | undefined,
  ): PdfHighlightAnnotation {
    return PdfHighlightAnnotation.create({
      rect,
      color: color ?? { r: 1, g: 1, b: 0 },  // yellow default
    });
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfHighlightAnnotation {
    return new PdfHighlightAnnotation(dict);
  }

  /** Get the quad points array. */
  getQuadPoints(): number[] {
    return getQuadPointsFromDict(this.dict);
  }

  /** Set the quad points array. */
  setQuadPoints(points: number[]): void {
    setQuadPointsOnDict(this.dict, points);
  }

  override generateAppearance(): PdfStream {
    return generateHighlightAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfUnderlineAnnotation
// ---------------------------------------------------------------------------

/**
 * Underline annotation (subtype /Underline).
 */
export class PdfUnderlineAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Underline', dict);
  }

  static create(
    options: AnnotationOptions & { quadPoints?: number[] | undefined },
  ): PdfUnderlineAnnotation {
    const dict = buildAnnotationDict('Underline', options);
    const annot = new PdfUnderlineAnnotation(dict);
    const qp = options.quadPoints ?? rectToQuadPoints(options.rect);
    annot.setQuadPoints(qp);
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfUnderlineAnnotation {
    return new PdfUnderlineAnnotation(dict);
  }

  /** Get the quad points array. */
  getQuadPoints(): number[] {
    return getQuadPointsFromDict(this.dict);
  }

  /** Set the quad points array. */
  setQuadPoints(points: number[]): void {
    setQuadPointsOnDict(this.dict, points);
  }

  override generateAppearance(): PdfStream {
    return generateUnderlineAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfSquigglyAnnotation
// ---------------------------------------------------------------------------

/**
 * Squiggly underline annotation (subtype /Squiggly).
 */
export class PdfSquigglyAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Squiggly', dict);
  }

  static create(
    options: AnnotationOptions & { quadPoints?: number[] | undefined },
  ): PdfSquigglyAnnotation {
    const dict = buildAnnotationDict('Squiggly', options);
    const annot = new PdfSquigglyAnnotation(dict);
    const qp = options.quadPoints ?? rectToQuadPoints(options.rect);
    annot.setQuadPoints(qp);
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfSquigglyAnnotation {
    return new PdfSquigglyAnnotation(dict);
  }

  /** Get the quad points array. */
  getQuadPoints(): number[] {
    return getQuadPointsFromDict(this.dict);
  }

  /** Set the quad points array. */
  setQuadPoints(points: number[]): void {
    setQuadPointsOnDict(this.dict, points);
  }

  override generateAppearance(): PdfStream {
    return generateSquigglyAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfStrikeOutAnnotation
// ---------------------------------------------------------------------------

/**
 * Strike-out annotation (subtype /StrikeOut).
 */
export class PdfStrikeOutAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('StrikeOut', dict);
  }

  static create(
    options: AnnotationOptions & { quadPoints?: number[] | undefined },
  ): PdfStrikeOutAnnotation {
    const dict = buildAnnotationDict('StrikeOut', options);
    const annot = new PdfStrikeOutAnnotation(dict);
    const qp = options.quadPoints ?? rectToQuadPoints(options.rect);
    annot.setQuadPoints(qp);
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfStrikeOutAnnotation {
    return new PdfStrikeOutAnnotation(dict);
  }

  /** Get the quad points array. */
  getQuadPoints(): number[] {
    return getQuadPointsFromDict(this.dict);
  }

  /** Set the quad points array. */
  setQuadPoints(points: number[]): void {
    setQuadPointsOnDict(this.dict, points);
  }

  override generateAppearance(): PdfStream {
    return generateStrikeOutAppearance(this);
  }
}
