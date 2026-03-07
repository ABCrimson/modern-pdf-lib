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

// Field validation
export { validateFieldValue, parseValidationScript } from './fieldValidation.js';
export type { ValidationResult, ValidationType } from './fieldValidation.js';

// Acrobat special builtins (AFPercent / AFSpecial)
export {
  AFPercent_Format,
  AFPercent_Keystroke,
  AFSpecial_Format,
  AFSpecial_Keystroke,
  formatSpecial,
  validateSpecial,
} from './acrobatSpecialBuiltins.js';

// Field visibility
export {
  setFieldVisibility,
  isFieldVisible,
  toggleFieldGroup,
  addVisibilityAction,
} from './fieldVisibility.js';
export type { VisibilityCondition } from './fieldVisibility.js';

// Field references (cross-field getField() API)
export {
  resolveFieldReference,
  getFieldValue,
  setFieldValue,
  createFieldProxy,
} from './fieldReferences.js';
export type { FieldRef, FieldProxy } from './fieldReferences.js';

// Document-level scripts
export {
  getDocumentScripts,
  addDocumentOpenAction,
  addDocumentCloseAction,
  addDocumentPrintAction,
  addDocumentSaveAction,
  removeDocumentScript,
} from './documentScripts.js';
export type {
  DocumentScript,
  PrintActionOptions,
  SaveActionOptions,
} from './documentScripts.js';

// Sandboxed script execution
export { FormScriptSandbox, createSandbox } from './scriptSandbox.js';
export type {
  SandboxOptions,
  SandboxResult,
} from './scriptSandbox.js';

// JavaScript expression evaluator for form calculations
export { evaluateExpression, parseCalculationScript } from './jsEvaluator.js';
export type { CalculationInfo } from './jsEvaluator.js';

// Field calculation order
export {
  getCalculationOrder,
  setCalculationOrder,
  executeCalculations,
  buildDependencyGraph,
  topologicalSort,
} from './calculationOrder.js';

// Acrobat number formatting/validation built-ins
export {
  AFNumber_Format,
  AFNumber_Keystroke,
  formatNumber,
  parseFormattedNumber,
} from './acrobatBuiltins.js';
export type { NumberFormatOptions } from './acrobatBuiltins.js';

// Acrobat date formatting/validation built-ins
export {
  AFDate_FormatEx,
  AFDate_KeystrokeEx,
  parseAcrobatDate,
  formatDate,
} from './acrobatDateBuiltins.js';
