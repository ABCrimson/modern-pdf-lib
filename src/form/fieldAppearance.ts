/**
 * @module form/fieldAppearance
 *
 * Generates PDF appearance streams (/AP /N) for AcroForm fields.
 *
 * Each generator creates a PdfStream whose content is a valid PDF
 * content stream that visually renders the field's current value.
 *
 * Reference: PDF 1.7 spec, SS12.5.5 (Appearance Streams),
 *            SS12.7.3.3 (Variable Text).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
} from '../core/pdfObjects.js';
import type { FieldType } from './pdfField.js';

// ---------------------------------------------------------------------------
// AppearanceProviderFor — typed appearance function per field type
// ---------------------------------------------------------------------------

/**
 * A typed function that generates an appearance stream for a specific
 * field type. Use this as a callback type when providing custom
 * appearance generators.
 *
 * ```ts
 * const myTextProvider: AppearanceProviderFor<'text'> = (opts) => {
 *   // custom rendering logic
 *   return myStream;
 * };
 * ```
 */
export type AppearanceProviderFor<T extends FieldType> =
  T extends 'text' ? (options: TextAppearanceOptions) => PdfStream
  : T extends 'checkbox' ? (options: CheckboxAppearanceOptions) => PdfStream
  : T extends 'radio' ? (options: RadioAppearanceOptions) => PdfStream
  : T extends 'dropdown' ? (options: DropdownAppearanceOptions) => PdfStream
  : T extends 'listbox' ? (options: ListboxAppearanceOptions) => PdfStream
  : T extends 'button' ? (options: ButtonAppearanceOptions) => PdfStream
  : T extends 'signature' ? (options: SignatureAppearanceOptions) => PdfStream
  : never;

// ---------------------------------------------------------------------------
// Number formatter
// ---------------------------------------------------------------------------

/** Format a number for PDF content stream output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Escape a string for use in a PDF literal string. */
function escapePdf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

// ---------------------------------------------------------------------------
// Text field appearance
// ---------------------------------------------------------------------------

/** Options for generating a text field appearance. */
export interface TextAppearanceOptions {
  /** The text value to render. */
  value: string;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
  /** Font name to use (e.g. "Helv"). Default: "Helv". */
  fontName?: string | undefined;
  /** Font size in points. 0 means auto-size. Default: 0. */
  fontSize?: number | undefined;
  /** Text alignment: 0=left, 1=center, 2=right. Default: 0. */
  alignment?: number | undefined;
  /** Whether the field is multiline. Default: false. */
  multiline?: boolean | undefined;
  /** Border width in points. Default: 1. */
  borderWidth?: number | undefined;
}

/**
 * Generate the appearance stream for a text field.
 *
 * The stream renders the text value within the widget rectangle,
 * using Tf/Td/Tj operators. Handles single-line and multiline,
 * alignment (quadding), and auto font-size calculation.
 */
export function generateTextAppearance(options: TextAppearanceOptions): PdfStream {
  const {
    value,
    rect,
    fontName = 'Helv',
    fontSize: requestedSize = 0,
    alignment = 0,
    multiline = false,
    borderWidth = 1,
  } = options;

  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];
  const padding = borderWidth + 1;

  // Auto font size: fit text to field height
  let fontSize = requestedSize;
  if (fontSize <= 0) {
    if (multiline) {
      fontSize = 10; // Reasonable default for multiline
    } else {
      // Single line: fit to height minus padding
      fontSize = Math.min(Math.max(height - 2 * padding, 4), 20);
    }
  }

  let ops = '';

  // Clipping rectangle to keep text within bounds
  ops += `/Tx BMC\n`;
  ops += `q\n`;
  ops += `${n(padding)} ${n(padding)} ${n(width - 2 * padding)} ${n(height - 2 * padding)} re\n`;
  ops += `W\n`;
  ops += `n\n`;

  ops += `BT\n`;
  ops += `/${fontName} ${n(fontSize)} Tf\n`;
  ops += `0 g\n`; // Black text

  if (multiline) {
    // Split text into lines and render each
    const lines = value.split('\n');
    const lineHeight = fontSize * 1.2;
    const startY = height - padding - fontSize;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const tx = computeAlignmentOffset(line, fontSize, width - 2 * padding, alignment);
      const ty = startY - i * lineHeight;
      if (ty < padding) break; // Clip at bottom

      ops += `${n(tx + padding)} ${n(ty)} Td\n`;
      ops += `(${escapePdf(line)}) Tj\n`;

      // Reset position for next line (Td is relative)
      if (i < lines.length - 1) {
        ops += `${n(-(tx + padding))} ${n(-ty)} Td\n`;
      }
    }
  } else {
    // Single line
    const tx = computeAlignmentOffset(value, fontSize, width - 2 * padding, alignment);
    const ty = (height - fontSize) / 2;
    ops += `${n(tx + padding)} ${n(ty)} Td\n`;
    ops += `(${escapePdf(value)}) Tj\n`;
  }

  ops += `ET\n`;
  ops += `Q\n`;
  ops += `EMC\n`;

  return buildAppearanceStream(ops, width, height);
}

/**
 * Compute horizontal text offset for alignment.
 * Rough approximation: assume average char width = fontSize * 0.5.
 */
function computeAlignmentOffset(
  text: string,
  fontSize: number,
  availableWidth: number,
  alignment: number,
): number {
  const textWidth = text.length * fontSize * 0.5;
  switch (alignment) {
    case 1: // Center
      return Math.max(0, (availableWidth - textWidth) / 2);
    case 2: // Right
      return Math.max(0, availableWidth - textWidth);
    default: // Left
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Checkbox appearance
// ---------------------------------------------------------------------------

/** Options for generating a checkbox appearance. */
export interface CheckboxAppearanceOptions {
  /** Whether the checkbox is checked. */
  checked: boolean;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
}

/**
 * Generate the appearance stream for a checkbox — checked state.
 *
 * Renders a checkmark (a simple cross/tick path) inside the widget
 * rectangle when checked, or an empty box when unchecked.
 */
export function generateCheckboxAppearance(options: CheckboxAppearanceOptions): PdfStream {
  const { checked, rect } = options;

  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];

  let ops = '';

  if (checked) {
    // Draw a checkmark using two line segments
    const margin = Math.min(width, height) * 0.15;
    const x1 = margin;
    const y1 = height * 0.5;
    const x2 = width * 0.4;
    const y2 = margin;
    const x3 = width - margin;
    const y3 = height - margin;

    ops += `q\n`;
    ops += `${n(2)} w\n`; // Line width
    ops += `0 0 0 RG\n`; // Black stroke
    ops += `${n(x1)} ${n(y1)} m\n`;
    ops += `${n(x2)} ${n(y2)} l\n`;
    ops += `${n(x3)} ${n(y3)} l\n`;
    ops += `S\n`;
    ops += `Q\n`;
  }
  // Unchecked: empty stream (the widget border is drawn by the viewer)

  return buildAppearanceStream(ops, width, height);
}

// ---------------------------------------------------------------------------
// Radio button appearance
// ---------------------------------------------------------------------------

/** Options for generating a radio button appearance. */
export interface RadioAppearanceOptions {
  /** Whether this radio option is selected. */
  selected: boolean;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
}

/**
 * Generate the appearance stream for a radio button option.
 *
 * Selected: filled circle inside the widget.
 * Unselected: empty circle (border only).
 */
export function generateRadioAppearance(options: RadioAppearanceOptions): PdfStream {
  const { selected, rect } = options;

  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(cx, cy) - 1;

  let ops = '';

  // Draw outer circle (border)
  ops += `q\n`;
  ops += `0 0 0 RG\n`; // Black stroke
  ops += `0.5 w\n`;
  ops += circlePath(cx, cy, outerRadius);
  ops += `S\n`;
  ops += `Q\n`;

  if (selected) {
    // Draw filled inner circle
    const innerRadius = outerRadius * 0.5;
    ops += `q\n`;
    ops += `0 0 0 rg\n`; // Black fill
    ops += circlePath(cx, cy, innerRadius);
    ops += `f\n`;
    ops += `Q\n`;
  }

  return buildAppearanceStream(ops, width, height);
}

// ---------------------------------------------------------------------------
// Dropdown (combo box) appearance
// ---------------------------------------------------------------------------

/** Options for generating a dropdown field appearance. */
export interface DropdownAppearanceOptions {
  /** The selected value text. */
  value: string;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
  /** Font name. Default: "Helv". */
  fontName?: string | undefined;
  /** Font size. 0 means auto. Default: 0. */
  fontSize?: number | undefined;
}

/**
 * Generate the appearance stream for a dropdown (combo box).
 * Renders the selected value text, similar to a text field.
 */
export function generateDropdownAppearance(options: DropdownAppearanceOptions): PdfStream {
  return generateTextAppearance({
    value: options.value,
    rect: options.rect,
    fontName: options.fontName,
    fontSize: options.fontSize,
    alignment: 0,
    multiline: false,
  });
}

// ---------------------------------------------------------------------------
// Listbox appearance
// ---------------------------------------------------------------------------

/** Options for generating a listbox field appearance. */
export interface ListboxAppearanceOptions {
  /** All option strings. */
  options: string[];
  /** Currently selected option strings. */
  selected: string[];
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
  /** Font name. Default: "Helv". */
  fontName?: string | undefined;
  /** Font size. Default: 10. */
  fontSize?: number | undefined;
}

/**
 * Generate the appearance stream for a listbox.
 * Renders visible options with highlighting for selected items.
 */
export function generateListboxAppearance(options: ListboxAppearanceOptions): PdfStream {
  const {
    options: items,
    selected,
    rect,
    fontName = 'Helv',
    fontSize = 10,
  } = options;

  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];
  const lineHeight = fontSize * 1.4;
  const padding = 2;
  const selectedSet = new Set(selected);

  let ops = '';
  ops += `q\n`;

  // Clip to widget bounds
  ops += `${n(0)} ${n(0)} ${n(width)} ${n(height)} re\n`;
  ops += `W\n`;
  ops += `n\n`;

  const visibleItems = Math.floor(height / lineHeight);
  const renderCount = Math.min(items.length, visibleItems);

  for (let i = 0; i < renderCount; i++) {
    const item = items[i] ?? '';
    const y = height - (i + 1) * lineHeight;

    // Draw highlight background for selected items
    if (selectedSet.has(item)) {
      ops += `0 0 0.5 rg\n`; // Dark blue fill
      ops += `${n(0)} ${n(y)} ${n(width)} ${n(lineHeight)} re\n`;
      ops += `f\n`;
      ops += `1 1 1 rg\n`; // White text
    } else {
      ops += `0 0 0 rg\n`; // Black text
    }

    ops += `BT\n`;
    ops += `/${fontName} ${n(fontSize)} Tf\n`;
    ops += `${n(padding)} ${n(y + lineHeight * 0.25)} Td\n`;
    ops += `(${escapePdf(item)}) Tj\n`;
    ops += `ET\n`;
  }

  ops += `Q\n`;

  return buildAppearanceStream(ops, width, height);
}

// ---------------------------------------------------------------------------
// Button appearance
// ---------------------------------------------------------------------------

/** Options for generating a button field appearance. */
export interface ButtonAppearanceOptions {
  /** The button caption text. */
  caption: string;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
  /** Font name. Default: "Helv". */
  fontName?: string | undefined;
  /** Font size. Default: 0 (auto). */
  fontSize?: number | undefined;
}

/**
 * Generate the appearance stream for a pushbutton.
 * Renders a 3D-ish raised button with centered caption text.
 */
export function generateButtonAppearance(options: ButtonAppearanceOptions): PdfStream {
  const {
    caption,
    rect,
    fontName = 'Helv',
    fontSize: requestedSize = 0,
  } = options;

  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];

  let fontSize = requestedSize;
  if (fontSize <= 0) {
    fontSize = Math.min(Math.max(height - 6, 4), 16);
  }

  let ops = '';

  // Background
  ops += `q\n`;
  ops += `0.75 g\n`; // Light gray fill
  ops += `${n(0)} ${n(0)} ${n(width)} ${n(height)} re\n`;
  ops += `f\n`;
  ops += `Q\n`;

  // Caption text centered
  const textWidth = caption.length * fontSize * 0.5;
  const tx = (width - textWidth) / 2;
  const ty = (height - fontSize) / 2;

  ops += `BT\n`;
  ops += `/${fontName} ${n(fontSize)} Tf\n`;
  ops += `0 g\n`;
  ops += `${n(tx)} ${n(ty)} Td\n`;
  ops += `(${escapePdf(caption)}) Tj\n`;
  ops += `ET\n`;

  return buildAppearanceStream(ops, width, height);
}

// ---------------------------------------------------------------------------
// Signature field appearance
// ---------------------------------------------------------------------------

/** Options for generating a signature field appearance. */
export interface SignatureAppearanceOptions {
  /** Whether the field has been signed. */
  signed: boolean;
  /** The widget rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
}

/**
 * Generate the appearance stream for a signature field.
 *
 * Unsigned: dashed border rectangle.
 * Signed: "Signed" text with a line through it.
 */
export function generateSignatureAppearance(options: SignatureAppearanceOptions): PdfStream {
  const { signed, rect } = options;
  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];

  let ops = '';

  if (signed) {
    ops += `q\n`;
    ops += `0.8 g\n`; // Light gray background
    ops += `${n(0)} ${n(0)} ${n(width)} ${n(height)} re\n`;
    ops += `f\n`;
    ops += `Q\n`;

    ops += `BT\n`;
    ops += `/Helv 10 Tf\n`;
    ops += `0 g\n`;
    const tx = (width - 30) / 2;
    const ty = (height - 10) / 2;
    ops += `${n(tx)} ${n(ty)} Td\n`;
    ops += `(Signed) Tj\n`;
    ops += `ET\n`;
  } else {
    // Dashed border
    ops += `q\n`;
    ops += `[3 3] 0 d\n`; // Dashed line pattern
    ops += `0.5 G\n`; // Gray stroke
    ops += `0.5 w\n`;
    ops += `${n(1)} ${n(1)} ${n(width - 2)} ${n(height - 2)} re\n`;
    ops += `S\n`;
    ops += `Q\n`;
  }

  return buildAppearanceStream(ops, width, height);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a PdfStream from content stream operators with proper BBox.
 */
function buildAppearanceStream(
  operators: string,
  width: number,
  height: number,
): PdfStream {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('XObject'));
  dict.set('/Subtype', PdfName.of('Form'));
  dict.set('/BBox', PdfArray.fromNumbers([0, 0, width, height]));

  // Resources — include default Helvetica font
  const resources = new PdfDict();
  const fontDict = new PdfDict();
  const helvetica = new PdfDict();
  helvetica.set('/Type', PdfName.of('Font'));
  helvetica.set('/Subtype', PdfName.of('Type1'));
  helvetica.set('/BaseFont', PdfName.of('Helvetica'));
  fontDict.set('/Helv', helvetica);
  resources.set('/Font', fontDict);
  dict.set('/Resources', resources);

  return PdfStream.fromString(operators, dict);
}

/**
 * Approximate circle path using 4 cubic Bezier curves.
 */
function circlePath(cx: number, cy: number, radius: number): string {
  const kappa = 0.5522847498;
  const ox = radius * kappa;
  const oy = radius * kappa;

  let ops = '';
  ops += `${n(cx)} ${n(cy + radius)} m\n`;
  ops += `${n(cx + ox)} ${n(cy + radius)} ${n(cx + radius)} ${n(cy + oy)} ${n(cx + radius)} ${n(cy)} c\n`;
  ops += `${n(cx + radius)} ${n(cy - oy)} ${n(cx + ox)} ${n(cy - radius)} ${n(cx)} ${n(cy - radius)} c\n`;
  ops += `${n(cx - ox)} ${n(cy - radius)} ${n(cx - radius)} ${n(cy - oy)} ${n(cx - radius)} ${n(cy)} c\n`;
  ops += `${n(cx - radius)} ${n(cy + oy)} ${n(cx - ox)} ${n(cy + radius)} ${n(cx)} ${n(cy + radius)} c\n`;
  return ops;
}
