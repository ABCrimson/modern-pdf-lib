/**
 * @module crypto/permissions
 *
 * PDF document permission flags encoding and decoding.
 *
 * The /P entry in the encryption dictionary is a 32-bit signed integer
 * whose individual bits represent document access permissions.  Bits
 * are numbered starting from 1 (least significant).
 *
 * Reference: PDF 1.7 spec, Table 22 (User access permissions).
 *
 * Bit layout (1-indexed):
 * - Bits 1-2: Reserved, must be 0
 * - Bit 3:  Print the document
 * - Bit 4:  Modify the contents of the document
 * - Bit 5:  Copy or otherwise extract text and graphics
 * - Bit 6:  Add or modify text annotations, fill in interactive form fields
 * - Bits 7-8: Reserved, must be 1
 * - Bit 9:  Fill in existing interactive form fields (revision 3+)
 * - Bit 10: Extract text and graphics for accessibility (revision 3+)
 * - Bit 11: Assemble the document (revision 3+)
 * - Bit 12: Print in high fidelity (revision 3+)
 * - Bits 13-32: Reserved, must be 0
 *
 * When a bit is SET (1), the corresponding permission is GRANTED.
 * Bits 7-8 must always be 1. Bits 13-32 must always be 0.
 */

// ---------------------------------------------------------------------------
// Permission bit positions (0-indexed internally)
// ---------------------------------------------------------------------------

/** Bit 3: Print the document. */
const BIT_PRINT = 1 << 2;

/** Bit 4: Modify the contents. */
const BIT_MODIFY = 1 << 3;

/** Bit 5: Copy / extract text and graphics. */
const BIT_COPY = 1 << 4;

/** Bit 6: Add/modify annotations, fill forms. */
const BIT_ANNOTATE = 1 << 5;

/** Bits 7-8: Reserved, always set. */
const RESERVED_BITS = (1 << 6) | (1 << 7);

/** Bit 9: Fill in existing form fields (R3+). */
const BIT_FILL_FORMS = 1 << 8;

/** Bit 10: Extract for accessibility (R3+). */
const BIT_ACCESSIBILITY = 1 << 9;

/** Bit 11: Assemble document (R3+). */
const BIT_ASSEMBLE = 1 << 10;

/** Bit 12: Print in high fidelity (R3+). */
const BIT_PRINT_HQ = 1 << 11;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Human-friendly permission flags for a PDF document.
 *
 * Each flag controls a specific capability:
 *
 * - `printing`:  `true` = full quality, `'lowResolution'` = low-res only,
 *   `false` / `undefined` = no printing allowed.
 * - `modifying`: Allow content modifications.
 * - `copying`:   Allow text/graphics extraction.
 * - `annotating`: Allow adding/modifying annotations.
 * - `fillingForms`: Allow filling interactive form fields.
 * - `contentAccessibility`: Allow text extraction for accessibility.
 * - `documentAssembly`: Allow inserting/deleting/rotating pages.
 */
export interface PdfPermissionFlags {
  printing?: boolean | 'lowResolution' | undefined;
  modifying?: boolean | undefined;
  copying?: boolean | undefined;
  annotating?: boolean | undefined;
  fillingForms?: boolean | undefined;
  contentAccessibility?: boolean | undefined;
  documentAssembly?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode human-friendly permission flags into the 32-bit /P integer
 * used in the PDF encryption dictionary.
 *
 * By default (when all flags are `undefined` or `false`), no
 * permissions are granted beyond the reserved bits.
 *
 * @param flags  The permissions to encode.
 * @returns      A 32-bit signed integer for the /P entry.
 */
export function encodePermissions(flags: PdfPermissionFlags): number {
  let p = RESERVED_BITS; // bits 7-8 are always set

  // Printing
  if (flags.printing === true) {
    p |= BIT_PRINT | BIT_PRINT_HQ;
  } else if (flags.printing === 'lowResolution') {
    p |= BIT_PRINT;
    // BIT_PRINT_HQ stays off
  }

  // Modifying
  if (flags.modifying === true) {
    p |= BIT_MODIFY;
  }

  // Copying
  if (flags.copying === true) {
    p |= BIT_COPY;
  }

  // Annotating
  if (flags.annotating === true) {
    p |= BIT_ANNOTATE;
  }

  // Filling forms
  if (flags.fillingForms === true) {
    p |= BIT_FILL_FORMS;
  }

  // Content accessibility
  if (flags.contentAccessibility === true) {
    p |= BIT_ACCESSIBILITY;
  }

  // Document assembly
  if (flags.documentAssembly === true) {
    p |= BIT_ASSEMBLE;
  }

  // The /P value in the encryption dict is a 32-bit signed integer.
  // Bits 13-31 must be 0, bits 1-2 must be 0.
  // Convert to signed 32-bit: set the upper bits to all-1s
  // (the spec says the high bits should be set to comply with some readers)
  // Actually: PDF spec says bits 13-32 are reserved and must be 0 for
  // standard handler revision 2/3/4. For revision 6 (AES-256), the
  // spec says all reserved bits should be 0.
  // However, many implementations set the top 20 bits to 1 (0xFFFFF000).
  // We follow the spec strictly: upper bits = 0, lower reserved = as above.

  // Return as signed 32-bit integer. The two's complement representation
  // means we need to sign-extend if bit 31 would be set, but since we
  // only set bits 3-12 + 7-8 reserved, the value stays positive and small.
  // Some PDF viewers expect the /P to have bits 1-2 as 0 and bits 13-32
  // as 1 for backwards compat. Let's set the high bits per convention:
  return (p | 0xfffff000) | 0;  // sign-extend to negative 32-bit int
}

/**
 * Decode the 32-bit /P integer from a PDF encryption dictionary into
 * human-friendly permission flags.
 *
 * @param value  The /P integer from the encryption dictionary.
 * @returns      The decoded permission flags.
 */
export function decodePermissions(value: number): PdfPermissionFlags {
  const flags: PdfPermissionFlags = {};

  // Printing
  const canPrint = (value & BIT_PRINT) !== 0;
  const canPrintHQ = (value & BIT_PRINT_HQ) !== 0;
  if (canPrint && canPrintHQ) {
    flags.printing = true;
  } else if (canPrint) {
    flags.printing = 'lowResolution';
  } else {
    flags.printing = false;
  }

  flags.modifying = (value & BIT_MODIFY) !== 0;
  flags.copying = (value & BIT_COPY) !== 0;
  flags.annotating = (value & BIT_ANNOTATE) !== 0;
  flags.fillingForms = (value & BIT_FILL_FORMS) !== 0;
  flags.contentAccessibility = (value & BIT_ACCESSIBILITY) !== 0;
  flags.documentAssembly = (value & BIT_ASSEMBLE) !== 0;

  return flags;
}
