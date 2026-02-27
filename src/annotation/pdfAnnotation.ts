/**
 * @module annotation/pdfAnnotation
 *
 * Base annotation class and factory for all PDF annotation types.
 *
 * PDF annotations represent interactive or visual elements overlaid on
 * a page (sticky notes, links, highlights, shapes, etc.).
 *
 * Reference: PDF 1.7 spec, Section 12.5 (Annotations).
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfBool,
  PdfRef,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfObject, PdfObjectRegistry } from '../core/pdfObjects.js';
import { formatPdfDate } from '../core/pdfCatalog.js';

// ---------------------------------------------------------------------------
// Annotation types
// ---------------------------------------------------------------------------

/**
 * All annotation subtypes defined in the PDF specification.
 */
export type AnnotationType =
  | 'Text' | 'Link' | 'FreeText' | 'Line' | 'Square' | 'Circle'
  | 'Polygon' | 'PolyLine' | 'Highlight' | 'Underline' | 'Squiggly'
  | 'StrikeOut' | 'Stamp' | 'Caret' | 'Ink' | 'Popup'
  | 'FileAttachment' | 'Sound' | 'Movie' | 'Widget' | 'Screen'
  | 'PrinterMark' | 'TrapNet' | 'Watermark' | 'Redact' | '3D';

// ---------------------------------------------------------------------------
// Annotation options
// ---------------------------------------------------------------------------

/**
 * Options for creating a new annotation.
 */
export interface AnnotationOptions {
  /** Annotation rectangle [x1, y1, x2, y2] in default user space. */
  rect: [number, number, number, number];
  /** Text contents (displayed as tooltip or popup). */
  contents?: string | undefined;
  /** Author / title of the annotation. */
  author?: string | undefined;
  /** Last modification date. */
  modificationDate?: Date | undefined;
  /** Colour in RGB (each component 0-1). */
  color?: { r: number; g: number; b: number } | undefined;
  /** Opacity (0 = transparent, 1 = opaque). */
  opacity?: number | undefined;
  /** Annotation flags bitmask (PDF spec Table 165). */
  flags?: number | undefined;
  /** Border specification. */
  border?: {
    width: number;
    style?: 'solid' | 'dashed' | 'beveled' | 'inset' | 'underline' | undefined;
  } | undefined;
}

// ---------------------------------------------------------------------------
// Annotation flags (PDF spec Table 165, 0-indexed bits)
// ---------------------------------------------------------------------------

/** Annotation flag bit positions. */
export const AnnotationFlags = {
  Invisible:      1 << 0,
  Hidden:         1 << 1,
  Print:          1 << 2,
  NoZoom:         1 << 3,
  NoRotate:       1 << 4,
  NoView:         1 << 5,
  ReadOnly:       1 << 6,
  Locked:         1 << 7,
  ToggleNoView:   1 << 8,
  LockedContents: 1 << 9,
} as const;

// ---------------------------------------------------------------------------
// Border style name mapping
// ---------------------------------------------------------------------------

const BORDER_STYLE_MAP: Record<string, string> = {
  solid: 'S',
  dashed: 'D',
  beveled: 'B',
  inset: 'I',
  underline: 'U',
};

// ---------------------------------------------------------------------------
// Unique name counter
// ---------------------------------------------------------------------------

let annotNameCounter = 0;

function generateUniqueName(): string {
  annotNameCounter++;
  return `annot-${Date.now()}-${annotNameCounter}`;
}

// ---------------------------------------------------------------------------
// Standalone factory functions
// ---------------------------------------------------------------------------

/**
 * Create a PdfAnnotation from an existing dictionary.
 *
 * @param dict     The annotation dictionary.
 * @param resolver Optional function to resolve indirect references.
 * @returns        A PdfAnnotation instance.
 */
export function annotationFromDict(
  dict: PdfDict,
  resolver?: (ref: PdfRef) => PdfObject | undefined,
): PdfAnnotation {
  let subtype: AnnotationType = 'Text';
  const subtypeObj = dict.get('/Subtype');
  if (subtypeObj && subtypeObj.kind === 'name') {
    const val = subtypeObj.value.startsWith('/')
      ? subtypeObj.value.slice(1)
      : subtypeObj.value;
    subtype = val as AnnotationType;
  }
  return new PdfAnnotation(subtype, dict);
}

/**
 * Build an annotation dictionary from options.
 *
 * Used internally by subclass factory methods to populate common
 * annotation dictionary entries.
 *
 * @param type    The annotation subtype.
 * @param options Creation options.
 * @returns       A populated PdfDict.
 */
export function buildAnnotationDict(
  type: AnnotationType,
  options: AnnotationOptions,
): PdfDict {
  const dict = new PdfDict();

  // Required entries
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of(type));
  dict.set(
    '/Rect',
    PdfArray.fromNumbers(options.rect),
  );

  // Unique name
  dict.set('/NM', PdfString.literal(generateUniqueName()));

  // Optional entries
  if (options.contents !== undefined) {
    dict.set('/Contents', PdfString.literal(options.contents));
  }
  if (options.author !== undefined) {
    dict.set('/T', PdfString.literal(options.author));
  }
  if (options.modificationDate !== undefined) {
    dict.set('/M', PdfString.literal(formatPdfDate(options.modificationDate)));
  }
  if (options.color !== undefined) {
    dict.set(
      '/C',
      PdfArray.fromNumbers([options.color.r, options.color.g, options.color.b]),
    );
  }
  if (options.opacity !== undefined) {
    dict.set('/CA', PdfNumber.of(options.opacity));
  }
  if (options.flags !== undefined) {
    dict.set('/F', PdfNumber.of(options.flags));
  }
  if (options.border !== undefined) {
    const bs = new PdfDict();
    bs.set('/W', PdfNumber.of(options.border.width));
    if (options.border.style !== undefined) {
      const pdfStyle = BORDER_STYLE_MAP[options.border.style] ?? 'S';
      bs.set('/S', PdfName.of(pdfStyle));
    }
    dict.set('/BS', bs);
  }

  return dict;
}

/**
 * Create a new annotation with the given type and options.
 *
 * This is a convenience function that creates a generic PdfAnnotation.
 * For type-specific annotations, use the subclass `create()` methods.
 *
 * @param type    The annotation subtype.
 * @param options Creation options (rect, contents, etc.).
 * @returns       A new PdfAnnotation instance.
 */
export function createAnnotation(
  type: AnnotationType,
  options: AnnotationOptions,
): PdfAnnotation {
  const dict = buildAnnotationDict(type, options);
  return new PdfAnnotation(type, dict);
}

// ---------------------------------------------------------------------------
// PdfAnnotation
// ---------------------------------------------------------------------------

/**
 * Base class for all PDF annotations.
 *
 * Wraps a PdfDict representing the annotation dictionary.  Subclasses
 * add type-specific getters/setters.
 */
export class PdfAnnotation {
  /** The annotation subtype. */
  readonly annotationType: AnnotationType;

  /** The underlying annotation dictionary. */
  protected dict: PdfDict;

  constructor(type: AnnotationType, dict: PdfDict) {
    this.annotationType = type;
    this.dict = dict;
  }

  // -----------------------------------------------------------------------
  // Type
  // -----------------------------------------------------------------------

  /** Get the annotation subtype. */
  getType(): AnnotationType {
    return this.annotationType;
  }

  // -----------------------------------------------------------------------
  // Rect
  // -----------------------------------------------------------------------

  /** Get the annotation rectangle [x1, y1, x2, y2]. */
  getRect(): [number, number, number, number] {
    const rectObj = this.dict.get('/Rect');
    if (rectObj && rectObj.kind === 'array') {
      const items = rectObj.items;
      return [
        (items[0] as PdfNumber | undefined)?.value ?? 0,
        (items[1] as PdfNumber | undefined)?.value ?? 0,
        (items[2] as PdfNumber | undefined)?.value ?? 0,
        (items[3] as PdfNumber | undefined)?.value ?? 0,
      ];
    }
    return [0, 0, 0, 0];
  }

  /** Set the annotation rectangle. */
  setRect(rect: [number, number, number, number]): void {
    this.dict.set('/Rect', PdfArray.fromNumbers(rect));
  }

  // -----------------------------------------------------------------------
  // Contents
  // -----------------------------------------------------------------------

  /** Get the text contents (tooltip / popup text). */
  getContents(): string | undefined {
    const obj = this.dict.get('/Contents');
    if (obj && obj.kind === 'string') {
      return obj.value;
    }
    return undefined;
  }

  /** Set the text contents. */
  setContents(contents: string): void {
    this.dict.set('/Contents', PdfString.literal(contents));
  }

  // -----------------------------------------------------------------------
  // Author
  // -----------------------------------------------------------------------

  /** Get the author (PDF /T entry). */
  getAuthor(): string | undefined {
    const obj = this.dict.get('/T');
    if (obj && obj.kind === 'string') {
      return obj.value;
    }
    return undefined;
  }

  /** Set the author. */
  setAuthor(author: string): void {
    this.dict.set('/T', PdfString.literal(author));
  }

  // -----------------------------------------------------------------------
  // Color
  // -----------------------------------------------------------------------

  /** Get the annotation colour. */
  getColor(): { r: number; g: number; b: number } | undefined {
    const obj = this.dict.get('/C');
    if (obj && obj.kind === 'array' && obj.items.length >= 3) {
      return {
        r: (obj.items[0] as PdfNumber | undefined)?.value ?? 0,
        g: (obj.items[1] as PdfNumber | undefined)?.value ?? 0,
        b: (obj.items[2] as PdfNumber | undefined)?.value ?? 0,
      };
    }
    return undefined;
  }

  /** Set the annotation colour. */
  setColor(color: { r: number; g: number; b: number }): void {
    this.dict.set('/C', PdfArray.fromNumbers([color.r, color.g, color.b]));
  }

  // -----------------------------------------------------------------------
  // Opacity
  // -----------------------------------------------------------------------

  /** Get the annotation opacity (0-1). Defaults to 1. */
  getOpacity(): number {
    const obj = this.dict.get('/CA');
    if (obj && obj.kind === 'number') {
      return obj.value;
    }
    return 1;
  }

  /** Set the annotation opacity. */
  setOpacity(opacity: number): void {
    this.dict.set('/CA', PdfNumber.of(opacity));
  }

  // -----------------------------------------------------------------------
  // Flags
  // -----------------------------------------------------------------------

  /** Get the raw flags bitmask. */
  private getFlags(): number {
    const obj = this.dict.get('/F');
    if (obj && obj.kind === 'number') {
      return obj.value;
    }
    return 0;
  }

  /** Set the raw flags bitmask. */
  private setFlags(flags: number): void {
    this.dict.set('/F', PdfNumber.of(flags));
  }

  /** Check if a specific flag bit is set. */
  private hasFlag(flag: number): boolean {
    return (this.getFlags() & flag) !== 0;
  }

  /** Set or clear a specific flag bit. */
  private setFlag(flag: number, value: boolean): void {
    let flags = this.getFlags();
    if (value) {
      flags |= flag;
    } else {
      flags &= ~flag;
    }
    this.setFlags(flags);
  }

  /** Whether the annotation is hidden. */
  isHidden(): boolean {
    return this.hasFlag(AnnotationFlags.Hidden);
  }

  /** Set the hidden flag. */
  setHidden(hidden: boolean): void {
    this.setFlag(AnnotationFlags.Hidden, hidden);
  }

  /** Whether the annotation should be printed. */
  isPrintable(): boolean {
    return this.hasFlag(AnnotationFlags.Print);
  }

  /** Set the print flag. */
  setPrintable(printable: boolean): void {
    this.setFlag(AnnotationFlags.Print, printable);
  }

  /** Whether the annotation is locked (cannot be moved/resized). */
  isLocked(): boolean {
    return this.hasFlag(AnnotationFlags.Locked);
  }

  /** Set the locked flag. */
  setLocked(locked: boolean): void {
    this.setFlag(AnnotationFlags.Locked, locked);
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /**
   * Convert this annotation to a PdfDict suitable for embedding in a PDF.
   *
   * @param registry  The object registry (used to register sub-objects).
   * @returns         The annotation dictionary.
   */
  toDict(registry: PdfObjectRegistry): PdfDict {
    // The dict is already fully formed; generate appearance if possible
    const ap = this.generateAppearance();
    if (ap) {
      const apRef = registry.register(ap);
      const apDict = new PdfDict();
      apDict.set('/N', apRef);
      this.dict.set('/AP', apDict);
    }
    return this.dict;
  }

  /**
   * Generate an appearance stream for this annotation.
   *
   * The base implementation returns `undefined`.  Subclasses override
   * to produce proper visual appearance.
   *
   * @returns A PdfStream for the /AP /N entry, or undefined.
   */
  generateAppearance(): PdfStream | undefined {
    return undefined;
  }

  /**
   * Get the underlying dictionary (for internal use).
   * @internal
   */
  getDict(): PdfDict {
    return this.dict;
  }
}
