/**
 * The object definitions of a PDF file, counted from its bytes: each `N G obj` header, and each
 * member listed by an object stream that the last cross-reference stream points into (an object
 * packed there counts as one definition of its own number). A file that defines an object
 * number more than once carries dead copies: a reader uses only the definition the
 * cross-reference data names.
 *
 * Unencrypted streams only, with a direct /Length; enough for the files this library writes.
 */
import { inflateSync } from 'node:zlib';

// One character per byte: TextDecoder's "latin1" label decodes as windows-1252, which keeps byte
// offsets; stream data is read from the bytes themselves.
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

const HEADER = /(?<=^|[\r\n])(\d+) \d+ obj\b/g;

interface StreamObject {
  readonly num: number;
  readonly dict: string;
  readonly data: Uint8Array;
}

/** The stream object whose header `m` matched, data decoded; undefined for another object. */
function streamAt(bytes: Uint8Array, text: string, m: RegExpExecArray): StreamObject | undefined {
  const dictStart = m.index + m[0].length;
  const keyword = text.indexOf('stream', dictStart);
  const dict = text.slice(dictStart, keyword);
  if (keyword < 0 || dict.includes('endobj')) return undefined;
  const length = Number(/\/Length (\d+)/.exec(dict)![1]);
  const start = keyword + (text.startsWith('stream\r\n', keyword) ? 8 : 7);
  let data = bytes.subarray(start, start + length);
  if (/\/Filter\s*\/FlateDecode/.test(dict)) data = inflateSync(data);
  return { num: Number(m[1]), dict, data };
}

/** The containers the cross-reference stream `startxref` names points into (none for a table). */
function liveContainers(bytes: Uint8Array): Set<number> {
  const containers = new Set<number>();
  const text = latin1(bytes);
  const offset = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text)![1]);
  const header = /^(\d+) \d+ obj\b/.exec(text.slice(offset, offset + 32));
  if (header === null) return containers;
  const xref = streamAt(bytes, text, Object.assign(header, { index: offset }))!;
  const [w0 = 0, w1 = 0, w2 = 0] = /\/W\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s*\]/
    .exec(xref.dict)!
    .slice(1)
    .map(Number);
  const field = (at: number, width: number): number =>
    xref.data.subarray(at, at + width).reduce((n, byte) => n * 256 + byte, 0);
  const step = w0 + w1 + w2;
  for (let at = 0; at + step <= xref.data.length; at += step) {
    if (field(at, w0) === 2) containers.add(field(at + w0, w1));
  }
  return containers;
}

/** The object numbers the live object streams list, one per member. */
export function objectStreamMembers(bytes: Uint8Array): number[] {
  const live = liveContainers(bytes);
  const text = latin1(bytes);
  const members: number[] = [];
  for (const m of text.matchAll(HEADER)) {
    if (!live.has(Number(m[1]))) continue;
    const { dict, data } = streamAt(bytes, text, m)!;
    const first = Number(/\/First (\d+)/.exec(dict)![1]);
    const pairs = latin1(data.subarray(0, first)).trim().split(/\s+/).map(Number);
    for (let i = 0; i < pairs.length; i += 2) members.push(pairs[i]!);
  }
  return members;
}

/** Object number -> how many times `bytes` defines it, headers and object stream members. */
export function objectDefinitions(bytes: Uint8Array): Map<number, number> {
  const count = new Map<number, number>();
  const add = (num: number): void => void count.set(num, (count.get(num) ?? 0) + 1);
  for (const m of latin1(bytes).matchAll(HEADER)) add(Number(m[1]));
  for (const num of objectStreamMembers(bytes)) add(num);
  return count;
}

/** The object numbers `bytes` defines more than once, as `number: count`. */
export function repeatedDefinitions(bytes: Uint8Array): string[] {
  return [...objectDefinitions(bytes)].filter(([, n]) => n > 1).map(([num, n]) => `${num}: ${n}`);
}
