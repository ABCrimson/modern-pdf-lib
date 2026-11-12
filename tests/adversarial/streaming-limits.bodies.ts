/**
 * Entries of the streaming parser's adversarial pair (streaming-limits.test.ts). The runner loads
 * this module in a worker and calls one named export. The inputs are ordinary bytes built here.
 */
import type { JsonValue } from '../helpers/budget.js';
import { StreamingPdfParser } from '../../src/parser/streamingParser.js';

const MIB = 1024 * 1024;

/**
 * Feeds `args.mib` MiB of ordinary filler to a parser in chunks of `args.chunk` bytes and returns
 * the number of bytes the parser reports having read. The parse itself (`end()`) is not run: the
 * entry measures the cost of buffering.
 */
export function feedFiller(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { mib, chunk, maxBufferSize } = args as {
    mib: number;
    chunk: number;
    maxBufferSize: number;
  };
  const parser = new StreamingPdfParser({ maxBufferSize });
  const piece = new Uint8Array(chunk).fill(0x20);
  let read = 0;
  parser.on('progress', (event) => {
    if (event.type === 'progress') read = event.bytesRead;
  });
  for (let fed = 0; fed < mib * MIB; fed += chunk) parser.feed(piece);
  return { read };
}

/**
 * Feeds filler past `maxBufferSize` in chunks of `args.chunk` bytes. The parser refuses the chunk
 * that would pass the cap with its parse error; the error propagates to the runner.
 */
export function feedPastCap(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { mib, chunk } = args as { mib: number; chunk: number };
  const parser = new StreamingPdfParser({ maxBufferSize: mib * MIB });
  const piece = new Uint8Array(chunk);
  for (let fed = 0; fed <= mib * MIB; fed += chunk) parser.feed(piece);
  return null;
}
