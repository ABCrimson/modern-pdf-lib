/**
 * @module annotation/types/inkAnnotation
 *
 * Ink annotation — represents freehand "scribble" composed of one
 * or more disjoint paths (ink lists).
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.13 (Ink Annotations).
 */

import {
  PdfDict,
  PdfArray,
  PdfNumber,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';
import { generateInkAppearance } from '../appearanceGenerator.js';

// ---------------------------------------------------------------------------
// PdfInkAnnotation
// ---------------------------------------------------------------------------

/**
 * An ink annotation (subtype /Ink).
 *
 * Contains one or more ink paths, each being an array of coordinate
 * pairs [x1,y1,x2,y2,...] representing a freehand stroke.
 */
export class PdfInkAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Ink', dict);
  }

  /**
   * Create a new ink annotation.
   */
  static create(
    options: AnnotationOptions & {
      inkLists?: number[][] | undefined;
    },
  ): PdfInkAnnotation {
    const dict = buildAnnotationDict('Ink', options);
    const annot = new PdfInkAnnotation(dict);
    if (options.inkLists !== undefined) {
      for (const list of options.inkLists) {
        annot.addInkList(list);
      }
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfInkAnnotation {
    return new PdfInkAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Ink lists
  // -----------------------------------------------------------------------

  /**
   * Get all ink lists.
   *
   * Each ink list is an array of numbers [x1,y1,x2,y2,...] representing
   * a single stroke path.
   */
  getInkLists(): number[][] {
    const obj = this.dict.get('/InkList');
    if (!obj || obj.kind !== 'array') return [];

    const lists: number[][] = [];
    for (const item of obj.items) {
      if (item.kind === 'array') {
        const points = item.items
          .filter((p): p is PdfNumber => p.kind === 'number')
          .map((p) => p.value);
        lists.push(points);
      }
    }
    return lists;
  }

  /**
   * Add a new ink stroke path.
   *
   * @param points Array of coordinate pairs [x1,y1,x2,y2,...].
   */
  addInkList(points: number[]): void {
    let inkListArr = this.dict.get('/InkList');
    if (!inkListArr || inkListArr.kind !== 'array') {
      inkListArr = new PdfArray();
      this.dict.set('/InkList', inkListArr);
    }
    (inkListArr as PdfArray).push(PdfArray.fromNumbers(points));
  }

  /** Remove all ink stroke paths. */
  clearInkLists(): void {
    this.dict.set('/InkList', new PdfArray());
  }

  // -----------------------------------------------------------------------
  // Appearance
  // -----------------------------------------------------------------------

  override generateAppearance(): PdfStream {
    return generateInkAppearance(this);
  }
}
