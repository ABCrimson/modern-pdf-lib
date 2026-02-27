/**
 * @module form/fields/textField
 *
 * PDF text form field (/FT /Tx).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.3 (Text Fields).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
  PdfRef,
} from '../../core/pdfObjects.js';
import { PdfField, FieldFlags, numVal, strVal } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateTextAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number for PDF content stream output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// PdfTextField
// ---------------------------------------------------------------------------

/**
 * A PDF text form field (/FT /Tx).
 *
 * Stores a string value and supports properties like alignment,
 * multiline mode, password masking, and maximum length.
 */
export class PdfTextField extends PdfField {
  readonly fieldType: FieldType = 'text';

  // -----------------------------------------------------------------------
  // Value access
  // -----------------------------------------------------------------------

  /** Get the text value of this field. */
  getText(): string {
    return strVal(this.dict.get('/V')) ?? '';
  }

  /**
   * Set the text value of this field.
   * Also updates /V and removes /AP to force regeneration.
   */
  setText(value: string): void {
    this.dict.set('/V', PdfString.literal(value));
    // Remove existing appearance so a new one is generated
    this.widgetDict.delete('/AP');
  }

  /** Alias for getText(). */
  getValue(): string {
    return this.getText();
  }

  /** Alias for setText(). */
  setValue(value: string | boolean | string[]): void {
    this.setText(typeof value === 'string' ? value : String(value));
  }

  // -----------------------------------------------------------------------
  // Font properties
  // -----------------------------------------------------------------------

  /**
   * Get the font size from the /DA (default appearance) string.
   * Returns 0 if the font size is not specified or is auto.
   */
  getFontSize(): number {
    const da = strVal(this.dict.get('/DA'));
    if (da === undefined) return 0;
    // DA format: "/FontName size Tf [color ops]"
    const match = da.match(/\/(\w+)\s+([\d.]+)\s+Tf/);
    if (match?.[2] !== undefined) {
      return parseFloat(match[2]);
    }
    return 0;
  }

  /**
   * Set the font size in the /DA string.
   * Creates or updates the /DA entry.
   */
  setFontSize(size: number): void {
    const fontName = this.getFontName();
    this.dict.set('/DA', PdfString.literal(`/${fontName} ${size} Tf 0 g`));
    this.widgetDict.delete('/AP');
  }

  /**
   * Get the font name from the /DA string.
   * Returns "Helv" (Helvetica) as default.
   */
  getFontName(): string {
    const da = strVal(this.dict.get('/DA'));
    if (da === undefined) return 'Helv';
    const match = da.match(/\/(\w+)\s+[\d.]+\s+Tf/);
    return match?.[1] ?? 'Helv';
  }

  // -----------------------------------------------------------------------
  // Alignment (quadding)
  // -----------------------------------------------------------------------

  /**
   * Get the text alignment.
   * /Q: 0 = left, 1 = center, 2 = right.
   */
  getAlignment(): 'left' | 'center' | 'right' {
    const q = numVal(this.dict.get('/Q'));
    switch (q) {
      case 1:
        return 'center';
      case 2:
        return 'right';
      default:
        return 'left';
    }
  }

  /** Set the text alignment. */
  setAlignment(align: 'left' | 'center' | 'right'): void {
    const q = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.dict.set('/Q', PdfNumber.of(q));
    this.widgetDict.delete('/AP');
  }

  // -----------------------------------------------------------------------
  // Field flags
  // -----------------------------------------------------------------------

  /** Whether this is a multiline text field. */
  isMultiline(): boolean {
    return this.hasFlag(FieldFlags.Multiline);
  }

  /** Set the multiline flag. */
  setMultiline(multiline: boolean): void {
    this.setFlag(FieldFlags.Multiline, multiline);
  }

  /** Whether this is a password field. */
  isPassword(): boolean {
    return this.hasFlag(FieldFlags.Password);
  }

  // -----------------------------------------------------------------------
  // Max length
  // -----------------------------------------------------------------------

  /** Get the maximum length, or undefined if no limit. */
  getMaxLength(): number | undefined {
    return numVal(this.dict.get('/MaxLen'));
  }

  /** Set the maximum length. */
  setMaxLength(maxLength: number): void {
    this.dict.set('/MaxLen', PdfNumber.of(maxLength));
  }

  // -----------------------------------------------------------------------
  // Image
  // -----------------------------------------------------------------------

  /**
   * Set an image on this text field.
   *
   * Creates an appearance stream that paints the image XObject scaled
   * to fit the widget rectangle. This replaces the text appearance.
   *
   * @param imageRef  An object with `name` (resource name) and `ref` (PdfRef)
   *                  pointing to the image XObject, plus `width` and `height`.
   */
  setImage(imageRef: { name: string; ref: PdfRef; width: number; height: number }): void {
    const rect = this.getRect();
    const fieldW = Math.abs(rect[2] - rect[0]);
    const fieldH = Math.abs(rect[3] - rect[1]);

    // Scale image to fit the field rectangle while preserving aspect ratio
    const scaleX = fieldW / imageRef.width;
    const scaleY = fieldH / imageRef.height;
    const scale = Math.min(scaleX, scaleY);
    const drawW = imageRef.width * scale;
    const drawH = imageRef.height * scale;
    const offsetX = (fieldW - drawW) / 2;
    const offsetY = (fieldH - drawH) / 2;

    // Build the appearance stream that paints the image
    const ops = `q\n${n(drawW)} 0 0 ${n(drawH)} ${n(offsetX)} ${n(offsetY)} cm\n/${imageRef.name} Do\nQ\n`;

    const apDict = new PdfDict();
    apDict.set('/Type', PdfName.of('XObject'));
    apDict.set('/Subtype', PdfName.of('Form'));
    apDict.set('/BBox', PdfArray.fromNumbers([0, 0, fieldW, fieldH]));

    const resources = new PdfDict();
    const xObjectDict = new PdfDict();
    xObjectDict.set(`/${imageRef.name}`, imageRef.ref);
    resources.set('/XObject', xObjectDict);
    apDict.set('/Resources', resources);

    const stream = PdfStream.fromString(ops, apDict);

    // Set /AP /N to the appearance stream
    const apWrapper = new PdfDict();
    apWrapper.set('/N', stream);
    this.widgetDict.set('/AP', apWrapper);
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this text field. */
  generateAppearance(): PdfStream {
    const alignmentMap = { left: 0, center: 1, right: 2 } as const;
    return generateTextAppearance({
      value: this.getText(),
      rect: this.getRect(),
      fontName: this.getFontName(),
      fontSize: this.getFontSize(),
      alignment: alignmentMap[this.getAlignment()],
      multiline: this.isMultiline(),
    });
  }
}
