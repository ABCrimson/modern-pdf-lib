/**
 * @module form/fields/buttonField
 *
 * PDF pushbutton form field (/FT /Btn with Pushbutton flag).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.2.3 (Push-Buttons).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfString,
  PdfStream,
  PdfRef,
} from '../../core/pdfObjects.js';
import { PdfField, strVal, numVal } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateButtonAppearance } from '../fieldAppearance.js';

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
// PdfButtonField
// ---------------------------------------------------------------------------

/**
 * A PDF pushbutton field (/FT /Btn with Pushbutton flag).
 *
 * Pushbuttons have no permanent value. They may have an associated
 * action (e.g. JavaScript, submit form, reset form) and display a
 * caption via the /MK dictionary.
 */
export class PdfButtonField extends PdfField {
  readonly fieldType: FieldType = 'button';

  // -----------------------------------------------------------------------
  // Caption
  // -----------------------------------------------------------------------

  /**
   * Get the button caption from the /MK dictionary.
   * Returns undefined if no caption is set.
   */
  getCaption(): string | undefined {
    const mk = this.widgetDict.get('/MK');
    if (mk !== undefined && mk.kind === 'dict') {
      return strVal((mk as PdfDict).get('/CA'));
    }
    return undefined;
  }

  /**
   * Set the button caption in the /MK dictionary.
   * Creates the /MK dictionary if it does not exist.
   */
  setCaption(caption: string): void {
    let mk = this.widgetDict.get('/MK');
    if (mk === undefined || mk.kind !== 'dict') {
      mk = new PdfDict();
      this.widgetDict.set('/MK', mk);
    }
    (mk as PdfDict).set('/CA', PdfString.literal(caption));
    this.widgetDict.delete('/AP');
  }

  // -----------------------------------------------------------------------
  // Image
  // -----------------------------------------------------------------------

  /**
   * Set an image on this button field.
   *
   * Creates an appearance stream that paints the image XObject scaled
   * to fit the widget rectangle.
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
  // Value (pushbuttons don't have a meaningful value)
  // -----------------------------------------------------------------------

  /** Pushbuttons have no value; returns empty string. */
  getValue(): string {
    return '';
  }

  /** Pushbuttons have no value; no-op. */
  setValue(_value: string | boolean | string[]): void {
    // Pushbuttons do not hold a value
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this button. */
  generateAppearance(): PdfStream {
    return generateButtonAppearance({
      caption: this.getCaption() ?? '',
      rect: this.getRect(),
    });
  }
}
