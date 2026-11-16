/**
 * @module errors
 *
 * The error classes of modern-pdf-lib. Every class derives from the
 * abstract {@link PdfError}, which carries a machine-readable `code`. Five
 * kind classes sit under it ({@link InvalidArgumentError}, {@link InvalidStateError},
 * {@link MalformedInputError}, {@link UnsupportedFeatureError},
 * {@link EnvironmentError}); the named classes sit under a kind or directly
 * under `PdfError`. Class names follow pdf-lib where pdf-lib has the class.
 *
 * `code` and `name` are the contract: stable across releases, identical in
 * every build, never minified. `instanceof` with any class of this module that
 * derives from PdfError also holds for an error made by another copy of the
 * library (the ESM and CJS builds of one install, an IIFE in another realm):
 * see the static `[Symbol.hasInstance]` of {@link PdfError}.
 *
 * Every constructor takes a `cause`: through `ErrorOptions`, or for
 * PdfParseError through the `cause` field of its options.
 */

import type { LimitName } from './internal/limits.js';

// ---------------------------------------------------------------------------
// The base class
// ---------------------------------------------------------------------------

/** Every code a {@link PdfError} can carry. Stable across releases: a code is never renamed or reused. */
export type PdfErrorCode =
  | 'invalid-argument'
  | 'invalid-state'
  | 'malformed-input'
  | 'unsupported-feature'
  | 'environment-unavailable'
  | 'encrypted-pdf'
  | 'resource-limit-exceeded'
  | 'malformed-pdf'
  | 'streaming-parse'
  | 'unsupported-filter'
  | 'unsupported-encryption-path'
  | 'script-execution-disabled'
  | 'unsupported-option'
  | 'redaction-incomplete'
  | 'timestamp-unverified'
  | 'plugin-failed'
  | 'batch-failed'
  | 'memory-budget-exceeded'
  | 'font-not-embedded'
  | 'remove-page-from-empty-document'
  | 'no-such-field'
  | 'unexpected-field-type'
  | 'missing-on-value'
  | 'field-already-exists'
  | 'invalid-field-name-part'
  | 'combed-text-layout'
  | 'exceeded-max-length'
  | 'invalid-page-size'
  | 'invalid-color'
  | 'unencodable-text';

/** The codes, as a table the compiler checks against {@link PdfErrorCode} in both directions. */
const KNOWN_CODES: Readonly<Record<PdfErrorCode, true>> = {
  'invalid-argument': true,
  'invalid-state': true,
  'malformed-input': true,
  'unsupported-feature': true,
  'environment-unavailable': true,
  'encrypted-pdf': true,
  'resource-limit-exceeded': true,
  'malformed-pdf': true,
  'streaming-parse': true,
  'unsupported-filter': true,
  'unsupported-encryption-path': true,
  'script-execution-disabled': true,
  'unsupported-option': true,
  'redaction-incomplete': true,
  'timestamp-unverified': true,
  'plugin-failed': true,
  'batch-failed': true,
  'memory-budget-exceeded': true,
  'font-not-embedded': true,
  'remove-page-from-empty-document': true,
  'no-such-field': true,
  'unexpected-field-type': true,
  'missing-on-value': true,
  'field-already-exists': true,
  'invalid-field-name-part': true,
  'combed-text-layout': true,
  'exceeded-max-length': true,
  'invalid-page-size': true,
  'invalid-color': true,
  'unencodable-text': true,
};

/**
 * The key of the brand of each class: a registered symbol, so every copy of
 * the library in every realm of one agent uses the same key.
 */
const BRAND: unique symbol = Symbol.for('modern-pdf-lib.errorClass');

/**
 * Stores `name` as the brand of `cls`: an own, non-enumerable, read-only
 * prototype property.  Every error class of the library calls it once, from
 * a static block, with its own name.
 *
 * Marked `@__NO_SIDE_EFFECTS__`: the call changes only the class it receives, so
 * a bundler may drop it together with a class that nothing uses.
 *
 * @internal Used by the error classes outside this module; no package entry exports it.
 */
/* @__NO_SIDE_EFFECTS__ */
export function brandErrorClass(
  cls: abstract new (...args: never[]) => PdfError,
  name: string,
): void {
  Object.defineProperty(cls.prototype, BRAND, { value: name });
}

/** The brand `target` holds as an own property, or `undefined`. */
function ownBrand(target: object): unknown {
  return Object.getOwnPropertyDescriptor(target, BRAND)?.value;
}

/**
 * The base of every error this library throws on purpose.  It is abstract:
 * each error is an instance of one of its subclasses.
 *
 * - `code` and `name` are stable across releases, identical in every build,
 *   and never minified.
 * - `instanceof` holds across copies of the library (see the static
 *   `[Symbol.hasInstance]` below).
 * - {@link PdfError.is} checks the code alone, so it also accepts the errors of
 *   an older copy that carry a code.
 *
 * @example
 * ```ts
 * try {
 *   await loadPdf(bytes);
 * } catch (e) {
 *   if (e instanceof MalformedInputError) console.error('not a PDF:', e.message);
 *   else if (PdfError.is(e, 'resource-limit-exceeded')) console.error('too large');
 *   else throw e;
 * }
 * ```
 */
export abstract class PdfError extends Error {
  static {
    brandErrorClass(this, 'PdfError');
  }

  /** Machine-readable, stable across releases and identical in every build; never minified. */
  abstract readonly code: PdfErrorCode;

  /**
   * True when `value` is an instance of this class: by the ordinary prototype
   * check, or, for an error made by another copy of the library (another
   * build, another realm), when some prototype of `value` carries the same
   * brand as this class.  Each class of this module stores its name as its
   * brand under `Symbol.for("modern-pdf-lib.errorClass")`.  The check reads the
   * brand of the class it is called on, so a sibling class never matches, and a
   * subclass made outside the library (which has no brand of its own) matches
   * only by the ordinary check.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    if (Function.prototype[Symbol.hasInstance].call(this, value)) return true;
    const wanted = ownBrand(this.prototype);
    if (wanted === undefined) return false;
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
    for (
      let proto: object | null = Object.getPrototypeOf(value);
      proto !== null;
      proto = Object.getPrototypeOf(proto)
    ) {
      if (ownBrand(proto) === wanted) return true;
    }
    return false;
  }

  /**
   * True when `value` is an error, of this realm or another, whose `code` is
   * a {@link PdfErrorCode}, and equals `code` when one is given.  Past that
   * it reads only the code, so it also accepts an error of an older copy of
   * the library that carries a code.
   */
  static is<C extends PdfErrorCode>(
    value: unknown,
    code?: C,
  ): value is PdfError & { readonly code: C } {
    if (typeof value !== 'object' || value === null || !('code' in value)) return false;
    if (!(value instanceof Error) && Object.prototype.toString.call(value) !== '[object Error]')
      return false;
    const actual = value.code;
    if (code !== undefined) return actual === code;
    return typeof actual === 'string' && Object.hasOwn(KNOWN_CODES, actual);
  }
}

// ---------------------------------------------------------------------------
// Kind classes
// ---------------------------------------------------------------------------

/**
 * Thrown when an argument of a call is not valid: out of range, of the wrong
 * type, or naming something that does not exist.  The named subclasses
 * (field, page, color and text errors) carry their own code.
 */
export class InvalidArgumentError extends PdfError {
  static {
    brandErrorClass(this, 'InvalidArgumentError');
  }

  override readonly name:
    | 'InvalidArgumentError'
    | 'UnencodableTextError'
    | 'NoSuchFieldError'
    | 'UnexpectedFieldTypeError'
    | 'FieldAlreadyExistsError'
    | 'InvalidFieldNamePartError'
    | 'CombedTextLayoutError'
    | 'ExceededMaxLengthError'
    | 'RemovePageFromEmptyDocumentError'
    | 'InvalidPageSizeError'
    | 'InvalidColorError' = 'InvalidArgumentError';
  override readonly code:
    | 'invalid-argument'
    | 'unencodable-text'
    | 'no-such-field'
    | 'unexpected-field-type'
    | 'field-already-exists'
    | 'invalid-field-name-part'
    | 'combed-text-layout'
    | 'exceeded-max-length'
    | 'remove-page-from-empty-document'
    | 'invalid-page-size'
    | 'invalid-color' = 'invalid-argument';
  /** The argument at fault, as `index` or `options.width`; `undefined` when not named. */
  readonly argument: string | undefined;

  constructor(message: string, options?: ErrorOptions & { argument?: string | undefined }) {
    super(message, options);
    this.argument = options?.argument;
  }
}

/**
 * Thrown when a call is valid in itself but not in the current state of the
 * object, such as a call before the required set-up.
 */
export class InvalidStateError extends PdfError {
  static {
    brandErrorClass(this, 'InvalidStateError');
  }

  override readonly name: 'InvalidStateError' | 'FontNotEmbeddedError' = 'InvalidStateError';
  override readonly code: 'invalid-state' | 'font-not-embedded' = 'invalid-state';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** The format whose rules the input of a {@link MalformedInputError} breaks. */
export type MalformedInputFormat =
  | 'pdf'
  | 'png'
  | 'jpeg'
  | 'tiff'
  | 'webp'
  | 'woff'
  | 'sfnt'
  | 'cmap'
  | 'der'
  | 'icc'
  | 'other';

/** Thrown when input bytes break the rules of their format. */
export class MalformedInputError extends PdfError {
  static {
    brandErrorClass(this, 'MalformedInputError');
  }

  override readonly name:
    | 'MalformedInputError'
    | 'PdfParseError'
    | 'StreamingParseError'
    | 'MissingOnValueCheckError' = 'MalformedInputError';
  override readonly code:
    | 'malformed-input'
    | 'malformed-pdf'
    | 'streaming-parse'
    | 'missing-on-value' = 'malformed-input';
  /** The format the input breaks; `'other'` when none of the listed formats. */
  readonly format: MalformedInputFormat;

  constructor(
    message: string,
    options?: ErrorOptions & { format?: MalformedInputFormat | undefined },
  ) {
    super(message, options);
    this.format = options?.format ?? 'other';
  }
}

/**
 * Thrown when input is valid but uses a feature this release does not
 * handle.  The named subclasses (filters, encryption paths, scripts, options)
 * carry their own code.
 */
export class UnsupportedFeatureError extends PdfError {
  static {
    brandErrorClass(this, 'UnsupportedFeatureError');
  }

  override readonly name:
    | 'UnsupportedFeatureError'
    | 'UnsupportedOptionError'
    | 'UnsupportedFilterError'
    | 'UnsupportedEncryptionError'
    | 'ScriptExecutionDisabledError' = 'UnsupportedFeatureError';
  override readonly code:
    | 'unsupported-feature'
    | 'unsupported-option'
    | 'unsupported-filter'
    | 'unsupported-encryption-path'
    | 'script-execution-disabled' = 'unsupported-feature';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** What the runtime of an {@link EnvironmentError} lacks. */
export type EnvironmentErrorReason = 'web-crypto' | 'wasm' | 'network' | 'runtime-api';

/** Thrown when the runtime lacks something a call needs: Web Crypto, WebAssembly, the network or another API. */
export class EnvironmentError extends PdfError {
  static {
    brandErrorClass(this, 'EnvironmentError');
  }

  override readonly name = 'EnvironmentError';
  override readonly code = 'environment-unavailable' as const;
  /** What the runtime lacks. */
  readonly reason: EnvironmentErrorReason;

  constructor(message: string, options: ErrorOptions & { reason: EnvironmentErrorReason }) {
    super(message, options);
    this.reason = options.reason;
  }
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/** Why an encrypted PDF could not be opened. */
export type EncryptedPdfReason = 'password-required' | 'incorrect-password';

/**
 * Thrown when attempting to load or manipulate an encrypted PDF without
 * providing the correct password.
 */
export class EncryptedPdfError extends PdfError {
  static {
    brandErrorClass(this, 'EncryptedPdfError');
  }

  override readonly name = 'EncryptedPdfError';
  override readonly code = 'encrypted-pdf' as const;
  /** Why the PDF could not be opened; `'password-required'` unless the constructor was told otherwise. */
  readonly reason: EncryptedPdfReason;

  constructor(
    message = 'The PDF is encrypted. Please provide a password.',
    options?: ErrorOptions & { reason?: EncryptedPdfReason | undefined },
  ) {
    super(message, options);
    this.reason = options?.reason ?? 'password-required';
  }
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * Thrown when a font operation requires an embedded font but none has been
 * registered or the font reference is invalid.
 */
export class FontNotEmbeddedError extends InvalidStateError {
  static {
    brandErrorClass(this, 'FontNotEmbeddedError');
  }

  override readonly name = 'FontNotEmbeddedError';
  override readonly code = 'font-not-embedded' as const;
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
 * Thrown when attempting to remove a page from a document that has no pages.
 */
export class RemovePageFromEmptyDocumentError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'RemovePageFromEmptyDocumentError');
  }

  override readonly name = 'RemovePageFromEmptyDocumentError';
  override readonly code = 'remove-page-from-empty-document' as const;
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
export class NoSuchFieldError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'NoSuchFieldError');
  }

  override readonly name = 'NoSuchFieldError';
  override readonly code = 'no-such-field' as const;
  constructor(fieldName: string, options?: ErrorOptions) {
    super(`No form field named "${fieldName}" exists in this document.`, options);
  }
}

/**
 * Thrown when a form field is accessed via the wrong typed getter
 * (e.g. calling `getTextField()` on a checkbox field).
 */
export class UnexpectedFieldTypeError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'UnexpectedFieldTypeError');
  }

  override readonly name = 'UnexpectedFieldTypeError';
  override readonly code = 'unexpected-field-type' as const;
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
export class MissingOnValueCheckError extends MalformedInputError {
  static {
    brandErrorClass(this, 'MissingOnValueCheckError');
  }

  override readonly name = 'MissingOnValueCheckError';
  override readonly code = 'missing-on-value' as const;
  constructor(fieldName: string, options?: ErrorOptions) {
    super(
      `Cannot determine the "on" value for checkbox/radio "${fieldName}". ` +
        'The field is missing an /AP /N appearance dictionary with a non-/Off key.',
      { ...options, format: 'pdf' },
    );
  }
}

/**
 * Thrown when creating a form field with a name that is already in use.
 */
export class FieldAlreadyExistsError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'FieldAlreadyExistsError');
  }

  override readonly name = 'FieldAlreadyExistsError';
  override readonly code = 'field-already-exists' as const;
  constructor(fieldName: string, options?: ErrorOptions) {
    super(`A form field named "${fieldName}" already exists.`, options);
  }
}

/**
 * Thrown when a field name part (between dots in a qualified name) is
 * empty or contains invalid characters.
 */
export class InvalidFieldNamePartError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'InvalidFieldNamePartError');
  }

  override readonly name = 'InvalidFieldNamePartError';
  override readonly code = 'invalid-field-name-part' as const;
  constructor(namePart: string, options?: ErrorOptions) {
    super(`Invalid field name part: "${namePart}".`, options);
  }
}

// ---------------------------------------------------------------------------
// Text layout
// ---------------------------------------------------------------------------

/**
 * Thrown when a combed text field receives more characters than its
 * maximum length allows.
 */
export class CombedTextLayoutError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'CombedTextLayoutError');
  }

  override readonly name = 'CombedTextLayoutError';
  override readonly code = 'combed-text-layout' as const;
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
export class ExceededMaxLengthError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'ExceededMaxLengthError');
  }

  override readonly name = 'ExceededMaxLengthError';
  override readonly code = 'exceeded-max-length' as const;
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
export class InvalidPageSizeError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'InvalidPageSizeError');
  }

  override readonly name = 'InvalidPageSizeError';
  override readonly code = 'invalid-page-size' as const;
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
export class InvalidColorError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'InvalidColorError');
  }

  override readonly name = 'InvalidColorError';
  override readonly code = 'invalid-color' as const;
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
export class PluginError extends PdfError {
  static {
    brandErrorClass(this, 'PluginError');
  }

  override readonly name = 'PluginError';
  override readonly code = 'plugin-failed' as const;
  /** Name of the plugin that caused the error. */
  readonly pluginName: string;
  constructor(pluginName: string, message: string, options?: ErrorOptions) {
    super(`Plugin "${pluginName}": ${message}`, options);
    this.pluginName = pluginName;
  }
}

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the bytes of a PDF break its syntax.  The message names what
 * was expected and what was found, with a hex dump around the offset when
 * the data is given.
 */
export class PdfParseError extends MalformedInputError {
  static {
    brandErrorClass(this, 'PdfParseError');
  }

  override readonly name: 'PdfParseError' | 'StreamingParseError' = 'PdfParseError';
  override readonly code: 'malformed-pdf' | 'streaming-parse' = 'malformed-pdf';
  /**
   * Byte offset of the error.  Every PdfParseError the library throws has one;
   * `undefined` when none was given, as for a {@link StreamingParseError}
   * made without one.
   */
  readonly offset: number | undefined;
  readonly expected: string;
  readonly actual: string;
  readonly hexContext: string;

  constructor(options: {
    message: string;
    offset: number | undefined;
    expected?: string | undefined;
    actual?: string | undefined;
    data?: Uint8Array | undefined;
    cause?: Error | undefined;
  }) {
    // Build multi-line message with context
    const hexCtx =
      options.data && options.offset !== undefined
        ? formatHexContext(options.data, options.offset)
        : '';
    const parts = [options.message];
    if (options.expected) parts.push(`  Expected: ${options.expected}`);
    if (options.actual) parts.push(`  Got: ${options.actual}`);
    if (hexCtx) parts.push(`  Context:\n${hexCtx}`);

    super(
      parts.join('\n'),
      options.cause ? { cause: options.cause, format: 'pdf' } : { format: 'pdf' },
    );
    this.offset = options.offset;
    this.expected = options.expected ?? '';
    this.actual = options.actual ?? '';
    this.hexContext = hexCtx;
  }
}

/** The hex and ASCII dump of `data` around `offset` that a {@link PdfParseError} message shows. */
export function formatHexContext(data: Uint8Array, offset: number, windowSize = 16): string {
  const start = Math.max(0, offset - windowSize);
  const end = Math.min(data.length, offset + windowSize);
  const slice = data.subarray(start, end);

  const hexParts: string[] = [];
  const asciiParts: string[] = [];

  for (let i = 0; i < slice.length; i++) {
    const byte = slice[i]!;
    const isErrorByte = start + i === offset;
    const hex = byte.toString(16).padStart(2, '0');
    hexParts.push(isErrorByte ? `[${hex}]` : ` ${hex} `);
    asciiParts.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }

  return [
    `    Offset ${start}:`,
    `    Hex:   ${hexParts.join('')}`,
    `    ASCII: ${asciiParts.join(' ')}`,
    `    Error at offset ${offset} (marked with [])`,
  ].join('\n');
}

/**
 * Thrown when a streaming (incremental) parse operation encounters
 * corrupt or incomplete data that prevents further processing.
 *
 * @example
 * ```ts
 * throw new StreamingParseError('Unexpected EOF at byte offset 4096');
 * ```
 */
export class StreamingParseError extends PdfParseError {
  static {
    brandErrorClass(this, 'StreamingParseError');
  }

  override readonly name = 'StreamingParseError';
  override readonly code = 'streaming-parse' as const;
  /**
   * @param message - The first line of the message; ` (at byte offset N)` follows it when
   *   `offset` is given.
   * @param offset  - The byte offset of the error, if known.
   * @param options - A `cause`; `expected` and `actual` add the lines `Expected:` and `Got:` to
   *   the message, and `data` with an offset adds a hex dump of the bytes around it, as for a
   *   {@link PdfParseError}.
   */
  constructor(
    message: string,
    offset?: number,
    options?: ErrorOptions & {
      expected?: string | undefined;
      actual?: string | undefined;
      data?: Uint8Array | undefined;
    },
  ) {
    super({
      message: offset !== undefined ? `${message} (at byte offset ${offset})` : message,
      offset,
      expected: options?.expected,
      actual: options?.actual,
      data: options?.data,
    });
    // ErrorOptions installs any cause, as the Error constructor does; the parent takes only an Error.
    if (options !== undefined && 'cause' in options) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        writable: true,
        configurable: true,
      });
    }
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
export class BatchProcessingError extends PdfError {
  static {
    brandErrorClass(this, 'BatchProcessingError');
  }

  override readonly name = 'BatchProcessingError';
  override readonly code = 'batch-failed' as const;
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

// ---------------------------------------------------------------------------
// Fail-closed errors (0.40.5; their codes are unchanged since then)
// ---------------------------------------------------------------------------

/**
 * Thrown by `FormScriptSandbox.execute()`: modern-pdf-lib does not evaluate
 * PDF JavaScript, so no script text is compiled or run.
 */
export class ScriptExecutionDisabledError extends UnsupportedFeatureError {
  static {
    brandErrorClass(this, 'ScriptExecutionDisabledError');
  }

  override readonly name = 'ScriptExecutionDisabledError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'script-execution-disabled' as const;
  constructor(
    message = 'Form script execution is disabled: FormScriptSandbox.execute() does not evaluate PDF JavaScript.',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Why a redaction was refused.  The one reason of this release is
 * `'redaction-unavailable'`: redaction by removal is not available, so every
 * redaction entry point refuses.  A later release adds reasons.
 */
export type RedactionIncompleteReason = 'redaction-unavailable';

/**
 * Thrown by every redaction entry point (`redactRegions`, `applyRedactions`,
 * `applyRedaction`, `PdfDocument.applyRedactions()`) because redaction by
 * removal is not available in this release.  Nothing is drawn, removed or
 * cleared: marks, annotations and page content stay as they were.
 */
export class RedactionIncompleteError extends PdfError {
  static {
    brandErrorClass(this, 'RedactionIncompleteError');
  }

  override readonly name = 'RedactionIncompleteError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'redaction-incomplete' as const;
  /** Why the redaction was refused. */
  readonly reason: RedactionIncompleteReason;
  /** Zero-based page index, or `undefined` when no page is known. */
  readonly pageIndex: number | undefined;
  constructor(
    reason: RedactionIncompleteReason,
    message = 'Redaction by removal is not available in this release. Nothing was changed.',
    options?: ErrorOptions & { pageIndex?: number | undefined },
  ) {
    super(message, options);
    this.reason = reason;
    this.pageIndex = options?.pageIndex;
  }
}

/**
 * Thrown when a timestamp response cannot be tied to the data it claims to
 * timestamp.
 */
export class TimestampVerificationError extends PdfError {
  static {
    brandErrorClass(this, 'TimestampVerificationError');
  }

  override readonly name = 'TimestampVerificationError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'timestamp-unverified' as const;
  constructor(message = 'The timestamp response could not be verified.', options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * Thrown when an output path cannot apply the document's encryption.
 */
export class UnsupportedEncryptionError extends UnsupportedFeatureError {
  static {
    brandErrorClass(this, 'UnsupportedEncryptionError');
  }

  override readonly name = 'UnsupportedEncryptionError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'unsupported-encryption-path' as const;
  constructor(
    message = 'This output path cannot apply the document encryption.',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

// ---------------------------------------------------------------------------
// Bounded decode (0.40.8)
// ---------------------------------------------------------------------------

/**
 * Thrown when input needs more than one of the library's limits allows: more
 * decoded bytes, mappings, nesting levels, operators, pixels, frames or font
 * bytes, in one stream or summed over one call.  A value equal to the limit is
 * accepted; only a value above it (or a size that is not a finite number) is
 * refused.  `limit` is one of the names of {@link LimitName}, and
 * `DEFAULT_LIMITS` holds the default values.
 */
export class ResourceLimitError extends PdfError {
  static {
    brandErrorClass(this, 'ResourceLimitError');
  }

  override readonly name = 'ResourceLimitError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'resource-limit-exceeded' as const;
  /** The name of the limit, such as `'maxDecodedStreamBytes'`. */
  readonly limit: LimitName;
  /** The value of that limit. */
  readonly max: number;
  /** The size the input needed, or `undefined` when it is not a finite number or not known. */
  readonly actual: number | undefined;
  /** `'option'` when a `limits` option set the limit to a value other than its default, `'default'` otherwise. */
  readonly source: 'default' | 'option';
  /**
   * @param limit - The name of the limit.
   * @param max - The value of that limit.
   * @param unit - What the limit counts (`bytes`, `levels`, ...), for the message.
   * @param actual - The size the input needed, when known.
   * @param options - The cause, and the `source` of the limit (`'default'` when left out).
   */
  constructor(
    limit: LimitName,
    max: number,
    unit: string,
    actual?: number,
    options?: ErrorOptions & { source?: 'default' | 'option' | undefined },
  ) {
    super(`Input exceeds the limit ${limit} (${max} ${unit}).`, options);
    this.limit = limit;
    this.max = max;
    this.actual = actual;
    this.source = options?.source ?? 'default';
  }
}

/** A stream filter or image format this release does not decode. */
export type UnsupportedFilterName = 'JPXDecode' | 'JBIG2Decode' | 'VP8';

const UNSUPPORTED_FILTER_MESSAGES: Readonly<Record<UnsupportedFilterName, string>> = {
  JPXDecode: 'JPEG 2000 (JPXDecode) image data is not decoded in this release.',
  JBIG2Decode: 'JBIG2 (JBIG2Decode) image data is not decoded in this release.',
  VP8: 'Lossy WebP (VP8) images are not decoded in this release; lossless WebP (VP8L) is supported. Convert the image to PNG or JPEG first.',
};

/**
 * Thrown when image data is in a format this release does not decode:
 * JPEG 2000 (`/JPXDecode`), JBIG2 (`/JBIG2Decode`) and lossy WebP (VP8).
 * Nothing of the data is read.  A document that holds such a stream is still
 * loaded and saved with the stream unchanged.
 */
export class UnsupportedFilterError extends UnsupportedFeatureError {
  static {
    brandErrorClass(this, 'UnsupportedFilterError');
  }

  override readonly name = 'UnsupportedFilterError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'unsupported-filter' as const;
  /** The filter or format that is not decoded. */
  readonly filter: UnsupportedFilterName;
  constructor(
    filter: UnsupportedFilterName,
    message: string = UNSUPPORTED_FILTER_MESSAGES[filter],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.filter = filter;
  }
}

// ---------------------------------------------------------------------------
// Text encoding
// ---------------------------------------------------------------------------

/** How text is turned into bytes where an {@link UnencodableTextError} is thrown. */
export type TextEncodingName =
  /** The 12 Latin standard fonts. */
  | 'WinAnsiEncoding'
  /** The built-in encoding of Symbol. */
  | 'SymbolEncoding'
  /** The built-in encoding of ZapfDingbats. */
  | 'ZapfDingbatsEncoding'
  /** Embedded fonts: Unicode to glyph id through the font cmap. */
  | 'Identity-H'
  /** A byte string, such as the operand of a low-level text operator: each character is U+0000 to U+00FF. */
  | 'PDF byte string'
  /** A PDF text string (PDFDocEncoding, UTF-16BE or UTF-8): every Unicode scalar value but U+001B. */
  | 'PDF text string';

/** What the message of an {@link UnencodableTextError} adds after the character, per encoding. */
const UNENCODABLE_TEXT_HINTS: Readonly<Record<TextEncodingName, string>> = {
  WinAnsiEncoding: '; embed a font that has this character: doc.embedFont(fontBytes)',
  SymbolEncoding: '; embed a font that has this character: doc.embedFont(fontBytes)',
  ZapfDingbatsEncoding: '; embed a font that has this character: doc.embedFont(fontBytes)',
  'Identity-H': ': the font has no glyph for it',
  'PDF byte string': ': it holds only U+0000 to U+00FF',
  'PDF text string':
    ': it holds only Unicode scalar values (PDFDocEncoding: only the characters of ISO 32000-2 Table D.2 but dotaccent; any encoding: no U+001B)',
};

/**
 * Thrown when a font (or a byte-level operator) cannot encode a character
 * of the text.  Nothing of the text is written.
 *
 * @example
 * ```ts
 * // Helvetica (WinAnsiEncoding) cannot encode "日" (U+65E5) at index 6; embed a font that has this character: doc.embedFont(fontBytes)
 * ```
 */
export class UnencodableTextError extends InvalidArgumentError {
  static {
    brandErrorClass(this, 'UnencodableTextError');
  }

  override readonly name = 'UnencodableTextError';
  override readonly code = 'unencodable-text' as const;
  /** The first character that cannot be encoded: one whole code point (a surrogate pair stays whole). */
  readonly character: string;
  /** Its code point; a lone surrogate reports its own value (0xD800 to 0xDFFF). */
  readonly codePoint: number;
  /**
   * UTF-16 index of the character in the text given; for standard-font text whose grapheme
   * cluster NFC changes, the index of that cluster.
   */
  readonly index: number;
  /** BaseFont of the font (`Helvetica`, the PostScript name of an embedded font); `undefined` for an operator. */
  readonly fontName: string | undefined;
  /** The encoding that has no code for the character. */
  readonly encoding: TextEncodingName;

  constructor(
    init: {
      readonly character: string;
      readonly index: number;
      readonly fontName: string | undefined;
      readonly encoding: TextEncodingName;
    },
    /**
     * A `cause`, and a `hint` that ends the message in place of the advice for the encoding
     * (for text that a caller can draw only by font name, where no embedded font helps).
     * The hint is appended as given, so it starts with its separator (`; ` or `: `).
     */
    options?: ErrorOptions & { readonly hint?: string | undefined },
  ) {
    const codePoint = init.character.codePointAt(0) ?? Number.NaN;
    const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
    const writer =
      init.fontName === undefined ? `A ${init.encoding}` : `${init.fontName} (${init.encoding})`;
    const { hint = UNENCODABLE_TEXT_HINTS[init.encoding], ...errorOptions } = options ?? {};
    super(
      `${writer} cannot encode "${init.character}" (U+${hex}) at index ${init.index}${hint}`,
      options === undefined ? undefined : errorOptions,
    );
    this.character = init.character;
    this.codePoint = codePoint;
    this.index = init.index;
    this.fontName = init.fontName;
    this.encoding = init.encoding;
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** A release number, as `0.45.0`. */
export type PdfLibVersion = `${number}.${number}.${number}`;

/**
 * Thrown when a call passes an option, or makes a call, that this release
 * does not carry out.  The message names the entry, the option and the
 * release, never a value the caller passed.
 *
 * @example
 * ```ts
 * // `signPdf()`: the option `timestampUrl` is not supported in this release; it is planned for 0.45.0.
 * ```
 */
export class UnsupportedOptionError extends UnsupportedFeatureError {
  static {
    brandErrorClass(this, 'UnsupportedOptionError');
  }

  override readonly name = 'UnsupportedOptionError';
  /** Machine-readable code, stable across releases. */
  override readonly code = 'unsupported-option' as const;
  /** The function or constructor, as `signPdf()` or `new StreamingPdfParser()`. */
  readonly entry: string;
  /** The option; `undefined` when the whole call is unsupported. */
  readonly option: string | undefined;
  /** The release planned to implement it; `undefined` when it was removed. */
  readonly plannedFor: PdfLibVersion | undefined;

  /**
   * @param entry - The function or constructor, as `signPdf()`.
   * @param option - The option, or `undefined` for the whole call.
   * @param plannedFor - The release planned to implement it, or `undefined` when it was removed.
   * @param options - `cause`, and `hint`: a fixed sentence the message ends with.
   */
  constructor(
    entry: string,
    option: string | undefined,
    plannedFor: PdfLibVersion | undefined,
    options?: ErrorOptions & { hint?: string | undefined },
  ) {
    const subject =
      option === undefined ? `\`${entry}\`` : `\`${entry}\`: the option \`${option}\``;
    let fate: string;
    if (plannedFor !== undefined) {
      fate = ` is not supported in this release; it is planned for ${plannedFor}.`;
    } else if (option === undefined) {
      fate = ' is not supported in this release.';
    } else {
      fate = ' was removed in 0.41.0.';
    }
    super(subject + fate + (options?.hint === undefined ? '' : ` ${options.hint}`), options);
    this.entry = entry;
    this.option = option;
    this.plannedFor = plannedFor;
  }
}
