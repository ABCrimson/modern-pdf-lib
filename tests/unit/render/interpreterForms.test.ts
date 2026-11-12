/**
 * Form XObjects in the interpreter: nested and repeated forms give the display list they always
 * gave, a form on the current invocation path is not entered again, and the operators interpreted
 * inside forms are budgeted per call.
 */
import { describe, it, expect } from 'vitest';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { interpretContentStream } from '../../../src/render/interpreter.js';
import { PdfDict, PdfName, PdfStream } from '../../../src/core/pdfObjects.js';
import { PdfNumber, PdfArray } from '../../../src/core/pdfObjects.js';
import { ResourceLimitError } from '../../../src/errors.js';
import { INTERNAL_LIMITS } from '../../../src/core/limits.js';

const ops = (s: string) => parseContentStream(new TextEncoder().encode(s));

/** A Form XObject whose content is `content` and whose own XObjects are `xobjects`. */
function form(
  content: string,
  xobjects: Record<string, PdfStream> = {},
  matrix?: number[],
): PdfStream {
  const dict = new PdfDict();
  dict.set('/Subtype', PdfName.of('Form'));
  if (matrix) dict.set('/Matrix', PdfArray.of(matrix.map((n) => PdfNumber.of(n))));
  if (Object.keys(xobjects).length > 0) dict.set('/Resources', resourcesOf(xobjects));
  return PdfStream.fromString(content, dict);
}

function resourcesOf(xobjects: Record<string, PdfStream>): PdfDict {
  const xo = new PdfDict();
  for (const [name, stream] of Object.entries(xobjects)) xo.set(`/${name}`, stream);
  return new PdfDict().set('/XObject', xo);
}

function interpret(content: string, xobjects: Record<string, PdfStream>) {
  return interpretContentStream(ops(content), {
    width: 200,
    height: 200,
    resources: resourcesOf(xobjects),
  });
}

describe('interpretContentStream: Form XObjects', () => {
  it('interprets nested forms with their matrices and resources', () => {
    const inner = form('2 0 0 2 0 0 cm 1 1 1 1 re f');
    const outer = form('0 0 5 5 re f /Inner Do', { Inner: inner }, [1, 0, 0, 1, 10, 20]);
    const dl = interpret('/Outer Do', { Outer: outer });
    expect(dl.items.map((i) => (i.type === 'fill' ? i.subpaths[0]!.points : i.type))).toEqual([
      [10, 20, 15, 20, 15, 25, 10, 25],
      [12, 22, 14, 22, 14, 24, 12, 24],
    ]);
  });

  it('interprets a form again at every call that is not inside itself', () => {
    const leaf = form('0 0 1 1 re f');
    const dl = interpret('/Leaf Do /Leaf Do q 1 0 0 1 5 5 cm /Leaf Do Q', { Leaf: leaf });
    expect(dl.items.map((i) => (i.type === 'fill' ? i.subpaths[0]!.points : i.type))).toEqual([
      [0, 0, 1, 0, 1, 1, 0, 1],
      [0, 0, 1, 0, 1, 1, 0, 1],
      [5, 5, 6, 5, 6, 6, 5, 6],
    ]);
  });

  it('falls back to the caller resources when a form has none', () => {
    const leaf = form('0 0 1 1 re f');
    const wrapper = form('/Leaf Do');
    const dl = interpret('/Wrapper Do', { Wrapper: wrapper, Leaf: leaf });
    expect(dl.items.map((i) => i.type)).toEqual(['fill']);
  });

  it('records the placement of an XObject that is not a stream', () => {
    const dl = interpret('/Missing Do', {});
    expect(dl.items.map((i) => i.type)).toEqual(['image']);
  });

  it('interprets a form once per recursion path', () => {
    const resources = new PdfDict();
    const self = form('0 0 1 1 re f /Self Do /Self Do');
    self.dict.set('/Resources', resourcesOf({ Self: self }));
    void resources;
    const dl = interpret('/Self Do', { Self: self });
    expect(dl.items.map((i) => i.type)).toEqual(['fill']);
  });

  it('enters a form that calls its caller only once per path', () => {
    const a = form('0 0 1 1 re f');
    const b = form('2 2 1 1 re f /A Do');
    a.dict.set('/Resources', resourcesOf({ B: b }));
    a.data = new TextEncoder().encode('0 0 1 1 re f /B Do');
    b.dict.set('/Resources', resourcesOf({ A: a }));
    const dl = interpret('/A Do', { A: a });
    expect(dl.items.length).toBe(2);
  });

  it('throws ResourceLimitError above the form operator limit', () => {
    // 12 distinct forms; each calls the next 10 times: 10^12 interpretations without a budget.
    let next = form('0 0 1 1 re f');
    for (let level = 0; level < 11; level++) {
      next = form('/N Do '.repeat(10), { N: next });
    }
    let thrown: unknown;
    try {
      interpret('/N Do', { N: next });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ResourceLimitError);
    expect(thrown).toMatchObject({
      code: 'resource-limit-exceeded',
      limit: 'maxFormOperators',
      max: INTERNAL_LIMITS.maxFormOperators,
    });
  });

  it('counts the operators of forms per call, not across calls', () => {
    // Each call counts limit / 2 + 1 operators: a counter carried across calls throws on the second.
    const leaf = form('n '.repeat(INTERNAL_LIMITS.maxFormOperators / 2 + 1));
    for (let call = 0; call < 2; call++) {
      expect(interpret('/Leaf Do', { Leaf: leaf }).items.length).toBe(0);
    }
  });

  it('counts the elements of the operands of an operator', () => {
    const leaf = form(`[${'(a)'.repeat(1000)}] TJ`);
    // One TJ with 1000 one-character strings costs 1 + 1000 + 1000 = 2001 operators.
    const calls = Math.floor(INTERNAL_LIMITS.maxFormOperators / 2001);
    expect(() => interpret('/Leaf Do '.repeat(calls - 1), { Leaf: leaf })).not.toThrow();
    expect(() => interpret('/Leaf Do '.repeat(calls + 2), { Leaf: leaf })).toThrow(
      ResourceLimitError,
    );
  });

  it('throws ResourceLimitError for one form above the operator limit', () => {
    const big = form('n '.repeat(INTERNAL_LIMITS.maxFormOperators + 1));
    expect(() => interpret('/Big Do', { Big: big })).toThrow(ResourceLimitError);
  });

  it('reads the data of a form that cannot be decoded once for two calls of it', () => {
    const bad = form('0 0 1 1 re f');
    let reads = 0;
    Object.defineProperty(bad, 'data', {
      get() {
        reads++;
        throw new Error('unreadable');
      },
    });
    expect(interpret('/Bad Do /Bad Do', { Bad: bad }).items.length).toBe(0);
    expect(reads).toBe(1);
  });

  it('throws a ResourceLimitError raised while decoding a form', () => {
    const bad = form('0 0 1 1 re f');
    Object.defineProperty(bad, 'data', {
      get() {
        throw new ResourceLimitError('maxDecodedStreamBytes', 1, 'bytes');
      },
    });
    expect(() => interpret('/Bad Do', { Bad: bad })).toThrow(ResourceLimitError);
  });

  it('skips a form whose content cannot be decoded for another reason', () => {
    const bad = form('0 0 1 1 re f');
    Object.defineProperty(bad, 'data', {
      get() {
        throw new Error('unreadable');
      },
    });
    expect(interpret('/Bad Do 0 0 2 2 re f', { Bad: bad }).items.length).toBe(1);
  });
});
