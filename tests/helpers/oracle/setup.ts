/**
 * Setup file of the oracle project (vitest.config.ts `setupFiles`): every PDF a plain test
 * writes goes through qpdf.
 *
 * It wraps `PdfDocument.prototype.save` and `saveAsStream` for the test files of this project
 * and records each output a test makes; a stream's output is recorded when the stream has been
 * read to its end. A call made from a file under this repository's src/ (a library method that
 * saves internally, such as `sign()`) is not recorded. After each test, the test fails when an
 * output was not passed to expectQpdfClean() (tests/helpers/oracle/qpdf.ts). Exempt: a
 * knownDefect() marker (a guard error inside a `test.fails` would count as its expected
 * failure), and a test that is already failing or skipped.
 */
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach } from 'vitest';
import { PdfDocument } from '../../../src/index.js';
import type { PdfSaveOptions } from '../../../src/index.js';
import { recordOutput, resetOutputs, uncheckedOutputs } from './outputs.js';

/** This repository's src/ directory, with forward slashes and a trailing slash. */
const SRC_DIR = fileURLToPath(new URL('../../../src/', import.meta.url)).replaceAll('\\', '/');

/** True when the caller of the wrapped method is a file under this repository's src/. */
function calledFromSource(): boolean {
  const frames = (new Error().stack ?? '').split('\n').slice(1);
  const caller = frames.find((f) => !f.includes('helpers/oracle/setup.ts'))?.replaceAll('\\', '/');
  return caller !== undefined && caller.includes(SRC_DIR);
}

/** The library's own method, read from the prototype before it is replaced. */
function original<K extends 'save' | 'saveAsStream'>(name: K): PdfDocument[K] {
  return Object.getOwnPropertyDescriptor(PdfDocument.prototype, name)?.value as PdfDocument[K];
}

const save = original('save');
const saveAsStream = original('saveAsStream');

PdfDocument.prototype.save = async function (
  this: PdfDocument,
  options?: PdfSaveOptions,
): Promise<Uint8Array> {
  const internal = calledFromSource();
  const bytes = await save.call(this, options);
  if (!internal) recordOutput('save()', bytes);
  return bytes;
};

PdfDocument.prototype.saveAsStream = function (
  this: PdfDocument,
  options?: PdfSaveOptions,
): ReadableStream<Uint8Array> {
  const stream = saveAsStream.call(this, options);
  if (calledFromSource()) return stream;
  const chunks: Uint8Array[] = [];
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        chunks.push(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.length;
        }
        recordOutput('saveAsStream()', bytes);
      },
    }),
  );
};

beforeEach(() => {
  resetOutputs();
});

afterEach((ctx) => {
  const unchecked = uncheckedOutputs();
  resetOutputs();
  if (
    unchecked.length === 0 ||
    ctx.task.meta.ledger !== undefined ||
    ctx.task.result?.state === 'fail' ||
    ctx.task.result?.state === 'skip'
  ) {
    return;
  }
  throw new Error(
    `oracle guard: ${unchecked.length} output(s) of this test never went through expectQpdfClean(): ${unchecked.join(', ')}`,
  );
});
