/**
 * @module annotation/types/shapeAnnotations
 *
 * Geometric shape annotations: Line, Square, Circle, Polygon, PolyLine.
 *
 * Reference: PDF 1.7 spec, Sections 12.5.6.7-12.5.6.9.
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';
import {
  generateLineAppearance,
  generateSquareAppearance,
  generateCircleAppearance,
} from '../appearanceGenerator.js';

// ---------------------------------------------------------------------------
// Line ending styles (PDF spec Table 176)
// ---------------------------------------------------------------------------

/** Line ending style names. */
export type LineEndingStyle =
  | 'None'
  | 'Square'
  | 'Circle'
  | 'Diamond'
  | 'OpenArrow'
  | 'ClosedArrow'
  | 'Butt'
  | 'ROpenArrow'
  | 'RClosedArrow'
  | 'Slash';

// ---------------------------------------------------------------------------
// Helper: interior color
// ---------------------------------------------------------------------------

function getInteriorColor(dict: PdfDict): { r: number; g: number; b: number } | undefined {
  const obj = dict.get('/IC');
  if (obj && obj.kind === 'array' && obj.items.length >= 3) {
    return {
      r: (obj.items[0] as PdfNumber | undefined)?.value ?? 0,
      g: (obj.items[1] as PdfNumber | undefined)?.value ?? 0,
      b: (obj.items[2] as PdfNumber | undefined)?.value ?? 0,
    };
  }
  return undefined;
}

function setInteriorColor(
  dict: PdfDict,
  color: { r: number; g: number; b: number },
): void {
  dict.set('/IC', PdfArray.fromNumbers([color.r, color.g, color.b]));
}

// ---------------------------------------------------------------------------
// PdfLineAnnotation
// ---------------------------------------------------------------------------

/**
 * Line annotation (subtype /Line).
 *
 * Draws a straight line between two points on the page.
 */
export class PdfLineAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Line', dict);
  }

  /**
   * Create a new line annotation.
   */
  static create(
    options: AnnotationOptions & {
      linePoints?: [number, number, number, number] | undefined;
      lineEndingStart?: LineEndingStyle | undefined;
      lineEndingEnd?: LineEndingStyle | undefined;
    },
  ): PdfLineAnnotation {
    const dict = buildAnnotationDict('Line', options);
    const annot = new PdfLineAnnotation(dict);
    if (options.linePoints !== undefined) {
      annot.setLinePoints(options.linePoints);
    }
    if (options.lineEndingStart !== undefined || options.lineEndingEnd !== undefined) {
      annot.setLineEndingStyles(
        options.lineEndingStart ?? 'None',
        options.lineEndingEnd ?? 'None',
      );
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfLineAnnotation {
    return new PdfLineAnnotation(dict);
  }

  /** Get the line endpoints [x1, y1, x2, y2]. */
  getLinePoints(): [number, number, number, number] {
    const obj = this.dict.get('/L');
    if (obj && obj.kind === 'array' && obj.items.length >= 4) {
      return [
        (obj.items[0] as PdfNumber | undefined)?.value ?? 0,
        (obj.items[1] as PdfNumber | undefined)?.value ?? 0,
        (obj.items[2] as PdfNumber | undefined)?.value ?? 0,
        (obj.items[3] as PdfNumber | undefined)?.value ?? 0,
      ];
    }
    return [0, 0, 0, 0];
  }

  /** Set the line endpoints. */
  setLinePoints(points: [number, number, number, number]): void {
    this.dict.set('/L', PdfArray.fromNumbers(points));
  }

  /** Get the line ending styles [start, end]. */
  getLineEndingStyles(): [string, string] {
    const obj = this.dict.get('/LE');
    if (obj && obj.kind === 'array' && obj.items.length >= 2) {
      const start = obj.items[0];
      const end = obj.items[1];
      const sVal = start && start.kind === 'name'
        ? (start.value.startsWith('/') ? start.value.slice(1) : start.value)
        : 'None';
      const eVal = end && end.kind === 'name'
        ? (end.value.startsWith('/') ? end.value.slice(1) : end.value)
        : 'None';
      return [sVal, eVal];
    }
    return ['None', 'None'];
  }

  /** Set the line ending styles. */
  setLineEndingStyles(start: string, end: string): void {
    this.dict.set('/LE', PdfArray.of([PdfName.of(start), PdfName.of(end)]));
  }

  override generateAppearance(): PdfStream {
    return generateLineAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfSquareAnnotation
// ---------------------------------------------------------------------------

/**
 * Square annotation (subtype /Square).
 *
 * Draws a rectangle on the page.
 */
export class PdfSquareAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Square', dict);
  }

  static create(
    options: AnnotationOptions & {
      interiorColor?: { r: number; g: number; b: number } | undefined;
    },
  ): PdfSquareAnnotation {
    const dict = buildAnnotationDict('Square', options);
    const annot = new PdfSquareAnnotation(dict);
    if (options.interiorColor !== undefined) {
      annot.setInteriorColor(options.interiorColor);
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfSquareAnnotation {
    return new PdfSquareAnnotation(dict);
  }

  /** Get the interior (fill) color. */
  getInteriorColor(): { r: number; g: number; b: number } | undefined {
    return getInteriorColor(this.dict);
  }

  /** Set the interior (fill) color. */
  setInteriorColor(color: { r: number; g: number; b: number }): void {
    setInteriorColor(this.dict, color);
  }

  override generateAppearance(): PdfStream {
    return generateSquareAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfCircleAnnotation
// ---------------------------------------------------------------------------

/**
 * Circle annotation (subtype /Circle).
 *
 * Draws an ellipse inscribed within the annotation rectangle.
 */
export class PdfCircleAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Circle', dict);
  }

  static create(
    options: AnnotationOptions & {
      interiorColor?: { r: number; g: number; b: number } | undefined;
    },
  ): PdfCircleAnnotation {
    const dict = buildAnnotationDict('Circle', options);
    const annot = new PdfCircleAnnotation(dict);
    if (options.interiorColor !== undefined) {
      annot.setInteriorColor(options.interiorColor);
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfCircleAnnotation {
    return new PdfCircleAnnotation(dict);
  }

  /** Get the interior (fill) color. */
  getInteriorColor(): { r: number; g: number; b: number } | undefined {
    return getInteriorColor(this.dict);
  }

  /** Set the interior (fill) color. */
  setInteriorColor(color: { r: number; g: number; b: number }): void {
    setInteriorColor(this.dict, color);
  }

  override generateAppearance(): PdfStream {
    return generateCircleAppearance(this);
  }
}

// ---------------------------------------------------------------------------
// PdfPolygonAnnotation
// ---------------------------------------------------------------------------

/**
 * Polygon annotation (subtype /Polygon).
 *
 * Draws a closed polygon on the page.
 */
export class PdfPolygonAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Polygon', dict);
  }

  static create(
    options: AnnotationOptions & {
      vertices?: number[] | undefined;
      interiorColor?: { r: number; g: number; b: number } | undefined;
    },
  ): PdfPolygonAnnotation {
    const dict = buildAnnotationDict('Polygon', options);
    const annot = new PdfPolygonAnnotation(dict);
    if (options.vertices !== undefined) {
      annot.setVertices(options.vertices);
    }
    if (options.interiorColor !== undefined) {
      annot.setInteriorColor(options.interiorColor);
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfPolygonAnnotation {
    return new PdfPolygonAnnotation(dict);
  }

  /** Get the polygon vertices as a flat array [x1,y1,x2,y2,...]. */
  getVertices(): number[] {
    const obj = this.dict.get('/Vertices');
    if (obj && obj.kind === 'array') {
      return obj.items
        .filter((item): item is PdfNumber => item.kind === 'number')
        .map((item) => item.value);
    }
    return [];
  }

  /** Set the polygon vertices. */
  setVertices(vertices: number[]): void {
    this.dict.set('/Vertices', PdfArray.fromNumbers(vertices));
  }

  /** Get the interior (fill) color. */
  getInteriorColor(): { r: number; g: number; b: number } | undefined {
    return getInteriorColor(this.dict);
  }

  /** Set the interior (fill) color. */
  setInteriorColor(color: { r: number; g: number; b: number }): void {
    setInteriorColor(this.dict, color);
  }
}

// ---------------------------------------------------------------------------
// PdfPolyLineAnnotation
// ---------------------------------------------------------------------------

/**
 * PolyLine annotation (subtype /PolyLine).
 *
 * Draws an open polyline (series of connected line segments).
 */
export class PdfPolyLineAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('PolyLine', dict);
  }

  static create(
    options: AnnotationOptions & {
      vertices?: number[] | undefined;
    },
  ): PdfPolyLineAnnotation {
    const dict = buildAnnotationDict('PolyLine', options);
    const annot = new PdfPolyLineAnnotation(dict);
    if (options.vertices !== undefined) {
      annot.setVertices(options.vertices);
    }
    return annot;
  }

  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfPolyLineAnnotation {
    return new PdfPolyLineAnnotation(dict);
  }

  /** Get the polyline vertices as a flat array [x1,y1,x2,y2,...]. */
  getVertices(): number[] {
    const obj = this.dict.get('/Vertices');
    if (obj && obj.kind === 'array') {
      return obj.items
        .filter((item): item is PdfNumber => item.kind === 'number')
        .map((item) => item.value);
    }
    return [];
  }

  /** Set the polyline vertices. */
  setVertices(vertices: number[]): void {
    this.dict.set('/Vertices', PdfArray.fromNumbers(vertices));
  }
}
