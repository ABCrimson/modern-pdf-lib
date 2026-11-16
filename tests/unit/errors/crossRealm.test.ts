/**
 * `instanceof` across separately built copies of the library. src/errors.ts is evaluated a second
 * and a third time from its source: once in this realm (two builds side by side, such as the ESM and
 * the CJS file of one install) and once in a node:vm realm (an IIFE run in another context). Each
 * evaluation makes its own classes, so only the per-class brand can tie an error of one copy to
 * the class of another.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext, runInThisContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import * as outer from '../../../src/errors.js';

type ErrorsModule = typeof outer;

const SOURCE = readFileSync(new URL('../../../src/errors.ts', import.meta.url), 'utf8');
const CJS = transformSync(SOURCE, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

/** One more evaluation of src/errors.ts, through `run` (a realm's script runner). */
function evaluate(run: (code: string) => unknown): ErrorsModule {
  const module = { exports: {} };
  const factory = run(`(function (module, exports) {\n${CJS}\n})`) as (
    m: typeof module,
    e: object,
  ) => void;
  factory(module, module.exports);
  return module.exports as ErrorsModule;
}

const copies: ReadonlyArray<readonly [string, ErrorsModule]> = [
  ['a second copy in this realm', evaluate((code) => runInThisContext(code))],
  ['a copy in a node:vm realm', evaluate((code) => runInContext(code, createContext()))],
];

describe.each(copies)('%s', (_label, copy) => {
  it('has classes of its own', () => {
    expect(copy.PdfParseError).not.toBe(outer.PdfParseError);
    expect(copy.PdfError).not.toBe(outer.PdfError);
  });

  it('a PdfParseError of the copy is an outer PdfParseError, MalformedInputError and PdfError', () => {
    const err = new copy.PdfParseError({ message: 'Expected "obj"', offset: 12 });
    expect(err instanceof outer.PdfParseError).toBe(true);
    expect(err instanceof outer.MalformedInputError).toBe(true);
    expect(err instanceof outer.PdfError).toBe(true);
    expect(err.code).toBe('malformed-pdf');
    expect(err.name).toBe('PdfParseError');
  });

  it('a PdfParseError of the copy is NOT an outer NoSuchFieldError, nor any sibling', () => {
    const err = new copy.PdfParseError({ message: 'Expected "obj"', offset: 12 });
    expect(err instanceof outer.NoSuchFieldError).toBe(false);
    expect(err instanceof outer.InvalidArgumentError).toBe(false);
    expect(err instanceof outer.StreamingParseError).toBe(false);
    expect(err instanceof outer.UnsupportedFeatureError).toBe(false);
  });

  it('a form error of the copy is an outer form error and no parse error', () => {
    const err = new copy.NoSuchFieldError('name');
    expect(err instanceof outer.NoSuchFieldError).toBe(true);
    expect(err instanceof outer.InvalidArgumentError).toBe(true);
    expect(err instanceof outer.PdfParseError).toBe(false);
    expect(err instanceof outer.UnexpectedFieldTypeError).toBe(false);
  });

  it('a subclass of the copy is an instance of the outer parent, and the check is symmetric', () => {
    expect(new copy.StreamingParseError('EOF', 3) instanceof outer.PdfParseError).toBe(true);
    expect(new outer.StreamingParseError('EOF', 3) instanceof copy.PdfParseError).toBe(true);
    expect(
      new outer.PdfParseError({ message: 'x', offset: 0 }) instanceof copy.StreamingParseError,
    ).toBe(false);
  });

  it('both new classes carry the brand across copies', () => {
    const text = new copy.UnencodableTextError({
      character: '日',
      index: 0,
      fontName: 'Helvetica',
      encoding: 'WinAnsiEncoding',
    });
    const option = new copy.UnsupportedOptionError('signPdf()', 'timestampUrl', '0.45.0');
    expect(text instanceof outer.UnencodableTextError).toBe(true);
    expect(text instanceof outer.InvalidArgumentError).toBe(true);
    expect(text instanceof outer.UnsupportedOptionError).toBe(false);
    expect(option instanceof outer.UnsupportedOptionError).toBe(true);
    expect(option instanceof outer.UnsupportedFeatureError).toBe(true);
    expect(option instanceof outer.UnencodableTextError).toBe(false);
  });

  it('an outer subclass made outside the library does not claim the errors of the copy', () => {
    class AppError extends outer.InvalidArgumentError {}
    expect(new copy.InvalidArgumentError('x') instanceof AppError).toBe(false);
    expect(new AppError('x') instanceof copy.InvalidArgumentError).toBe(true);
  });

  it('PdfError.is of one copy accepts the errors of the other', () => {
    const err = new copy.ResourceLimitError('maxDecodedStreamBytes', 1, 'bytes');
    expect(outer.PdfError.is(err, 'resource-limit-exceeded')).toBe(true);
    expect(copy.PdfError.is(new outer.NoSuchFieldError('f'), 'no-such-field')).toBe(true);
  });
});

describe('the realm boundary', () => {
  it('breaks the native check, which is why the brand exists', () => {
    const [, vmCopy] = copies[1]!;
    const err = new vmCopy.PdfParseError({ message: 'x', offset: 0 });
    expect(err instanceof Error).toBe(false);
    expect(err instanceof outer.PdfParseError).toBe(true);
  });

  it('does not stop PdfError.is, which accepts an error of the other realm', () => {
    const [, vmCopy] = copies[1]!;
    const err = new vmCopy.PdfParseError({ message: 'x', offset: 0 });
    expect(outer.PdfError.is(err, 'malformed-pdf')).toBe(true);
    expect(outer.PdfError.is(err)).toBe(true);
  });
});
