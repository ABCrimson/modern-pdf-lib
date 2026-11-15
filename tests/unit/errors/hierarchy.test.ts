/**
 * The error hierarchy: every class the library exports has its parent, its stable `code`, its
 * `name`, the message and fields of its constructor, and a brand on its prototype that lets
 * `instanceof` work across separately built copies (see crossRealm.test.ts).
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BatchProcessingError,
  CombedTextLayoutError,
  EncryptedPdfError,
  EnvironmentError,
  ExceededMaxLengthError,
  FieldAlreadyExistsError,
  FontNotEmbeddedError,
  InvalidArgumentError,
  InvalidColorError,
  InvalidFieldNamePartError,
  InvalidPageSizeError,
  InvalidStateError,
  MalformedInputError,
  MissingOnValueCheckError,
  NoSuchFieldError,
  PdfError,
  PdfParseError as PdfParseErrorFromErrors,
  PluginError,
  RedactionIncompleteError,
  RemovePageFromEmptyDocumentError,
  ResourceLimitError,
  ScriptExecutionDisabledError,
  StreamingParseError,
  TimestampVerificationError,
  UnencodableTextError,
  UnexpectedFieldTypeError,
  UnsupportedEncryptionError,
  UnsupportedFeatureError,
  UnsupportedFilterError,
  UnsupportedOptionError,
} from '../../../src/errors.js';
import type { PdfErrorCode } from '../../../src/errors.js';
import { PdfParseError } from '../../../src/parser/parseError.js';
import { MemoryBudgetExceededError } from '../../../src/runtime/memoryBudget.js';

const BRAND = Symbol.for('modern-pdf-lib.errorClass');

type AnyClass = abstract new (...args: never[]) => Error;

interface Row {
  readonly cls: AnyClass;
  readonly parent: AnyClass;
  readonly code: PdfErrorCode;
  readonly make: () => Error & { readonly code: string };
  /** The message of `make()`, word for word as 0.40.9 wrote it (or the new form of a new class). */
  readonly message: string;
}

const rows: readonly Row[] = [
  {
    cls: InvalidArgumentError,
    parent: PdfError,
    code: 'invalid-argument',
    make: () => new InvalidArgumentError('index must be an integer'),
    message: 'index must be an integer',
  },
  {
    cls: InvalidStateError,
    parent: PdfError,
    code: 'invalid-state',
    make: () => new InvalidStateError('call init() first'),
    message: 'call init() first',
  },
  {
    cls: MalformedInputError,
    parent: PdfError,
    code: 'malformed-input',
    make: () => new MalformedInputError('PNG: bad CRC', { format: 'png' }),
    message: 'PNG: bad CRC',
  },
  {
    cls: UnsupportedFeatureError,
    parent: PdfError,
    code: 'unsupported-feature',
    make: () => new UnsupportedFeatureError('CMYK JPEG with an Adobe transform 2'),
    message: 'CMYK JPEG with an Adobe transform 2',
  },
  {
    cls: EnvironmentError,
    parent: PdfError,
    code: 'environment-unavailable',
    make: () => new EnvironmentError('Web Crypto is not available', { reason: 'web-crypto' }),
    message: 'Web Crypto is not available',
  },
  {
    cls: UnencodableTextError,
    parent: InvalidArgumentError,
    code: 'unencodable-text',
    make: () =>
      new UnencodableTextError({
        character: '日',
        index: 6,
        fontName: 'Helvetica',
        encoding: 'WinAnsiEncoding',
      }),
    message:
      'Helvetica (WinAnsiEncoding) cannot encode "日" (U+65E5) at index 6; embed a font that has this character: doc.embedFont(fontBytes)',
  },
  {
    cls: UnsupportedOptionError,
    parent: UnsupportedFeatureError,
    code: 'unsupported-option',
    make: () => new UnsupportedOptionError('signPdf()', 'timestampUrl', '0.45.0'),
    message:
      '`signPdf()`: the option `timestampUrl` is not supported in this release; it is planned for 0.45.0.',
  },
  {
    cls: PdfParseError,
    parent: MalformedInputError,
    code: 'malformed-pdf',
    make: () => new PdfParseError({ message: 'Expected "obj"', offset: 12 }),
    message: 'Expected "obj"',
  },
  {
    cls: StreamingParseError,
    parent: PdfParseError,
    code: 'streaming-parse',
    make: () => new StreamingParseError('Unexpected EOF', 4096),
    message: 'Unexpected EOF (at byte offset 4096)',
  },
  {
    cls: MissingOnValueCheckError,
    parent: MalformedInputError,
    code: 'missing-on-value',
    make: () => new MissingOnValueCheckError('cb1'),
    message:
      'Cannot determine the "on" value for checkbox/radio "cb1". The field is missing an /AP /N appearance dictionary with a non-/Off key.',
  },
  {
    cls: UnsupportedFilterError,
    parent: UnsupportedFeatureError,
    code: 'unsupported-filter',
    make: () => new UnsupportedFilterError('JBIG2Decode'),
    message: 'JBIG2 (JBIG2Decode) image data is not decoded in this release.',
  },
  {
    cls: UnsupportedEncryptionError,
    parent: UnsupportedFeatureError,
    code: 'unsupported-encryption-path',
    make: () => new UnsupportedEncryptionError(),
    message: 'This output path cannot apply the document encryption.',
  },
  {
    cls: ScriptExecutionDisabledError,
    parent: UnsupportedFeatureError,
    code: 'script-execution-disabled',
    make: () => new ScriptExecutionDisabledError(),
    message:
      'Form script execution is disabled: FormScriptSandbox.execute() does not evaluate PDF JavaScript.',
  },
  {
    cls: NoSuchFieldError,
    parent: InvalidArgumentError,
    code: 'no-such-field',
    make: () => new NoSuchFieldError('name'),
    message: 'No form field named "name" exists in this document.',
  },
  {
    cls: UnexpectedFieldTypeError,
    parent: InvalidArgumentError,
    code: 'unexpected-field-type',
    make: () => new UnexpectedFieldTypeError('f', 'text', 'checkbox'),
    message: 'Expected field "f" to be of type "text", but it is of type "checkbox".',
  },
  {
    cls: FieldAlreadyExistsError,
    parent: InvalidArgumentError,
    code: 'field-already-exists',
    make: () => new FieldAlreadyExistsError('f1'),
    message: 'A form field named "f1" already exists.',
  },
  {
    cls: InvalidFieldNamePartError,
    parent: InvalidArgumentError,
    code: 'invalid-field-name-part',
    make: () => new InvalidFieldNamePartError('a.b'),
    message: 'Invalid field name part: "a.b".',
  },
  {
    cls: CombedTextLayoutError,
    parent: InvalidArgumentError,
    code: 'combed-text-layout',
    make: () => new CombedTextLayoutError(10, 5),
    message: 'Combed text has 10 characters but the field only allows a maximum of 5.',
  },
  {
    cls: ExceededMaxLengthError,
    parent: InvalidArgumentError,
    code: 'exceeded-max-length',
    make: () => new ExceededMaxLengthError(20, 10, 'field'),
    message: 'The value for field "field" is 20 characters long, but the maximum length is 10.',
  },
  {
    cls: RemovePageFromEmptyDocumentError,
    parent: InvalidArgumentError,
    code: 'remove-page-from-empty-document',
    make: () => new RemovePageFromEmptyDocumentError(),
    message: 'Cannot remove a page from a document with no pages.',
  },
  {
    cls: InvalidPageSizeError,
    parent: InvalidArgumentError,
    code: 'invalid-page-size',
    make: () => new InvalidPageSizeError(0, 842),
    message:
      'Invalid page size: width=0, height=842. Both dimensions must be finite positive numbers.',
  },
  {
    cls: InvalidColorError,
    parent: InvalidArgumentError,
    code: 'invalid-color',
    make: () => new InvalidColorError('RGB component out of range: r=1.5'),
    message: 'RGB component out of range: r=1.5',
  },
  {
    cls: FontNotEmbeddedError,
    parent: InvalidStateError,
    code: 'font-not-embedded',
    make: () => new FontNotEmbeddedError('Helvetica'),
    message: 'The font "Helvetica" has not been embedded in this document.',
  },
  {
    cls: EncryptedPdfError,
    parent: PdfError,
    code: 'encrypted-pdf',
    make: () => new EncryptedPdfError(),
    message: 'The PDF is encrypted. Please provide a password.',
  },
  {
    cls: ResourceLimitError,
    parent: PdfError,
    code: 'resource-limit-exceeded',
    make: () => new ResourceLimitError('maxDecodedStreamBytes', 10, 'bytes', 11),
    message: 'Input exceeds the internal limit maxDecodedStreamBytes (10 bytes).',
  },
  {
    cls: RedactionIncompleteError,
    parent: PdfError,
    code: 'redaction-incomplete',
    make: () => new RedactionIncompleteError('redaction-unavailable'),
    message: 'Redaction by removal is not available in this release. Nothing was changed.',
  },
  {
    cls: TimestampVerificationError,
    parent: PdfError,
    code: 'timestamp-unverified',
    make: () => new TimestampVerificationError(),
    message: 'The timestamp response could not be verified.',
  },
  {
    cls: PluginError,
    parent: PdfError,
    code: 'plugin-failed',
    make: () => new PluginError('myPlugin', 'Failed to initialize'),
    message: 'Plugin "myPlugin": Failed to initialize',
  },
  {
    cls: BatchProcessingError,
    parent: PdfError,
    code: 'batch-failed',
    make: () => new BatchProcessingError('2 of 5 documents failed', []),
    message: '2 of 5 documents failed',
  },
  {
    cls: MemoryBudgetExceededError,
    parent: PdfError,
    code: 'memory-budget-exceeded',
    make: () => new MemoryBudgetExceededError(10, 95, 100),
    message:
      'Memory budget exceeded: requested 10 byte(s) with 95 of 100 byte(s) already in use (would total 105).',
  },
];

describe('PdfError', () => {
  it('is an abstract class directly under Error, branded with its name', () => {
    expect(Object.getPrototypeOf(PdfError)).toBe(Error);
    expect(Object.getOwnPropertyDescriptor(PdfError.prototype, BRAND)).toEqual({
      value: 'PdfError',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  });

  it('every code of the table belongs to exactly one class', () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(30);
  });

  it('parser/parseError.ts re-exports the class of errors.ts', () => {
    expect(PdfParseError).toBe(PdfParseErrorFromErrors);
  });
});

describe.each(rows)('$cls.name', ({ cls, parent, code, make, message }) => {
  it(`extends ${parent.name} and is an instance of PdfError and Error`, () => {
    expect(Object.getPrototypeOf(cls)).toBe(parent);
    const err = make();
    expect(err).toBeInstanceOf(cls);
    expect(err).toBeInstanceOf(parent);
    expect(err).toBeInstanceOf(PdfError);
    expect(err).toBeInstanceOf(Error);
  });

  it(`has code "${code}", its name and its message`, () => {
    const err = make();
    expect(err.code).toBe(code);
    expect(err.name).toBe(cls.name);
    expect(err.message).toBe(message);
    expect(PdfError.is(err)).toBe(true);
    expect(PdfError.is(err, code)).toBe(true);
  });

  it('carries its brand: an own, non-enumerable, read-only prototype property', () => {
    expect(Object.getOwnPropertyDescriptor(cls.prototype, BRAND)).toEqual({
      value: cls.name,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    expect(Object.keys(make())).not.toContain(String(BRAND));
  });
});

describe('a sibling never matches', () => {
  it('a parse error is no form error, and a form error is no parse error', () => {
    const parse = new PdfParseError({ message: 'x', offset: 0 });
    const field = new NoSuchFieldError('f');
    expect(parse).not.toBeInstanceOf(NoSuchFieldError);
    expect(parse).not.toBeInstanceOf(InvalidArgumentError);
    expect(parse).not.toBeInstanceOf(StreamingParseError);
    expect(field).not.toBeInstanceOf(PdfParseError);
    expect(field).not.toBeInstanceOf(UnexpectedFieldTypeError);
    expect(field).not.toBeInstanceOf(MalformedInputError);
  });

  it('a subclass made outside the library has no brand of its own', () => {
    class AppError extends InvalidArgumentError {}
    expect(new AppError('x')).toBeInstanceOf(InvalidArgumentError);
    expect(new AppError('x')).toBeInstanceOf(PdfError);
    expect(new InvalidArgumentError('x')).not.toBeInstanceOf(AppError);
    expect(new NoSuchFieldError('f')).not.toBeInstanceOf(AppError);
  });

  it('values that are not errors are no instances', () => {
    for (const value of [null, undefined, 0, 'PdfError', {}, Object.create(null), () => 0]) {
      expect(value instanceof PdfError).toBe(false);
    }
  });
});

describe('PdfError.is', () => {
  it('checks the code when one is given', () => {
    const err = new NoSuchFieldError('f');
    expect(PdfError.is(err, 'no-such-field')).toBe(true);
    expect(PdfError.is(err, 'invalid-argument')).toBe(false);
  });

  it('accepts an error of an older copy that carries a known code, and nothing else', () => {
    const older = Object.assign(new Error('redaction refused'), { code: 'redaction-incomplete' });
    expect(PdfError.is(older)).toBe(true);
    expect(PdfError.is(older, 'redaction-incomplete')).toBe(true);
    expect(PdfError.is(Object.assign(new Error('x'), { code: 'ERR_INVALID_ARG_TYPE' }))).toBe(
      false,
    );
    expect(PdfError.is(new Error('x'))).toBe(false);
    expect(PdfError.is('invalid-argument')).toBe(false);
    expect(PdfError.is(null)).toBe(false);
  });
});

describe('fields of the kind classes and the new classes', () => {
  it('InvalidArgumentError names the argument', () => {
    expect(new InvalidArgumentError('bad', { argument: 'index' }).argument).toBe('index');
    expect(new InvalidArgumentError('bad').argument).toBeUndefined();
    const cause = new Error('inner');
    expect(new InvalidArgumentError('bad', { cause }).cause).toBe(cause);
  });

  it('MalformedInputError names the format, "other" by default; a parse error is "pdf"', () => {
    expect(new MalformedInputError('x', { format: 'woff' }).format).toBe('woff');
    expect(new MalformedInputError('x').format).toBe('other');
    expect(new PdfParseError({ message: 'x', offset: 0 }).format).toBe('pdf');
    expect(new StreamingParseError('x').format).toBe('pdf');
    expect(new MissingOnValueCheckError('cb').format).toBe('pdf');
  });

  it('EnvironmentError names the reason', () => {
    expect(new EnvironmentError('x', { reason: 'wasm' }).reason).toBe('wasm');
  });

  it('EncryptedPdfError names the reason, password-required by default', () => {
    expect(new EncryptedPdfError().reason).toBe('password-required');
    const wrong = new EncryptedPdfError('Wrong password.', { reason: 'incorrect-password' });
    expect(wrong.reason).toBe('incorrect-password');
    expect(wrong.message).toBe('Wrong password.');
  });

  it('UnencodableTextError keeps a surrogate pair whole and reports a lone surrogate', () => {
    const emoji = new UnencodableTextError({
      character: '😀',
      index: 0,
      fontName: 'NotoSans-Regular',
      encoding: 'Identity-H',
    });
    expect(emoji.codePoint).toBe(0x1f600);
    expect(emoji.character).toBe('😀');
    expect(emoji.message).toBe(
      'NotoSans-Regular (Identity-H) cannot encode "😀" (U+1F600) at index 0: the font has no glyph for it',
    );
    const lone = new UnencodableTextError({
      character: '\uD800',
      index: 3,
      fontName: undefined,
      encoding: 'PDF byte string',
    });
    expect(lone.codePoint).toBe(0xd800);
    expect(lone.fontName).toBeUndefined();
    expect(lone.index).toBe(3);
    expect(lone.encoding).toBe('PDF byte string');
    expect(lone.message).toBe(
      'A PDF byte string cannot encode "\uD800" (U+D800) at index 3: it holds only U+0000 to U+00FF',
    );
  });

  it('UnsupportedOptionError has the three message forms and its fields', () => {
    const call = new UnsupportedOptionError('setCertificationLevel()', undefined, '0.45.0');
    expect(call.message).toBe(
      '`setCertificationLevel()` is not supported in this release; it is planned for 0.45.0.',
    );
    expect(call.option).toBeUndefined();
    expect(call.plannedFor).toBe('0.45.0');
    const removed = new UnsupportedOptionError('code128ToOperators()', 'showText', undefined, {
      hint: 'Use renderStyledBarcode() to draw the text.',
    });
    expect(removed.message).toBe(
      '`code128ToOperators()`: the option `showText` was removed in 0.41.0. Use renderStyledBarcode() to draw the text.',
    );
    expect(removed.entry).toBe('code128ToOperators()');
    expect(removed.option).toBe('showText');
    expect(removed.plannedFor).toBeUndefined();
  });

  it('StreamingParseError keeps its constructor: no offset, and a cause', () => {
    const cause = new Error('inner');
    const err = new StreamingParseError('Unexpected EOF', undefined, { cause });
    expect(err.offset).toBeUndefined();
    expect(err.message).toBe('Unexpected EOF');
    expect(err.cause).toBe(cause);
    expect(Object.getOwnPropertyDescriptor(err, 'cause')?.enumerable).toBe(false);
    expect(Object.hasOwn(new StreamingParseError('x'), 'cause')).toBe(false);
  });

  it('code is typed as the literal of a leaf and the subtree union of a parent', () => {
    expectTypeOf(new NoSuchFieldError('f').code).toEqualTypeOf<'no-such-field'>();
    expectTypeOf(new PdfParseError({ message: 'x', offset: 0 }).code).toEqualTypeOf<
      'malformed-pdf' | 'streaming-parse'
    >();
    expectTypeOf(new InvalidStateError('x').code).toEqualTypeOf<
      'invalid-state' | 'font-not-embedded'
    >();
  });
});
