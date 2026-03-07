/**
 * Lightweight entry point for PDF form operations.
 *
 * Import from `modern-pdf-lib/forms` when you only need to work with
 * interactive PDF forms (AcroForm). This excludes the creation API,
 * parser, encryption, and signature modules for smaller bundle size.
 *
 * @module modern-pdf-lib/forms
 * @packageDocumentation
 */

export {
  PdfForm,
  PdfField,
  FieldFlags,
  PdfTextField,
  PdfCheckboxField,
  PdfRadioGroup,
  PdfDropdownField,
  PdfListboxField,
  PdfButtonField,
  PdfSignatureField,
} from './form/index.js';
export type { FieldType, AppearanceProviderFor } from './form/index.js';
