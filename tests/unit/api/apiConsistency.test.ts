/**
 * API consistency tests — verifies the stable API audit fixes:
 *
 * 1. All embed* methods return Promises
 * 2. All error classes have proper name and message
 * 3. Option types accept undefined
 * 4. Error class hierarchy
 * 5. FontRef interface completeness
 * 6. Point type for DrawLineOptions
 * 7. DrawPageOptions uses Angle type
 * 8. Naming convention aliases (asPdfName / asPdfNumber)
 * 9. TransparencyGroupOptions has | undefined
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  StandardFonts,
  PageSizes,
  rgb,
  degrees,
  radians,
  // Error classes (existing)
  EncryptedPdfError,
  FontNotEmbeddedError,
  ForeignPageError,
  RemovePageFromEmptyDocumentError,
  NoSuchFieldError,
  UnexpectedFieldTypeError,
  MissingOnValueCheckError,
  FieldAlreadyExistsError,
  InvalidFieldNamePartError,
  FieldExistsAsNonTerminalError,
  RichTextFieldReadError,
  CombedTextLayoutError,
  ExceededMaxLengthError,
  // Value helpers
  asPDFName,
  asPDFNumber,
  asNumber,
  PdfNumber,
} from '../../../src/index.js';

// Import new items directly from source files (not yet in index.ts)
import {
  InvalidPageSizeError,
  InvalidColorError,
  PluginError,
  StreamingParseError,
  BatchProcessingError,
} from '../../../src/errors.js';

import {
  asPdfName,
  asPdfNumber,
} from '../../../src/utils/pdfValueHelpers.js';

import type {
  FontRef,
  FontRefInternal,
  Point,
  DrawLineOptions,
  TransparencyGroupOptions,
} from '../../../src/core/pdfPage.js';

import type {
  DrawPageOptions,
} from '../../../src/core/pdfEmbed.js';

import type { Angle } from '../../../src/core/operators/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures/images');

// =========================================================================
// 1. embed* methods return Promises
// =========================================================================

describe('embed* methods return Promises', () => {
  it('embedPng returns a Promise<ImageRef>', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const result = doc.embedPng(pngBytes);
    expect(result).toBeInstanceOf(Promise);
    const img = await result;
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
  });

  it('embedJpeg returns a Promise<ImageRef>', async () => {
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();
    const result = doc.embedJpeg(jpegBytes);
    expect(result).toBeInstanceOf(Promise);
    const img = await result;
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
  });

  it('embedImage returns a Promise<ImageRef>', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const result = doc.embedImage(pngBytes);
    expect(result).toBeInstanceOf(Promise);
    const img = await result;
    expect(img.name).toMatch(/^Im\d+$/);
  });

  it('embedFont returns a Promise<FontRef>', async () => {
    const doc = createPdf();
    const result = doc.embedFont('Helvetica');
    expect(result).toBeInstanceOf(Promise);
    const font = await result;
    expect(font.name).toBeDefined();
    expect(font.ref).toBeDefined();
  });
});

// =========================================================================
// 2. Error classes — proper name, message, and hierarchy
// =========================================================================

describe('error classes — existing', () => {
  const errorCases: Array<[string, Error]> = [
    ['EncryptedPdfError', new EncryptedPdfError()],
    ['FontNotEmbeddedError', new FontNotEmbeddedError()],
    ['ForeignPageError', new ForeignPageError()],
    ['RemovePageFromEmptyDocumentError', new RemovePageFromEmptyDocumentError()],
    ['NoSuchFieldError', new NoSuchFieldError('test')],
    ['UnexpectedFieldTypeError', new UnexpectedFieldTypeError('f', 'text', 'checkbox')],
    ['MissingOnValueCheckError', new MissingOnValueCheckError('cb1')],
    ['FieldAlreadyExistsError', new FieldAlreadyExistsError('f1')],
    ['InvalidFieldNamePartError', new InvalidFieldNamePartError('')],
    ['FieldExistsAsNonTerminalError', new FieldExistsAsNonTerminalError('node')],
    ['RichTextFieldReadError', new RichTextFieldReadError('rt')],
    ['CombedTextLayoutError', new CombedTextLayoutError(10, 5)],
    ['ExceededMaxLengthError', new ExceededMaxLengthError(20, 10, 'field')],
  ];

  for (const [expectedName, error] of errorCases) {
    it(`${expectedName} extends Error`, () => {
      expect(error).toBeInstanceOf(Error);
    });

    it(`${expectedName} has correct name property`, () => {
      expect(error.name).toBe(expectedName);
    });

    it(`${expectedName} has non-empty message`, () => {
      expect(error.message.length).toBeGreaterThan(0);
    });

    it(`${expectedName} supports error chaining via cause`, () => {
      const cause = new Error('root cause');
      // Each class accepts ErrorOptions as last param
      let chained: Error;
      switch (expectedName) {
        case 'EncryptedPdfError':
          chained = new EncryptedPdfError('msg', { cause });
          break;
        case 'FontNotEmbeddedError':
          chained = new FontNotEmbeddedError('f', { cause });
          break;
        case 'ForeignPageError':
          chained = new ForeignPageError({ cause });
          break;
        case 'RemovePageFromEmptyDocumentError':
          chained = new RemovePageFromEmptyDocumentError({ cause });
          break;
        case 'NoSuchFieldError':
          chained = new NoSuchFieldError('f', { cause });
          break;
        case 'UnexpectedFieldTypeError':
          chained = new UnexpectedFieldTypeError('f', 'a', 'b', { cause });
          break;
        case 'MissingOnValueCheckError':
          chained = new MissingOnValueCheckError('f', { cause });
          break;
        case 'FieldAlreadyExistsError':
          chained = new FieldAlreadyExistsError('f', { cause });
          break;
        case 'InvalidFieldNamePartError':
          chained = new InvalidFieldNamePartError('p', { cause });
          break;
        case 'FieldExistsAsNonTerminalError':
          chained = new FieldExistsAsNonTerminalError('f', { cause });
          break;
        case 'RichTextFieldReadError':
          chained = new RichTextFieldReadError('f', { cause });
          break;
        case 'CombedTextLayoutError':
          chained = new CombedTextLayoutError(5, 3, { cause });
          break;
        case 'ExceededMaxLengthError':
          chained = new ExceededMaxLengthError(10, 5, 'f', { cause });
          break;
        default:
          throw new Error(`Unknown error class: ${expectedName}`);
      }
      expect(chained.cause).toBe(cause);
    });
  }
});

describe('error classes — new (audit additions)', () => {
  it('InvalidPageSizeError extends Error', () => {
    const err = new InvalidPageSizeError(0, -1);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidPageSizeError');
    expect(err.message).toContain('width=0');
    expect(err.message).toContain('height=-1');
  });

  it('InvalidPageSizeError supports cause chaining', () => {
    const cause = new Error('root');
    const err = new InvalidPageSizeError(0, 0, { cause });
    expect(err.cause).toBe(cause);
  });

  it('InvalidColorError extends Error', () => {
    const err = new InvalidColorError('r=1.5 is out of range');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidColorError');
    expect(err.message).toContain('r=1.5');
  });

  it('InvalidColorError supports cause chaining', () => {
    const cause = new Error('root');
    const err = new InvalidColorError('bad', { cause });
    expect(err.cause).toBe(cause);
  });

  it('PluginError extends Error and carries pluginName', () => {
    const err = new PluginError('wasm-deflate', 'WASM init failed');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PluginError');
    expect(err.pluginName).toBe('wasm-deflate');
    expect(err.message).toContain('wasm-deflate');
    expect(err.message).toContain('WASM init failed');
  });

  it('PluginError supports cause chaining', () => {
    const cause = new Error('root');
    const err = new PluginError('p', 'msg', { cause });
    expect(err.cause).toBe(cause);
  });

  it('StreamingParseError extends Error and carries offset', () => {
    const err = new StreamingParseError('Unexpected EOF', 4096);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('StreamingParseError');
    expect(err.offset).toBe(4096);
    expect(err.message).toContain('4096');
  });

  it('StreamingParseError works without offset', () => {
    const err = new StreamingParseError('Generic parse error');
    expect(err.name).toBe('StreamingParseError');
    expect(err.offset).toBeUndefined();
    expect(err.message).toBe('Generic parse error');
  });

  it('StreamingParseError supports cause chaining', () => {
    const cause = new Error('root');
    const err = new StreamingParseError('msg', 0, { cause });
    expect(err.cause).toBe(cause);
  });

  it('BatchProcessingError extends Error and carries failures', () => {
    const failures = [
      { index: 1, error: new Error('failed item 1') },
      { index: 3, error: new Error('failed item 3') },
    ];
    const err = new BatchProcessingError('2 of 5 failed', failures);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BatchProcessingError');
    expect(err.failures).toHaveLength(2);
    expect(err.failures[0]!.index).toBe(1);
    expect(err.failures[1]!.index).toBe(3);
    expect(err.message).toContain('2 of 5 failed');
  });

  it('BatchProcessingError supports cause chaining', () => {
    const cause = new Error('root');
    const err = new BatchProcessingError('msg', [], { cause });
    expect(err.cause).toBe(cause);
  });
});

// =========================================================================
// 3. Option types accept undefined
// =========================================================================

describe('option types accept undefined', () => {
  it('DrawLineOptions accepts Point objects', () => {
    const opts: DrawLineOptions = {
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      color: undefined,
      thickness: undefined,
      dashArray: undefined,
      dashPhase: undefined,
      opacity: undefined,
      blendMode: undefined,
    };
    expect(opts.start.x).toBe(0);
    expect(opts.end.y).toBe(100);
  });

  it('TransparencyGroupOptions accepts undefined values', () => {
    const opts: TransparencyGroupOptions = {
      isolated: undefined,
      knockout: undefined,
      colorSpace: undefined,
    };
    expect(opts.isolated).toBeUndefined();
    expect(opts.knockout).toBeUndefined();
    expect(opts.colorSpace).toBeUndefined();
  });

  it('DrawPageOptions angle fields accept Angle type', () => {
    const opts: DrawPageOptions = {
      x: 50,
      y: 50,
      rotate: degrees(45),
      xSkew: radians(0.1),
      ySkew: degrees(5),
    };
    expect(opts.rotate!.type).toBe('degrees');
    expect(opts.rotate!.value).toBe(45);
    expect(opts.xSkew!.type).toBe('radians');
    expect(opts.ySkew!.type).toBe('degrees');
  });

  it('DrawPageOptions angle fields accept undefined', () => {
    const opts: DrawPageOptions = {
      rotate: undefined,
      xSkew: undefined,
      ySkew: undefined,
      opacity: undefined,
      blendMode: undefined,
    };
    expect(opts.rotate).toBeUndefined();
  });
});

// =========================================================================
// 4. FontRef interface completeness
// =========================================================================

describe('FontRef interface', () => {
  it('standard font has all required methods (sizeAtHeight, getCharacterSet)', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // These should be required (not optional) on FontRef
    expect(typeof font.widthOfTextAtSize).toBe('function');
    expect(typeof font.heightAtSize).toBe('function');
    expect(typeof font.sizeAtHeight).toBe('function');
    expect(typeof font.getCharacterSet).toBe('function');
  });

  it('sizeAtHeight returns a number', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = font.sizeAtHeight(12);
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThan(0);
  });

  it('getCharacterSet returns number[]', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const codepoints = font.getCharacterSet();
    expect(Array.isArray(codepoints)).toBe(true);
    expect(codepoints.length).toBeGreaterThan(0);
    expect(codepoints.every((c: number) => typeof c === 'number')).toBe(true);
  });

  it('sizeAtHeight is the inverse of heightAtSize', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const height = font.heightAtSize(12);
    const recoveredSize = font.sizeAtHeight(height);
    expect(recoveredSize).toBeCloseTo(12, 4);
  });

  it('FontRef does not expose _isCIDFont or _encodeText on public interface', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Standard fonts should not have these internal properties
    expect('_isCIDFont' in font).toBe(false);
    expect('_encodeText' in font).toBe(false);
  });
});

describe('FontRefInternal interface', () => {
  it('FontRefInternal extends FontRef', () => {
    // Type-level check: if a FontRefInternal satisfies FontRef, this compiles
    const internal: FontRefInternal = {
      name: 'F1',
      ref: { kind: 'ref', objectNumber: 1, generationNumber: 0 } as any,
      widthOfTextAtSize: () => 0,
      heightAtSize: () => 0,
      sizeAtHeight: () => 0,
      getCharacterSet: () => [],
      _isCIDFont: true,
      _encodeText: () => '',
    };

    // FontRefInternal should be assignable to FontRef
    const publicRef: FontRef = internal;
    expect(publicRef.name).toBe('F1');
    expect(typeof publicRef.widthOfTextAtSize).toBe('function');
    expect(typeof publicRef.sizeAtHeight).toBe('function');
    expect(typeof publicRef.getCharacterSet).toBe('function');
  });
});

// =========================================================================
// 5. Point type
// =========================================================================

describe('Point type', () => {
  it('Point has readonly x and y', () => {
    const p: Point = { x: 10, y: 20 };
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });

  it('DrawLineOptions uses Point for start and end', () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 100, y: 200 };
    const opts: DrawLineOptions = { start, end };
    expect(opts.start).toBe(start);
    expect(opts.end).toBe(end);
  });
});

// =========================================================================
// 6. DrawPageOptions uses Angle type
// =========================================================================

describe('DrawPageOptions uses Angle type', () => {
  it('accepts degrees() for rotate', () => {
    const angle = degrees(90);
    const opts: DrawPageOptions = { rotate: angle };
    expect(opts.rotate).toStrictEqual({ type: 'degrees', value: 90 });
  });

  it('accepts radians() for xSkew', () => {
    const angle = radians(Math.PI / 4);
    const opts: DrawPageOptions = { xSkew: angle };
    expect(opts.xSkew!.type).toBe('radians');
  });

  it('accepts Angle union for ySkew', () => {
    const angle: Angle = { type: 'degrees', value: 15 };
    const opts: DrawPageOptions = { ySkew: angle };
    expect(opts.ySkew!.value).toBe(15);
  });
});

// =========================================================================
// 7. Naming convention aliases
// =========================================================================

describe('asPdfName / asPdfNumber aliases', () => {
  it('asPdfName creates a PdfName', () => {
    const name = asPdfName('Type');
    // PdfName.of() prepends '/' if not already present
    expect(name.value).toBe('/Type');
    expect(name.kind).toBe('name');
  });

  it('asPdfNumber creates a PdfNumber', () => {
    const num = asPdfNumber(42);
    expect(num.value).toBe(42);
    expect(num.kind).toBe('number');
  });

  it('asPDFName (deprecated) still works and produces same result', () => {
    const newResult = asPdfName('Page');
    const oldResult = asPDFName('Page');
    expect(newResult.value).toBe(oldResult.value);
    expect(newResult.kind).toBe(oldResult.kind);
  });

  it('asPDFNumber (deprecated) still works and produces same result', () => {
    const newResult = asPdfNumber(99);
    const oldResult = asPDFNumber(99);
    expect(newResult.value).toBe(oldResult.value);
    expect(newResult.kind).toBe(oldResult.kind);
  });

  it('asNumber extracts value from PdfNumber', () => {
    const num = PdfNumber.of(7);
    expect(asNumber(num)).toBe(7);
  });
});

// =========================================================================
// 8. Error class hierarchy — all extend Error
// =========================================================================

describe('error class hierarchy', () => {
  const allErrors = [
    // Existing
    new EncryptedPdfError(),
    new FontNotEmbeddedError(),
    new ForeignPageError(),
    new RemovePageFromEmptyDocumentError(),
    new NoSuchFieldError('f'),
    new UnexpectedFieldTypeError('f', 'a', 'b'),
    new MissingOnValueCheckError('f'),
    new FieldAlreadyExistsError('f'),
    new InvalidFieldNamePartError('p'),
    new FieldExistsAsNonTerminalError('f'),
    new RichTextFieldReadError('f'),
    new CombedTextLayoutError(1, 1),
    new ExceededMaxLengthError(1, 1, 'f'),
    // New
    new InvalidPageSizeError(0, 0),
    new InvalidColorError('bad'),
    new PluginError('p', 'm'),
    new StreamingParseError('m'),
    new BatchProcessingError('m', []),
  ];

  it('all error classes extend Error', () => {
    for (const err of allErrors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('all error classes have distinct name properties', () => {
    const names = allErrors.map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all error classes have non-empty message', () => {
    for (const err of allErrors) {
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it('all error classes produce proper stack traces', () => {
    for (const err of allErrors) {
      expect(typeof err.stack).toBe('string');
      expect(err.stack!.length).toBeGreaterThan(0);
    }
  });
});

// =========================================================================
// 9. Integration: drawing with updated types works end-to-end
// =========================================================================

describe('integration: drawing with Point-based DrawLineOptions', () => {
  it('page.drawLine works with Point-typed start/end', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.drawLine({
      start: { x: 50, y: 700 },
      end: { x: 300, y: 700 },
      color: rgb(0, 0, 0),
      thickness: 2,
    });

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('integration: drawPage with Angle-typed rotate', async () => {
  it('drawPage accepts degrees() for rotate', async () => {
    const doc = createPdf();
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawText('Source page', { x: 50, y: 750 });

    // Save and reload to get a source for embedding
    const bytes1 = await doc.save();
    const loaded = await createPdf().constructor.load(bytes1);

    const doc2 = createPdf();
    const embedded = await doc2.embedPage(loaded.getPage(0));
    const page2 = doc2.addPage(PageSizes.A4);

    // This should work because DrawPageOptions now uses Angle
    page2.drawPage(embedded, {
      x: 50,
      y: 50,
      rotate: degrees(45),
    });

    const bytes2 = await doc2.save();
    expect(bytes2.length).toBeGreaterThan(0);
  });
});

describe('integration: TransparencyGroupOptions with undefined', () => {
  it('beginTransparencyGroup accepts all-undefined options', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    page.beginTransparencyGroup({
      isolated: undefined,
      knockout: undefined,
      colorSpace: undefined,
    });
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    page.endTransparencyGroup();

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});
