/**
 * @module annotation/types/freeTextAnnotation
 *
 * FreeText annotation — displays text directly on the page without
 * requiring the user to click an icon.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.6 (Free Text Annotations).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';
import { generateFreeTextAppearance } from '../appearanceGenerator.js';

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

/** Text alignment for free text annotations. */
export type FreeTextAlignment = 'left' | 'center' | 'right';

const ALIGNMENT_MAP: Record<FreeTextAlignment, number> = {
  left: 0,
  center: 1,
  right: 2,
};

const ALIGNMENT_REVERSE: Record<number, FreeTextAlignment> = {
  0: 'left',
  1: 'center',
  2: 'right',
};

// ---------------------------------------------------------------------------
// PdfFreeTextAnnotation
// ---------------------------------------------------------------------------

/**
 * A free text annotation (subtype /FreeText).
 *
 * Displays text directly on the page as if it were part of the page
 * content.  Does not require opening a popup.
 */
export class PdfFreeTextAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('FreeText', dict);
  }

  /**
   * Create a new free text annotation.
   */
  static create(
    options: AnnotationOptions & {
      text?: string | undefined;
      fontSize?: number | undefined;
      alignment?: FreeTextAlignment | undefined;
      defaultAppearance?: string | undefined;
    },
  ): PdfFreeTextAnnotation {
    const dict = buildAnnotationDict('FreeText', options);
    const annot = new PdfFreeTextAnnotation(dict);

    // Set default appearance string
    const fontSize = options.fontSize ?? 12;
    const da = options.defaultAppearance ?? `0 0 0 rg /Helv ${fontSize} Tf`;
    annot.setDefaultAppearance(da);

    if (options.text !== undefined) {
      annot.setText(options.text);
    }
    if (options.alignment !== undefined) {
      annot.setAlignment(options.alignment);
    }

    return annot;
  }

  /**
   * Create from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfFreeTextAnnotation {
    return new PdfFreeTextAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Text
  // -----------------------------------------------------------------------

  /** Get the displayed text. */
  getText(): string {
    return this.getContents() ?? '';
  }

  /** Set the displayed text. */
  setText(text: string): void {
    this.setContents(text);
  }

  // -----------------------------------------------------------------------
  // Font size
  // -----------------------------------------------------------------------

  /** Get the font size from the default appearance string. */
  getFontSize(): number {
    const da = this.getDefaultAppearance();
    // Parse "... /FontName SIZE Tf ..."
    const match = /\/\w+\s+([\d.]+)\s+Tf/.exec(da);
    if (match?.[1]) {
      return parseFloat(match[1]);
    }
    return 12;
  }

  /** Set the font size (rebuilds the default appearance string). */
  setFontSize(size: number): void {
    let da = this.getDefaultAppearance();
    // Replace font size in existing DA string
    const replaced = da.replace(
      /(\/\w+)\s+[\d.]+\s+Tf/,
      `$1 ${size} Tf`,
    );
    if (replaced !== da) {
      this.setDefaultAppearance(replaced);
    } else {
      // No Tf operator found, append one
      this.setDefaultAppearance(`${da} /Helv ${size} Tf`);
    }
  }

  // -----------------------------------------------------------------------
  // Alignment
  // -----------------------------------------------------------------------

  /** Get the text alignment. Defaults to 'left'. */
  getAlignment(): FreeTextAlignment {
    const obj = this.dict.get('/Q');
    if (obj && obj.kind === 'number') {
      return ALIGNMENT_REVERSE[obj.value] ?? 'left';
    }
    return 'left';
  }

  /** Set the text alignment. */
  setAlignment(align: FreeTextAlignment): void {
    this.dict.set('/Q', PdfNumber.of(ALIGNMENT_MAP[align]));
  }

  // -----------------------------------------------------------------------
  // Default appearance
  // -----------------------------------------------------------------------

  /** Get the default appearance string (/DA). */
  getDefaultAppearance(): string {
    const obj = this.dict.get('/DA');
    if (obj && obj.kind === 'string') {
      return obj.value;
    }
    return '0 0 0 rg /Helv 12 Tf';
  }

  /** Set the default appearance string. */
  setDefaultAppearance(da: string): void {
    this.dict.set('/DA', PdfString.literal(da));
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this free text annotation. */
  override generateAppearance(): PdfStream {
    return generateFreeTextAppearance(this);
  }
}
