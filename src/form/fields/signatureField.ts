/**
 * @module form/fields/signatureField
 *
 * PDF signature form field (/FT /Sig).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.5 (Signature Fields) and
 *            SS12.8 (Digital Signatures).
 */

import {
  PdfDict,
  PdfStream,
} from '../../core/pdfObjects.js';
import { PdfField } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateSignatureAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// PdfSignatureField
// ---------------------------------------------------------------------------

/**
 * A PDF signature form field (/FT /Sig).
 *
 * The /V entry is a signature dictionary containing the cryptographic
 * signature data. This class provides read access to check whether the
 * field is signed, but does not implement signing (see Phase 6).
 */
export class PdfSignatureField extends PdfField {
  readonly fieldType: FieldType = 'signature';

  // -----------------------------------------------------------------------
  // Signature status
  // -----------------------------------------------------------------------

  /**
   * Whether this signature field has been signed.
   * A signed field has a /V entry that is a dictionary.
   */
  isSigned(): boolean {
    const v = this.dict.get('/V');
    return v !== undefined && v.kind === 'dict';
  }

  /**
   * Get the signature dictionary, if signed.
   * Returns undefined if the field has not been signed.
   */
  getSignatureValue(): PdfDict | undefined {
    const v = this.dict.get('/V');
    if (v !== undefined && v.kind === 'dict') {
      return v as PdfDict;
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Value
  // -----------------------------------------------------------------------

  /** Get value: returns "signed" or "unsigned". */
  getValue(): string {
    return this.isSigned() ? 'signed' : 'unsigned';
  }

  /** Signature fields cannot be set via setValue. */
  setValue(_value: string | boolean | string[]): void {
    // Signature fields are set through the signing process
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this signature field. */
  generateAppearance(): PdfStream {
    return generateSignatureAppearance({
      signed: this.isSigned(),
      rect: this.getRect(),
    });
  }
}
