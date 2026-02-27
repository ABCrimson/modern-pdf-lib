/**
 * @module form/fields/checkboxField
 *
 * PDF checkbox form field (/FT /Btn without Radio or Pushbutton flags).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.2.1 (Check Boxes).
 */

import {
  PdfDict,
  PdfName,
  PdfStream,
} from '../../core/pdfObjects.js';
import { PdfField, nameVal } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateCheckboxAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// PdfCheckboxField
// ---------------------------------------------------------------------------

/**
 * A PDF checkbox form field (/FT /Btn).
 *
 * The value is either the "on" name (typically "Yes") or "/Off".
 * The /AS (appearance state) entry controls which appearance is shown.
 */
export class PdfCheckboxField extends PdfField {
  readonly fieldType: FieldType = 'checkbox';

  // -----------------------------------------------------------------------
  // Value access
  // -----------------------------------------------------------------------

  /**
   * Check whether the checkbox is currently checked.
   *
   * The checkbox is checked when /V or /AS is not "/Off".
   */
  isChecked(): boolean {
    const v = nameVal(this.dict.get('/V'));
    if (v !== undefined) {
      return v !== 'Off';
    }
    // Fallback: check /AS (appearance state)
    const as = nameVal(this.widgetDict.get('/AS'));
    return as !== undefined && as !== 'Off';
  }

  /** Check the checkbox (set to the "on" value). */
  check(): void {
    const onValue = this.getOnValue();
    this.dict.set('/V', PdfName.of(onValue));
    this.widgetDict.set('/AS', PdfName.of(onValue));
    this.widgetDict.delete('/AP');
  }

  /** Uncheck the checkbox (set to /Off). */
  uncheck(): void {
    this.dict.set('/V', PdfName.of('Off'));
    this.widgetDict.set('/AS', PdfName.of('Off'));
    this.widgetDict.delete('/AP');
  }

  /** Toggle the checkbox. */
  toggle(): void {
    if (this.isChecked()) {
      this.uncheck();
    } else {
      this.check();
    }
  }

  /**
   * Get the "on" value name for this checkbox.
   *
   * Examines the /AP /N dictionary for a key that is not "/Off".
   * Falls back to "Yes" if no appearance dictionary is found.
   */
  getOnValue(): string {
    // Look in the /AP /N dict for a key that isn't "Off"
    const ap = this.widgetDict.get('/AP');
    if (ap !== undefined && ap.kind === 'dict') {
      const apDict = ap as PdfDict;
      const nObj = apDict.get('/N');
      if (nObj !== undefined && nObj.kind === 'dict') {
        const nDict = nObj as PdfDict;
        for (const [key] of nDict) {
          const cleanKey = key.startsWith('/') ? key.slice(1) : key;
          if (cleanKey !== 'Off') {
            return cleanKey;
          }
        }
      }
    }

    // Check /V for a non-Off value
    const v = nameVal(this.dict.get('/V'));
    if (v !== undefined && v !== 'Off') return v;

    // Default
    return 'Yes';
  }

  /** Get the value: "Yes"/"Off" as boolean for convenience. */
  getValue(): boolean {
    return this.isChecked();
  }

  /** Set the value as boolean. */
  setValue(value: string | boolean | string[]): void {
    if (typeof value === 'boolean') {
      if (value) {
        this.check();
      } else {
        this.uncheck();
      }
    } else {
      const str = typeof value === 'string' ? value : String(value);
      if (str === 'Off' || str === 'false' || str === '0' || str === '') {
        this.uncheck();
      } else {
        this.check();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this checkbox. */
  generateAppearance(): PdfStream {
    return generateCheckboxAppearance({
      checked: this.isChecked(),
      rect: this.getRect(),
    });
  }
}
