/**
 * @module parser/internal/streamFraming
 *
 * The one rule that decides where the data of a stream object ends. Both the object parser and
 * the streaming parser frame stream data through {@link frameStreamData}.
 *
 * The rule:
 *
 * 1. A declared `/Length` is trusted when, after PDF white space and comments, the keyword
 *    `endstream` follows the declared bytes. The first {@link MAX_TRAILING_WHITESPACE} bytes of
 *    each gap are free; a byte beyond them is paid from the input's own allowance
 *    ({@link KeywordIndex.trailingSkipBudget}, as many bytes as the input is long), so the gaps of
 *    all streams of one input together cost time linear in its length. A gap that outruns the
 *    allowance is not trusted and takes rule 2. A gap is paid for once: framing the same stream
 *    again reuses its end.
 * 2. Otherwise the data ends at the first `endstream` at or after the data start, or at the first
 *    `endobj` when that comes earlier or no `endstream` follows, minus at most one end-of-line
 *    marker immediately before that keyword (ISO 32000-2, 7.3.8.1: the EOL before `endstream` is
 *    not part of the data). Parsing then resumes after that `endstream` when `endobj` follows it,
 *    else at the next `endobj`, because what lies between is the rest of data that held the
 *    keyword.
 * 3. When neither keyword follows, there is no frame.
 *
 * Recovery cuts at the first `endstream` even when it sits inside binary data. The two keyword
 * lists are collected in one pass over the input and searched by bisection, so framing a file
 * costs time linear in its length plus a logarithmic step per recovered stream.
 *
 * Framing allocates nothing but the keyword lists: the data of a frame is a view that the caller
 * takes with `subarray`.
 */

/** Where one stream's data lies. */
export interface StreamFrame {
  /** Offset of the first data byte. */
  readonly start: number;
  /** Offset after the last data byte. */
  readonly end: number;
  /** Offset at which parsing continues: after `endstream`, or at `endobj` when that ended the data. */
  readonly resumeAt: number;
  /** True when the declared length was not used and the end was searched for. */
  readonly recovered: boolean;
}

const E = 0x65;
const ENDSTREAM = Uint8Array.from('endstream', (c) => c.charCodeAt(0));
const ENDOBJ = Uint8Array.from('endobj', (c) => c.charCodeAt(0));

/** Bytes of white space and comments skipped for free between the declared data and `endstream`. */
const MAX_TRAILING_WHITESPACE = 4096;

/** PDF white space (ISO 32000-2, 7.2.3, Table 1): NUL, HT, LF, FF, CR, SP. */
function isWhite(b: number): boolean {
  return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09 || b === 0x0c || b === 0x00;
}

/** PDF delimiters (ISO 32000-2, 7.2.3, Table 2). */
function isDelimiter(b: number): boolean {
  return (
    b === 0x28 ||
    b === 0x29 ||
    b === 0x3c ||
    b === 0x3e ||
    b === 0x5b ||
    b === 0x5d ||
    b === 0x7b ||
    b === 0x7d ||
    b === 0x2f ||
    b === 0x25
  );
}

/** True when `word` starts at `at` and the next byte ends a token (white space, a delimiter or the end). */
function keywordAt(bytes: Uint8Array, at: number, word: Uint8Array): boolean {
  const end = at + word.length;
  if (end > bytes.length) return false;
  for (let i = 0; i < word.length; i++) {
    if (bytes[at + i] !== word[i]) return false;
  }
  if (end === bytes.length) return true;
  const next = bytes[end] ?? -1;
  return isWhite(next) || isDelimiter(next);
}

/** First index in the ascending `offsets` that is `>= from`, or -1. */
function lowerBound(offsets: readonly number[], from: number): number {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((offsets[mid] ?? 0) < from) lo = mid + 1;
    else hi = mid;
  }
  return lo < offsets.length ? (offsets[lo] ?? -1) : -1;
}

/**
 * The offsets of every `endstream` and `endobj` keyword of one input, collected on first use.
 *
 * The input must not change while the index is in use.
 */
export class KeywordIndex {
  private endstreams: number[] = [];
  private endobjs: number[] = [];
  /** How many times the index has scanned its input; at most 1. */
  builds = 0;
  /**
   * Bytes of white space and comments that trusted framing may still skip beyond the free part of
   * each gap. It is set from the input's length when the index is made and does not depend on
   * the scan.
   */
  trailingSkipBudget: number;
  /** The end of each gap that trusted framing has paid for, by the offset where it starts. */
  readonly gapEnds: Map<number, number> = new Map();

  constructor(private readonly bytes: Uint8Array) {
    this.trailingSkipBudget = bytes.length;
  }

  private build(): void {
    if (this.builds > 0) return;
    this.builds = 1;
    const bytes = this.bytes;
    const streams = this.endstreams;
    const objs = this.endobjs;
    let i = bytes.indexOf(E);
    while (i !== -1) {
      if (bytes[i + 1] === 0x6e && bytes[i + 2] === 0x64) {
        const kind = bytes[i + 3];
        if (kind === 0x73 && keywordAt(bytes, i, ENDSTREAM)) {
          streams.push(i);
          i += ENDSTREAM.length - 1;
        } else if (kind === 0x6f && keywordAt(bytes, i, ENDOBJ)) {
          objs.push(i);
          i += ENDOBJ.length - 1;
        }
      }
      i = bytes.indexOf(E, i + 1);
    }
  }

  /** Offset of the first `endstream` at or after `from`, or -1. */
  nextEndstream(from: number): number {
    this.build();
    return lowerBound(this.endstreams, from);
  }

  /** Offset of the first `endobj` at or after `from`, or -1. */
  nextEndobj(from: number): number {
    this.build();
    return lowerBound(this.endobjs, from);
  }
}

const sharedIndexes = new WeakMap<Uint8Array, KeywordIndex>();

/**
 * The index for `bytes`, shared by every caller that frames streams of the same buffer. The buffer
 * must not change while it is in use, as for the lexer.
 */
export function keywordIndexFor(bytes: Uint8Array): KeywordIndex {
  let index = sharedIndexes.get(bytes);
  if (index === undefined) {
    index = new KeywordIndex(bytes);
    sharedIndexes.set(bytes, index);
  }
  return index;
}

/** `end` moved before one EOL marker (CRLF, LF or CR) that ends `[start, end)`; `end` when none does. */
function trimOneEol(bytes: Uint8Array, start: number, end: number): number {
  if (end > start && bytes[end - 1] === 0x0a) {
    return end - 1 > start && bytes[end - 2] === 0x0d ? end - 2 : end - 1;
  }
  if (end > start && bytes[end - 1] === 0x0d) return end - 1;
  return end;
}

/**
 * The offset of the first byte at or after `from` that is neither white space nor part of a
 * comment (a `%` runs to the next CR or LF), the way the lexer skips it; -1 when the gap is
 * longer than the free part plus what is left of the index's allowance.
 */
function skipGap(bytes: Uint8Array, from: number, index: KeywordIndex): number {
  const known = index.gapEnds.get(from);
  if (known !== undefined) return known;
  let at = from;
  let free = MAX_TRAILING_WHITESPACE;
  let inComment = false;
  while (at < bytes.length) {
    const b = bytes[at] ?? -1;
    if (inComment) {
      if (b === 0x0a || b === 0x0d) inComment = false;
    } else if (b === 0x25) {
      inComment = true;
    } else if (!isWhite(b)) {
      break;
    }
    if (free > 0) free--;
    else if (index.trailingSkipBudget > 0) index.trailingSkipBudget--;
    else return -1;
    at++;
  }
  index.gapEnds.set(from, at);
  return at;
}

/**
 * Finds where the data of a stream ends.
 *
 * @param bytes      The whole input.
 * @param dataStart  Offset of the first data byte, after the EOL that follows `stream`.
 * @param declared   The declared length when it is a safe integer `>= 0`, else `undefined`.
 * @param index      The keyword index of `bytes`: searched when the declared length fails, and the
 *                   holder of the allowance that trusted framing pays long gaps from.
 * @returns          The frame, or `undefined` when no declared length fits and neither `endstream`
 *                   nor `endobj` follows `dataStart`.
 */
export function frameStreamData(
  bytes: Uint8Array,
  dataStart: number,
  declared: number | undefined,
  index: KeywordIndex,
): StreamFrame | undefined {
  if (declared !== undefined && Number.isSafeInteger(declared) && declared >= 0) {
    const dataEnd = dataStart + declared;
    if (dataEnd <= bytes.length) {
      const at = skipGap(bytes, dataEnd, index);
      if (at !== -1 && keywordAt(bytes, at, ENDSTREAM)) {
        return {
          start: dataStart,
          end: dataEnd,
          resumeAt: at + ENDSTREAM.length,
          recovered: false,
        };
      }
    }
  }

  const endstream = index.nextEndstream(dataStart);
  const endobj = index.nextEndobj(dataStart);
  if (endstream === -1 && endobj === -1) return undefined;
  if (endstream !== -1 && (endobj === -1 || endstream < endobj)) {
    let resumeAt = endstream + ENDSTREAM.length;
    const nextObj = index.nextEndobj(resumeAt);
    if (nextObj !== -1) {
      let at = resumeAt;
      while (at < nextObj && isWhite(bytes[at] ?? -1)) at++;
      if (at < nextObj) resumeAt = nextObj;
    }
    return {
      start: dataStart,
      end: trimOneEol(bytes, dataStart, endstream),
      resumeAt,
      recovered: true,
    };
  }
  return {
    start: dataStart,
    end: trimOneEol(bytes, dataStart, endobj),
    resumeAt: endobj,
    recovered: true,
  };
}
