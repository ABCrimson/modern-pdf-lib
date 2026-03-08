/**
 * @module errors
 *
 * Typed error classes for common failure modes in the modern-pdf library.
 * Each error class extends the native `Error` and carries a descriptive
 * `name` so callers can use `instanceof` checks or `error.name` comparisons.
 *
 * All constructors accept an optional `ErrorOptions` parameter to support
 * error chaining via the standard `{ cause }` option (ES2022+).
 *
 * These match the pdf-lib error hierarchy for API compatibility.
 */

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Thrown when attempting to load or manipulate an encrypted PDF without
 * providing the correct password.
 */
export class EncryptedPdfError extends Error {
  override readonly name = 'EncryptedPdfError';
  constructor(
    message = 'The PDF is encrypted. Please provide a password.',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * Thrown when a font operation requires an embedded font but none has been
 * registered or the font reference is invalid.
 */
export class FontNotEmbeddedError extends Error {
  override readonly name = 'FontNotEmbeddedError';
  constructor(fontName?: string, options?: ErrorOptions) {
    super(
      fontName
        ? `The font "${fontName}" has not been embedded in this document.`
        : 'No font has been embedded. Call doc.embedFont() first.',
      options,
    );
  }
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * Thrown when attempting to use a page from a different document without
 * first copying it.
 */
export class ForeignPageError extends Error {
  override readonly name = 'ForeignPageError';
  constructor(options?: ErrorOptions) {
    super(
      'The page belongs to a different document. Use doc.copyPages() to ' +
        'import pages from another document before adding them.',
      options,
    );
  }
}

/**
 * Thrown when attempting to remove a page from a document that has no pages.
 */
export class RemovePageFromEmptyDocumentError extends Error {
  override readonly name = 'RemovePageFromEmptyDocumentError';
  constructor(options?: ErrorOptions) {
    super('Cannot remove a page from a document with no pages.', options);
  }
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

/**
 * Thrown when looking up a form field by name that does not exist.
 */
export class NoSuchFieldError extends Error {
  override readonly name = 'NoSuchFieldError';
  constructor(fieldName: string, options?: ErrorOptions) {
    super(
      `No form field named "${fieldName}" exists in this document.`,
      options,
    );
  }
}

/**
 * Thrown when a form field is accessed via the wrong typed getter
 * (e.g. calling `getTextField()` on a checkbox field).
 */
export class UnexpectedFieldTypeError extends Error {
  override readonly name = 'UnexpectedFieldTypeError';
  constructor(fieldName: string, expected: string, actual: string, options?: ErrorOptions) {
    super(
      `Expected field "${fieldName}" to be of type "${expected}", ` +
        `but it is of type "${actual}".`,
      options,
    );
  }
}

/**
 * Thrown when a checkbox or radio button is checked but no "on" value
 * can be determined from its appearance dictionary.
 */
export class MissingOnValueCheckError extends Error {
  override readonly name = 'MissingOnValueCheckError';
  constructor(fieldName: string, options?: ErrorOptions) {
    super(
      `Cannot determine the "on" value for checkbox/radio "${fieldName}". ` +
        'The field is missing an /AP /N appearance dictionary with a non-/Off key.',
      options,
    );
  }
}

/**
 * Thrown when creating a form field with a name that is already in use.
 */
export class FieldAlreadyExistsError extends Error {
  override readonly name = 'FieldAlreadyExistsError';
  constructor(fieldName: string, options?: ErrorOptions) {
    super(`A form field named "${fieldName}" already exists.`, options);
  }
}

/**
 * Thrown when a field name part (between dots in a qualified name) is
 * empty or contains invalid characters.
 */
export class InvalidFieldNamePartError extends Error {
  override readonly name = 'InvalidFieldNamePartError';
  constructor(namePart: string, options?: ErrorOptions) {
    super(`Invalid field name part: "${namePart}".`, options);
  }
}

/**
 * Thrown when attempting to create a terminal field but a non-terminal
 * node (a field with /Kids but no /FT) already uses the same name.
 */
export class FieldExistsAsNonTerminalError extends Error {
  override readonly name = 'FieldExistsAsNonTerminalError';
  constructor(fieldName: string, options?: ErrorOptions) {
    super(
      `A non-terminal field node named "${fieldName}" already exists. ` +
        'Cannot create a terminal field with the same name.',
      options,
    );
  }
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

/**
 * Thrown when attempting to read the rich text value (/RV) of a field
 * that does not support it or whose rich text is malformed.
 */
export class RichTextFieldReadError extends Error {
  override readonly name = 'RichTextFieldReadError';
  constructor(fieldName: string, options?: ErrorOptions) {
    super(
      `Cannot read the rich text value of field "${fieldName}". ` +
        'Rich text reading is not currently supported.',
      options,
    );
  }
}

// ---------------------------------------------------------------------------
// Text layout
// ---------------------------------------------------------------------------

/**
 * Thrown when a combed text field receives more characters than its
 * maximum length allows.
 */
export class CombedTextLayoutError extends Error {
  override readonly name = 'CombedTextLayoutError';
  constructor(textLength: number, maxLength: number, options?: ErrorOptions) {
    super(
      `Combed text has ${textLength} characters but the field only ` +
        `allows a maximum of ${maxLength}.`,
      options,
    );
  }
}

/**
 * Thrown when a text field value exceeds the field's declared
 * maximum length (/MaxLen).
 */
export class ExceededMaxLengthError extends Error {
  override readonly name = 'ExceededMaxLengthError';
  constructor(textLength: number, maxLength: number, fieldName: string, options?: ErrorOptions) {
    super(
      `The value for field "${fieldName}" is ${textLength} characters long, ` +
        `but the maximum length is ${maxLength}.`,
      options,
    );
  }
}

// ---------------------------------------------------------------------------
// Page size validation
// ---------------------------------------------------------------------------

/**
 * Thrown when an invalid page size is provided (e.g. zero or negative
 * dimensions, non-finite values).
 *
 * @example
 * ```ts
 * throw new InvalidPageSizeError(0, 842);
 * ```
 */
export class InvalidPageSizeError extends Error {
  override readonly name = 'InvalidPageSizeError';
  constructor(width: number, height: number, options?: ErrorOptions) {
    super(
      `Invalid page size: width=${width}, height=${height}. ` +
        'Both dimensions must be finite positive numbers.',
      options,
    );
  }
}

// ---------------------------------------------------------------------------
// Color validation
// ---------------------------------------------------------------------------

/**
 * Thrown when an invalid color value is provided (e.g. component values
 * outside the `[0, 1]` range, unknown color type).
 *
 * @example
 * ```ts
 * throw new InvalidColorError('RGB component out of range: r=1.5');
 * ```
 */
export class InvalidColorError extends Error {
  override readonly name = 'InvalidColorError';
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// ---------------------------------------------------------------------------
// Plugin errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a plugin encounters an error during initialization or
 * execution.  Wraps the underlying cause for error-chain inspection.
 *
 * @example
 * ```ts
 * throw new PluginError('myPlugin', 'Failed to initialize WASM module');
 * ```
 */
export class PluginError extends Error {
  override readonly name = 'PluginError';
  /** Name of the plugin that caused the error. */
  readonly pluginName: string;
  constructor(pluginName: string, message: string, options?: ErrorOptions) {
    super(`Plugin "${pluginName}": ${message}`, options);
    this.pluginName = pluginName;
  }
}

// ---------------------------------------------------------------------------
// Streaming parse errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a streaming (incremental) parse operation encounters
 * corrupt or incomplete data that prevents further processing.
 *
 * @example
 * ```ts
 * throw new StreamingParseError('Unexpected EOF at byte offset 4096');
 * ```
 */
export class StreamingParseError extends Error {
  override readonly name = 'StreamingParseError';
  /** Byte offset where the error occurred, if known. */
  readonly offset?: number | undefined;
  constructor(message: string, offset?: number, options?: ErrorOptions) {
    super(offset !== undefined ? `${message} (at byte offset ${offset})` : message, options);
    this.offset = offset;
  }
}

// ---------------------------------------------------------------------------
// Batch processing errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a batch processing operation fails.  Contains information
 * about which items succeeded and which failed.
 *
 * @example
 * ```ts
 * throw new BatchProcessingError('2 of 5 documents failed', failures);
 * ```
 */
export class BatchProcessingError extends Error {
  override readonly name = 'BatchProcessingError';
  /** Details of individual item failures. */
  readonly failures: ReadonlyArray<{ readonly index: number; readonly error: Error }>;
  constructor(
    message: string,
    failures: ReadonlyArray<{ readonly index: number; readonly error: Error }>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.failures = failures;
  }
}
