/**
 * @module form/fields/listboxField
 *
 * PDF listbox form field (/FT /Ch without Combo flag).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.4 (Choice Fields).
 */

import {
  PdfDict,
  PdfString,
  PdfArray,
  PdfStream,
} from '../../core/pdfObjects.js';
import { PdfField, strVal } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateListboxAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// PdfListboxField
// ---------------------------------------------------------------------------

/**
 * A PDF listbox field (/FT /Ch without Combo flag).
 *
 * Displays a scrollable list of options. May allow multi-select.
 * The /V entry holds the selected value(s).
 */
export class PdfListboxField extends PdfField {
  readonly fieldType: FieldType = 'listbox';

  // -----------------------------------------------------------------------
  // Value access
  // -----------------------------------------------------------------------

  /**
   * Get the currently selected value(s).
   *
   * Returns an array of strings (may contain one element for
   * single-select listboxes).
   */
  getSelected(): string[] {
    const v = this.dict.get('/V');
    if (v === undefined) return [];

    if (v.kind === 'string') {
      return [(v as PdfString).value];
    }

    if (v.kind === 'array') {
      const arr = v as PdfArray;
      return arr.items
        .filter((item): item is PdfString => item.kind === 'string')
        .map((item) => item.value);
    }

    return [];
  }

  /** Select one or more values. */
  select(values: string[]): void {
    if (values.length === 1) {
      this.dict.set('/V', PdfString.literal(values[0]!));
    } else {
      const arr = PdfArray.of(values.map((v) => PdfString.literal(v)));
      this.dict.set('/V', arr);
    }
    this.widgetDict.delete('/AP');
  }

  /** Get value as string array. */
  getValue(): string[] {
    return this.getSelected();
  }

  /** Set value from string array. */
  setValue(value: string | boolean | string[]): void {
    if (Array.isArray(value)) {
      this.select(value);
    } else {
      this.select([String(value)]);
    }
  }

  // -----------------------------------------------------------------------
  // Options
  // -----------------------------------------------------------------------

  /** Get the list of options. */
  getOptions(): string[] {
    const optObj = this.dict.get('/Opt');
    if (optObj === undefined || optObj.kind !== 'array') return [];

    const arr = optObj as PdfArray;
    const options: string[] = [];

    for (const item of arr.items) {
      if (item.kind === 'string') {
        options.push((item as PdfString).value);
      } else if (item.kind === 'array') {
        const subArr = item as PdfArray;
        const display = subArr.items[1] ?? subArr.items[0];
        if (display !== undefined && display.kind === 'string') {
          options.push((display as PdfString).value);
        }
      }
    }

    return options;
  }

  /** Set the list of options. */
  setOptions(options: string[]): void {
    const arr = PdfArray.of(options.map((o) => PdfString.literal(o)));
    this.dict.set('/Opt', arr);
    this.widgetDict.delete('/AP');
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this listbox. */
  generateAppearance(): PdfStream {
    return generateListboxAppearance({
      options: this.getOptions(),
      selected: this.getSelected(),
      rect: this.getRect(),
    });
  }
}
