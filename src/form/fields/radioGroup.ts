/**
 * @module form/fields/radioGroup
 *
 * PDF radio button group (/FT /Btn with Radio flag set).
 *
 * A radio group is a single field with multiple widget annotations
 * (one per option). The /V entry on the field indicates which option
 * is selected.
 *
 * Reference: PDF 1.7 spec, SS12.7.4.2.2 (Radio Buttons).
 */

import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObject } from '../../core/pdfObjects.js';
import { PdfField, nameVal } from '../pdfField.js';
import type { FieldType, WidgetAnnotationHost } from '../pdfField.js';
import { generateRadioAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// PdfRadioGroup
// ---------------------------------------------------------------------------

/**
 * A PDF radio button group (/FT /Btn with Radio flag).
 *
 * Multiple widget annotations represent the individual options.
 * The field's /V value is the name of the selected option.
 */
export class PdfRadioGroup extends PdfField {
  readonly fieldType: FieldType = 'radio';

  /** The individual widget annotation dictionaries. */
  private readonly widgets: PdfDict[];

  constructor(
    name: string,
    dict: PdfDict,
    widgetDict: PdfDict,
    parentNames: string[] = [],
    widgets: PdfDict[] = [],
  ) {
    super(name, dict, widgetDict, parentNames);
    this.widgets = widgets.length > 0 ? widgets : [widgetDict];
  }

  // -----------------------------------------------------------------------
  // Add to page (override: adds all widgets)
  // -----------------------------------------------------------------------

  /**
   * Add all radio button widgets to a page.
   *
   * Unlike other field types that have a single widget, a radio group
   * has multiple widget annotations (one per option). This override
   * adds all of them.
   */
  override addToPage(page: WidgetAnnotationHost): void {
    for (const widget of this.widgets) {
      if (!widget.has('/Type')) {
        widget.set('/Type', PdfName.of('Annot'));
      }
      if (!widget.has('/Subtype')) {
        widget.set('/Subtype', PdfName.of('Widget'));
      }
      page.addWidgetAnnotation(widget);
    }
  }

  // -----------------------------------------------------------------------
  // Value access
  // -----------------------------------------------------------------------

  /**
   * Get the currently selected option name.
   * Returns undefined if no option is selected.
   */
  getSelected(): string | undefined {
    const v = nameVal(this.dict.get('/V'));
    if (v !== undefined && v !== 'Off') return v;
    return undefined;
  }

  /**
   * Select an option by its name.
   *
   * Sets /V on the field and updates /AS on each widget to
   * show the correct appearance state.
   */
  select(optionName: string): void {
    this.dict.set('/V', PdfName.of(optionName));

    // Update each widget's /AS to match
    for (const widget of this.widgets) {
      const widgetOption = this.getWidgetOptionName(widget);
      if (widgetOption === optionName) {
        widget.set('/AS', PdfName.of(optionName));
      } else {
        widget.set('/AS', PdfName.of('Off'));
      }
      widget.delete('/AP');
    }
  }

  /**
   * Get the list of option names available in this radio group.
   * Derived from the /AP /N dictionaries of each widget.
   */
  getOptions(): string[] {
    const options: string[] = [];
    for (const widget of this.widgets) {
      const optName = this.getWidgetOptionName(widget);
      if (optName !== undefined) {
        options.push(optName);
      }
    }
    return options;
  }

  /** Get the widget annotation dictionaries. */
  getWidgets(): PdfDict[] {
    return [...this.widgets];
  }

  /** Get the value: the selected option name or undefined. */
  getValue(): string {
    return this.getSelected() ?? '';
  }

  /** Set the value: select the named option. */
  setValue(value: string | boolean | string[]): void {
    const str = typeof value === 'string' ? value : String(value);
    this.select(str);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Get the option name for a widget annotation.
   * Looks in the /AP /N dictionary for a key that is not "Off".
   */
  private getWidgetOptionName(widget: PdfDict): string | undefined {
    const ap = widget.get('/AP');
    if (ap !== undefined && ap.kind === 'dict') {
      const apDict = ap as PdfDict;
      const nObj = apDict.get('/N');
      if (nObj !== undefined && nObj.kind === 'dict') {
        const nDict = nObj as PdfDict;
        for (const [key] of nDict) {
          const cleanKey = key.startsWith('/') ? key.slice(1) : key;
          if (cleanKey !== 'Off') return cleanKey;
        }
      }
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /**
   * Generate the appearance stream for the first widget.
   * For full appearance generation, use generateAppearanceForWidget().
   */
  generateAppearance(): PdfStream {
    const selected = this.getSelected();
    const firstWidget = this.widgets[0] ?? this.widgetDict;
    const firstOption = this.getWidgetOptionName(firstWidget);
    return generateRadioAppearance({
      selected: firstOption === selected,
      rect: this.getRect(),
    });
  }
}
