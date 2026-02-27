/**
 * @module form
 *
 * Public API for PDF AcroForm (interactive form) support.
 *
 * @packageDocumentation
 */

// Main form class
export { PdfForm } from './pdfForm.js';
export type { RefResolver } from './pdfForm.js';

// Base field class and types
export { PdfField, FieldFlags } from './pdfField.js';
export type { FieldType, WidgetAnnotationHost } from './pdfField.js';

// Concrete field types
export { PdfTextField } from './fields/textField.js';
export { PdfCheckboxField } from './fields/checkboxField.js';
export { PdfRadioGroup } from './fields/radioGroup.js';
export { PdfDropdownField } from './fields/dropdownField.js';
export { PdfListboxField } from './fields/listboxField.js';
export { PdfButtonField } from './fields/buttonField.js';
export { PdfSignatureField } from './fields/signatureField.js';

// Appearance generation
export {
  generateTextAppearance,
  generateCheckboxAppearance,
  generateRadioAppearance,
  generateDropdownAppearance,
  generateListboxAppearance,
  generateButtonAppearance,
  generateSignatureAppearance,
} from './fieldAppearance.js';
export type {
  AppearanceProviderFor,
  TextAppearanceOptions,
  CheckboxAppearanceOptions,
  RadioAppearanceOptions,
  DropdownAppearanceOptions,
  ListboxAppearanceOptions,
  ButtonAppearanceOptions,
  SignatureAppearanceOptions,
} from './fieldAppearance.js';
