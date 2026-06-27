/**
 * @module text/bidi
 *
 * The Unicode Bidirectional Algorithm (UAX #9) for laying out mixed
 * left-to-right / right-to-left text.
 *
 * Reference: Unicode Standard Annex #9, "Unicode Bidirectional Algorithm",
 * revision 49 (Unicode 16.0.0). The rule labels referenced throughout this
 * file (P2/P3, X1–X10, W1–W7, N0–N2, I1/I2, L1/L2) are the rule numbers from
 * that document: https://www.unicode.org/reports/tr9/
 *
 * ## Scope and conformance
 *
 * This implements the full structural pipeline of UAX #9:
 *  - P2/P3   paragraph base level (or an explicit / first-strong base),
 *  - X1–X8   explicit embeddings & overrides (LRE/RLE/LRO/RLO/PDF),
 *  - X5a–X6a directional isolates (LRI/RLI/FSI/PDI),
 *  - X9/X10  removal of formatting characters and isolating run sequences,
 *  - W1–W7   weak-type resolution,
 *  - N0      paired brackets, N1/N2 neutral resolution,
 *  - I1/I2   implicit level resolution,
 *  - L1      reset of trailing/segment whitespace to the paragraph level,
 *  - L2      reordering of the resolved levels into visual order.
 *
 * The one deliberate simplification is the **Bidi_Class lookup table**: rather
 * than embedding the entire ~150 KB Unicode Character Database, this module
 * uses a COMPACT, RANGE-BASED classifier (see {@link bidiClass}) covering the
 * code points that matter in practice for PDF text layout — Latin, Hebrew
 * (U+0590–05FF), Arabic (U+0600–06FF, U+0750–077F), the Arabic-Indic and
 * European digit groups, common neutrals/weaks, and every explicit-format and
 * isolate-format character. Code points outside the covered ranges default to
 * the rule-conformant fallbacks Unicode assigns to unassigned blocks (`R`/`AL`
 * for the Hebrew/Arabic/Thaana/Syriac default-RTL ranges, otherwise `L`). The
 * paired-bracket data for N0 likewise covers the ASCII and common typographic
 * bracket pairs rather than the full BidiBrackets.txt file.
 *
 * Because the class table is a curated subset (not the full UCD), this module
 * does NOT claim blanket UBA conformance for arbitrary Unicode input; it is
 * correct for the covered scripts and degrades to the standard default classes
 * elsewhere. The algorithm itself is the complete UAX #9 procedure.
 *
 * Pure logic — no Buffer, no fs, no require(); ESM only.
 */

/** Requested or resolved base direction for a paragraph. */
export type BidiDirection = 'ltr' | 'rtl' | 'auto';

/**
 * A maximal contiguous slice of the input that shares a single resolved
 * embedding level (and therefore a single visual direction).
 */
export interface BidiRun {
  /** The logical-order substring covered by this run. */
  text: string;
  /** Resolved embedding level (even = LTR, odd = RTL). */
  level: number;
  /** Visual direction implied by the level's parity. */
  direction: 'ltr' | 'rtl';
  /** UTF-16 index into the original string where this run starts. */
  start: number;
  /** Length of this run in UTF-16 code units. */
  length: number;
}

/** Result of {@link resolveBidi}. */
export interface BidiResult {
  /** Same-level runs in logical order, partitioning the whole string. */
  runs: BidiRun[];
  /** Resolved embedding level for every UTF-16 code unit of the input. */
  levels: number[];
  /**
   * Visual order: `visualOrder[v]` is the logical index of the code unit that
   * should be painted at visual position `v` (left to right).
   */
  visualOrder: number[];
  /** Resolved paragraph embedding level (0 = LTR, 1 = RTL). */
  baseLevel: number;
}

// ---------------------------------------------------------------------------
// Bidi_Class enumeration (subset used by the algorithm)
//
// Names follow UAX #9 §2.1, Table 4 "Bidirectional Character Types".
// ---------------------------------------------------------------------------

/** The bidirectional character types used by this implementation. */
type BC =
  // Strong
  | 'L'
  | 'R'
  | 'AL'
  // Weak
  | 'EN'
  | 'ES'
  | 'ET'
  | 'AN'
  | 'CS'
  | 'NSM'
  | 'BN'
  // Neutral
  | 'B'
  | 'S'
  | 'WS'
  | 'ON'
  // Explicit formatting
  | 'LRE'
  | 'LRO'
  | 'RLE'
  | 'RLO'
  | 'PDF'
  | 'LRI'
  | 'RLI'
  | 'FSI'
  | 'PDI';

/** UAX #9 §3.3.2: the maximum explicit embedding depth. */
const MAX_DEPTH = 125;

// ---------------------------------------------------------------------------
// Bidi_Class lookup (compact, range-based; Unicode 16.0 DerivedBidiClass)
// ---------------------------------------------------------------------------

/**
 * Classify a Unicode scalar value into its {@link BC} Bidi_Class.
 *
 * Range-based subset of DerivedBidiClass.txt (Unicode 16.0.0). Covers Latin,
 * Hebrew, Arabic, the digit groups, neutrals/weaks and all explicit-format and
 * isolate characters. Anything outside the listed ranges falls back to the
 * Unicode default class for that area (`R`/`AL` in the default-RTL blocks,
 * else `L`).
 *
 * @param cp Unicode scalar value (code point).
 * @returns The character's Bidi_Class.
 */
function bidiClass(cp: number): BC {
  // --- Explicit formatting & isolates (UAX #9 §2.1) ---------------------
  switch (cp) {
    case 0x202a:
      return 'LRE';
    case 0x202b:
      return 'RLE';
    case 0x202d:
      return 'LRO';
    case 0x202e:
      return 'RLO';
    case 0x202c:
      return 'PDF';
    case 0x2066:
      return 'LRI';
    case 0x2067:
      return 'RLI';
    case 0x2068:
      return 'FSI';
    case 0x2069:
      return 'PDI';
    default:
      break;
  }

  // --- ASCII fast path ---------------------------------------------------
  if (cp < 0x80) {
    if (cp === 0x0a || cp === 0x0d || cp === 0x1c || cp === 0x1d || cp === 0x1e || cp === 0x85)
      return 'B'; // paragraph separators (NEL handled below for >0x7f)
    if (cp === 0x09 || cp === 0x0b || cp === 0x1f) return 'S'; // segment separators
    if (cp === 0x0c || cp === 0x20) return 'WS'; // FF, SPACE
    if (cp >= 0x30 && cp <= 0x39) return 'EN'; // 0-9
    if (cp === 0x2b || cp === 0x2d) return 'ES'; // + -
    if (cp === 0x23 || cp === 0x24 || cp === 0x25) return 'ET'; // # $ %
    if (cp === 0x2c || cp === 0x2e || cp === 0x2f || cp === 0x3a) return 'CS'; // , . / :
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return 'L'; // A-Z a-z
    // Everything else in ASCII (brackets, punctuation, symbols) is ON.
    return 'ON';
  }

  // --- Latin-1 supplement and common controls --------------------------
  if (cp === 0x85) return 'B'; // NEL
  if (cp === 0xa0) return 'CS'; // NO-BREAK SPACE
  if (cp === 0xa3 || cp === 0xa4 || cp === 0xa5 || cp === 0xb0 || cp === 0xb1) return 'ET';
  if (cp === 0xab || cp === 0xbb) return 'ON'; // guillemets

  // --- Hebrew block U+0590–05FF (default R) ----------------------------
  if (cp >= 0x0591 && cp <= 0x05bd) return 'NSM'; // Hebrew points (combining)
  if (cp === 0x05bf || cp === 0x05c1 || cp === 0x05c2 || cp === 0x05c4 || cp === 0x05c5 || cp === 0x05c7)
    return 'NSM';
  if (cp >= 0x0590 && cp <= 0x05ff) return 'R'; // Hebrew letters & default-R

  // --- Arabic block U+0600–06FF ----------------------------------------
  if (cp >= 0x0600 && cp <= 0x0605) return 'AN'; // Arabic number sign etc.
  if (cp >= 0x0660 && cp <= 0x0669) return 'AN'; // Arabic-Indic digits
  if (cp === 0x066b || cp === 0x066c) return 'AN'; // decimal/thousands separator
  if (cp === 0x066a) return 'ET'; // Arabic percent
  if (cp >= 0x06f0 && cp <= 0x06f9) return 'EN'; // Extended Arabic-Indic digits (EN)
  if (cp >= 0x0610 && cp <= 0x061a) return 'NSM'; // Arabic combining marks
  if (cp >= 0x064b && cp <= 0x065f) return 'NSM'; // Arabic diacritics
  if (cp === 0x0670) return 'NSM'; // superscript alef
  if (cp >= 0x06d6 && cp <= 0x06dc) return 'NSM';
  if (cp >= 0x06df && cp <= 0x06e4) return 'NSM';
  if (cp === 0x06e7 || cp === 0x06e8) return 'NSM';
  if (cp >= 0x06ea && cp <= 0x06ed) return 'NSM';
  if (cp >= 0x0600 && cp <= 0x06ff) return 'AL'; // Arabic letters (default AL)

  // --- Syriac U+0700–074F & Arabic Supplement U+0750–077F (default AL) --
  if (cp >= 0x0700 && cp <= 0x074f) return 'AL';
  if (cp >= 0x0750 && cp <= 0x077f) return 'AL';

  // --- Thaana U+0780–07BF (default AL) ---------------------------------
  if (cp >= 0x0780 && cp <= 0x07bf) return 'AL';

  // --- General whitespace / separators above ASCII ---------------------
  if (cp === 0x2028) return 'WS'; // LINE SEPARATOR
  if (cp === 0x2029) return 'B'; // PARAGRAPH SEPARATOR
  if (cp >= 0x2000 && cp <= 0x200a) return 'WS'; // en/em spaces
  if (cp === 0x200b) return 'BN'; // ZERO WIDTH SPACE
  if (cp === 0x200e) return 'L'; // LRM
  if (cp === 0x200f) return 'R'; // RLM
  if (cp === 0x061c) return 'AL'; // ALM (Arabic Letter Mark) → treated as AL
  if (cp === 0x202f) return 'CS'; // NARROW NO-BREAK SPACE
  if (cp === 0x205f) return 'WS'; // MEDIUM MATHEMATICAL SPACE
  if (cp === 0x3000) return 'WS'; // IDEOGRAPHIC SPACE
  if (cp === 0xfeff) return 'BN'; // ZERO WIDTH NO-BREAK SPACE / BOM

  // --- Combining marks (general) ---------------------------------------
  if (cp >= 0x0300 && cp <= 0x036f) return 'NSM'; // Combining Diacritical Marks
  if (cp >= 0x20d0 && cp <= 0x20ff) return 'NSM'; // Combining Marks for Symbols

  // --- Default: Unicode assigns L to most other blocks -----------------
  return 'L';
}

/**
 * Map of opening bracket → closing bracket and vice versa for UAX #9 N0
 * (paired brackets). Subset of BidiBrackets.txt (Unicode 16.0.0) covering the
 * ASCII and common CJK/typographic pairs. Canonical-equivalent singletons
 * (U+2329/U+232A) are folded onto their canonical forms per BD16.
 */
const BRACKET_PAIRS: ReadonlyMap<number, { other: number; open: boolean }> = new Map([
  [0x0028, { other: 0x0029, open: true }], // ( )
  [0x0029, { other: 0x0028, open: false }],
  [0x005b, { other: 0x005d, open: true }], // [ ]
  [0x005d, { other: 0x005b, open: false }],
  [0x007b, { other: 0x007d, open: true }], // { }
  [0x007d, { other: 0x007b, open: false }],
  [0x0f3a, { other: 0x0f3b, open: true }],
  [0x0f3b, { other: 0x0f3a, open: false }],
  [0x0f3c, { other: 0x0f3d, open: true }],
  [0x0f3d, { other: 0x0f3c, open: false }],
  [0x169b, { other: 0x169c, open: true }],
  [0x169c, { other: 0x169b, open: false }],
  [0x2045, { other: 0x2046, open: true }],
  [0x2046, { other: 0x2045, open: false }],
  [0x207d, { other: 0x207e, open: true }],
  [0x207e, { other: 0x207d, open: false }],
  [0x208d, { other: 0x208e, open: true }],
  [0x208e, { other: 0x208d, open: false }],
  [0x2329, { other: 0x232a, open: true }],
  [0x232a, { other: 0x2329, open: false }],
  [0x2768, { other: 0x2769, open: true }],
  [0x2769, { other: 0x2768, open: false }],
  [0x276a, { other: 0x276b, open: true }],
  [0x276b, { other: 0x276a, open: false }],
  [0x276c, { other: 0x276d, open: true }],
  [0x276d, { other: 0x276c, open: false }],
  [0x276e, { other: 0x276f, open: true }],
  [0x276f, { other: 0x276e, open: false }],
  [0x2770, { other: 0x2771, open: true }],
  [0x2771, { other: 0x2770, open: false }],
  [0x2772, { other: 0x2773, open: true }],
  [0x2773, { other: 0x2772, open: false }],
  [0x2774, { other: 0x2775, open: true }],
  [0x2775, { other: 0x2774, open: false }],
  [0x27e6, { other: 0x27e7, open: true }],
  [0x27e7, { other: 0x27e6, open: false }],
  [0x27e8, { other: 0x27e9, open: true }],
  [0x27e9, { other: 0x27e8, open: false }],
  [0x27ea, { other: 0x27eb, open: true }],
  [0x27eb, { other: 0x27ea, open: false }],
  [0x27ec, { other: 0x27ed, open: true }],
  [0x27ed, { other: 0x27ec, open: false }],
  [0x27ee, { other: 0x27ef, open: true }],
  [0x27ef, { other: 0x27ee, open: false }],
  [0x2983, { other: 0x2984, open: true }],
  [0x2984, { other: 0x2983, open: false }],
  [0x3008, { other: 0x3009, open: true }],
  [0x3009, { other: 0x3008, open: false }],
  [0x300a, { other: 0x300b, open: true }],
  [0x300b, { other: 0x300a, open: false }],
  [0x300c, { other: 0x300d, open: true }],
  [0x300d, { other: 0x300c, open: false }],
  [0x300e, { other: 0x300f, open: true }],
  [0x300f, { other: 0x300e, open: false }],
  [0x3010, { other: 0x3011, open: true }],
  [0x3011, { other: 0x3010, open: false }],
  [0x3014, { other: 0x3015, open: true }],
  [0x3015, { other: 0x3014, open: false }],
  [0x3016, { other: 0x3017, open: true }],
  [0x3017, { other: 0x3016, open: false }],
  [0x3018, { other: 0x3019, open: true }],
  [0x3019, { other: 0x3018, open: false }],
  [0x301a, { other: 0x301b, open: true }],
  [0x301b, { other: 0x301a, open: false }],
]);

/** BD16 canonical-equivalence folding for bracket matching. */
function canonicalBracket(cp: number): number {
  if (cp === 0x3008) return 0x2329;
  if (cp === 0x3009) return 0x232a;
  return cp;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if `bc` is a removed-by-X9 explicit/BN type. */
function isRemovedByX9(bc: BC): boolean {
  return (
    bc === 'RLE' ||
    bc === 'LRE' ||
    bc === 'RLO' ||
    bc === 'LRO' ||
    bc === 'PDF' ||
    bc === 'BN'
  );
}

/** Strong direction (0 = L, 1 = R) implied by an embedding level's parity. */
function dirFromLevel(level: number): 'L' | 'R' {
  return level % 2 === 0 ? 'L' : 'R';
}

// ---------------------------------------------------------------------------
// P2/P3 — paragraph base level
// ---------------------------------------------------------------------------

/**
 * Compute the first-strong base level over `types`, skipping the contents of
 * isolate initiators (LRI/RLI/FSI ... matching PDI) per UAX #9 P2/P3, X5c.
 * Returns 0 (LTR) when no strong character is found.
 */
function computeBaseLevel(types: readonly BC[]): number {
  let isolateDepth = 0;
  for (const t of types) {
    if (t === 'LRI' || t === 'RLI' || t === 'FSI') {
      isolateDepth++;
    } else if (t === 'PDI') {
      if (isolateDepth > 0) isolateDepth--;
    } else if (isolateDepth === 0) {
      if (t === 'L') return 0;
      if (t === 'R' || t === 'AL') return 1;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// X1–X8, X5a–X6a — explicit levels & directions
// ---------------------------------------------------------------------------

interface StatusEntry {
  level: number;
  override: 'neutral' | 'L' | 'R';
  isolate: boolean;
}

/**
 * Resolve explicit embedding levels and per-character override directions
 * (UAX #9 X1–X8 plus the isolate rules X5a/X5b/X5c/X6a). Mutates `levels` and
 * returns an array of resolved working types (with overrides applied and X9
 * removals tagged as BN).
 */
function resolveExplicit(types: BC[], baseLevel: number, levels: number[]): BC[] {
  const result: BC[] = types.slice();
  const stack: StatusEntry[] = [{ level: baseLevel, override: 'neutral', isolate: false }];
  let overflowIsolate = 0;
  let overflowEmbedding = 0;
  let validIsolate = 0;

  const n = types.length;

  // Precompute, for each isolate initiator, the matching PDI index (X10/BD9)
  // — needed so FSI can choose its direction from its first strong char.
  const matchingPDI = computeMatchingPDI(types);

  for (let i = 0; i < n; i++) {
    const t = types[i]!;
    const top = stack[stack.length - 1]!;

    switch (t) {
      case 'RLE':
      case 'LRE':
      case 'RLO':
      case 'LRO': {
        // X2–X5: explicit embeddings & overrides.
        levels[i] = top.level; // formatting char keeps current level
        result[i] = 'BN';
        const isRTL = t === 'RLE' || t === 'RLO';
        const newLevel = isRTL ? nextOddLevel(top.level) : nextEvenLevel(top.level);
        if (newLevel <= MAX_DEPTH && overflowIsolate === 0 && overflowEmbedding === 0) {
          stack.push({
            level: newLevel,
            override: t === 'RLO' ? 'R' : t === 'LRO' ? 'L' : 'neutral',
            isolate: false,
          });
        } else if (overflowIsolate === 0) {
          overflowEmbedding++;
        }
        break;
      }
      case 'RLI':
      case 'LRI':
      case 'FSI': {
        // X5a/X5b/X5c: directional isolates.
        levels[i] = top.level;
        if (top.override !== 'neutral') result[i] = top.override;
        let isRTL = t === 'RLI';
        if (t === 'FSI') {
          // X5c: direction from the first strong char inside the isolate.
          const pdi = matchingPDI[i]!;
          isRTL = computeBaseLevel(types.slice(i + 1, pdi)) === 1;
        }
        const newLevel = isRTL ? nextOddLevel(top.level) : nextEvenLevel(top.level);
        if (newLevel <= MAX_DEPTH && overflowIsolate === 0 && overflowEmbedding === 0) {
          validIsolate++;
          stack.push({ level: newLevel, override: 'neutral', isolate: true });
        } else {
          overflowIsolate++;
        }
        break;
      }
      case 'PDI': {
        // X6a: pop to the last isolate.
        if (overflowIsolate > 0) {
          overflowIsolate--;
        } else if (validIsolate > 0) {
          overflowEmbedding = 0;
          while (!stack[stack.length - 1]!.isolate) stack.pop();
          stack.pop();
          validIsolate--;
        }
        const after = stack[stack.length - 1]!;
        levels[i] = after.level;
        if (after.override !== 'neutral') result[i] = after.override;
        break;
      }
      case 'PDF': {
        // X7: terminate the last embedding/override.
        levels[i] = top.level;
        result[i] = 'BN';
        if (overflowIsolate > 0) {
          // no-op
        } else if (overflowEmbedding > 0) {
          overflowEmbedding--;
        } else if (!top.isolate && stack.length >= 2) {
          stack.pop();
        }
        break;
      }
      case 'B': {
        // X8: paragraph separator resets to the base level.
        stack.length = 1;
        stack[0] = { level: baseLevel, override: 'neutral', isolate: false };
        overflowIsolate = 0;
        overflowEmbedding = 0;
        validIsolate = 0;
        levels[i] = baseLevel;
        break;
      }
      case 'BN': {
        // X6 explicitly excludes BN; keep its level at the current embedding.
        levels[i] = top.level;
        break;
      }
      default: {
        // X6: any other character.
        levels[i] = top.level;
        if (top.override !== 'neutral') result[i] = top.override;
        break;
      }
    }
  }

  return result;
}

/** Next odd level strictly greater than `level` (for RTL embeddings). */
function nextOddLevel(level: number): number {
  return level % 2 === 0 ? level + 1 : level + 2;
}

/** Next even level strictly greater than `level` (for LTR embeddings). */
function nextEvenLevel(level: number): number {
  return level % 2 === 0 ? level + 2 : level + 1;
}

/**
 * BD9: for each isolate initiator, find the index of its matching PDI (or `n`
 * if unmatched). Non-initiator positions map to `-1`.
 */
function computeMatchingPDI(types: readonly BC[]): number[] {
  const n = types.length;
  const out = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const t = types[i]!;
    if (t === 'LRI' || t === 'RLI' || t === 'FSI') {
      let depth = 1;
      let j = i + 1;
      for (; j < n; j++) {
        const tj = types[j]!;
        if (tj === 'LRI' || tj === 'RLI' || tj === 'FSI') depth++;
        else if (tj === 'PDI') {
          depth--;
          if (depth === 0) break;
        }
      }
      out[i] = j; // j === n when unmatched
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// X10 — isolating run sequences
// ---------------------------------------------------------------------------

/** An isolating run sequence: ordered character indices plus its boundary sos/eos. */
interface IsolatingRunSequence {
  indices: number[];
  sos: 'L' | 'R';
  eos: 'L' | 'R';
}

/**
 * Build the isolating run sequences (UAX #9 X10 / BD13) from the resolved
 * levels, skipping characters removed by X9. Computes each sequence's sos/eos
 * boundary directions from the higher of the adjacent levels (rule X10).
 */
function buildIsolatingRunSequences(
  types: readonly BC[],
  levels: readonly number[],
  baseLevel: number,
): IsolatingRunSequence[] {
  const n = types.length;
  // Indices retained after X9 (BN and explicit formatting removed).
  const retained: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isRemovedByX9(types[i]!)) retained.push(i);
  }

  // Level runs: maximal runs of retained indices with the same level (BD7).
  const levelRuns: number[][] = [];
  let cur: number[] = [];
  let curLevel = -1;
  for (const i of retained) {
    if (levels[i] !== curLevel) {
      if (cur.length > 0) levelRuns.push(cur);
      cur = [];
      curLevel = levels[i]!;
    }
    cur.push(i);
  }
  if (cur.length > 0) levelRuns.push(cur);

  // Map a level-run's first/last index to its run for isolate linking.
  const runByStart = new Map<number, number>();
  for (let r = 0; r < levelRuns.length; r++) {
    runByStart.set(levelRuns[r]![0]!, r);
  }

  const matchingPDI = computeMatchingPDI(types);
  // For each PDI, the index of its matching isolate initiator (BD9 inverse).
  const matchingInitiator = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const t = types[i]!;
    if ((t === 'LRI' || t === 'RLI' || t === 'FSI') && matchingPDI[i]! < n) {
      matchingInitiator[matchingPDI[i]!] = i;
    }
  }

  const used = new Array<boolean>(levelRuns.length).fill(false);
  const sequences: IsolatingRunSequence[] = [];

  for (let r = 0; r < levelRuns.length; r++) {
    if (used[r]) continue;
    const first = levelRuns[r]![0]!;
    // A sequence starts at a run whose first char is not a PDI that matches an
    // isolate initiator (BD13).
    if (types[first] === 'PDI' && matchingInitiator[first]! >= 0) continue;

    const seqIndices: number[] = [];
    let runIdx = r;
    for (;;) {
      used[runIdx] = true;
      const run = levelRuns[runIdx]!;
      for (const idx of run) seqIndices.push(idx);
      const last = run[run.length - 1]!;
      // If the run ends with an isolate initiator that has a matching PDI,
      // continue the sequence at the level run beginning with that PDI.
      const t = types[last]!;
      if ((t === 'LRI' || t === 'RLI' || t === 'FSI') && matchingPDI[last]! < n) {
        const next = runByStart.get(matchingPDI[last]!);
        if (next === undefined || used[next]) break;
        runIdx = next;
      } else {
        break;
      }
    }

    // sos/eos (X10): compare the sequence's level with the level of the
    // adjacent retained character (or the paragraph level at the boundaries).
    const seqLevel = levels[seqIndices[0]!]!;
    const startPos = retained.indexOf(seqIndices[0]!);
    const endPos = retained.indexOf(seqIndices[seqIndices.length - 1]!);
    const prevLevel = startPos > 0 ? levels[retained[startPos - 1]!]! : baseLevel;
    const lastType = types[seqIndices[seqIndices.length - 1]!]!;
    // If the sequence ends with an unmatched isolate initiator, eos uses the
    // paragraph level (X10); otherwise the following retained char's level.
    const endsWithUnmatchedIsolate =
      (lastType === 'LRI' || lastType === 'RLI' || lastType === 'FSI') &&
      matchingPDI[seqIndices[seqIndices.length - 1]!]! >= n;
    const nextLevel =
      endsWithUnmatchedIsolate || endPos === retained.length - 1
        ? baseLevel
        : levels[retained[endPos + 1]!]!;

    sequences.push({
      indices: seqIndices,
      sos: dirFromLevel(Math.max(seqLevel, prevLevel)),
      eos: dirFromLevel(Math.max(seqLevel, nextLevel)),
    });
  }

  return sequences;
}

// ---------------------------------------------------------------------------
// W1–W7 — weak types
// ---------------------------------------------------------------------------

/** Apply the weak-type rules W1–W7 to one isolating run sequence in place. */
function resolveWeak(seq: IsolatingRunSequence, types: BC[]): void {
  const idx = seq.indices;
  const m = idx.length;

  // W1: NSM → type of previous char (sos at the start). Removed chars are
  // already excluded from the sequence.
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] === 'NSM') {
      if (k === 0) {
        types[i] = seq.sos;
      } else {
        const prev = types[idx[k - 1]!]!;
        types[i] = prev === 'LRI' || prev === 'RLI' || prev === 'FSI' || prev === 'PDI' ? 'ON' : prev;
      }
    }
  }

  // W2: EN → AN if the previous strong type is AL.
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] === 'EN') {
      let strong: BC = seq.sos;
      for (let j = k - 1; j >= 0; j--) {
        const tj = types[idx[j]!]!;
        if (tj === 'R' || tj === 'L' || tj === 'AL') {
          strong = tj;
          break;
        }
      }
      if (strong === 'AL') types[i] = 'AN';
    }
  }

  // W3: AL → R.
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] === 'AL') types[i] = 'R';
  }

  // W4: a single ES between two ENs → EN; a single CS between two numbers of
  // the same type → that type.
  for (let k = 1; k < m - 1; k++) {
    const i = idx[k]!;
    const prev = types[idx[k - 1]!]!;
    const next = types[idx[k + 1]!]!;
    if (types[i] === 'ES' && prev === 'EN' && next === 'EN') types[i] = 'EN';
    else if (types[i] === 'CS' && prev === next && (prev === 'EN' || prev === 'AN'))
      types[i] = prev;
  }

  // W5: a sequence of ET adjacent to EN → EN.
  for (let k = 0; k < m; k++) {
    if (types[idx[k]!] !== 'ET') continue;
    // Find the run of ET.
    let end = k;
    while (end < m && types[idx[end]!] === 'ET') end++;
    const before = k > 0 ? types[idx[k - 1]!]! : seq.sos;
    const after = end < m ? types[idx[end]!]! : seq.eos;
    if (before === 'EN' || after === 'EN') {
      for (let j = k; j < end; j++) types[idx[j]!] = 'EN';
    }
    k = end - 1;
  }

  // W6: any remaining ES/ET/CS → ON.
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] === 'ES' || types[i] === 'ET' || types[i] === 'CS') types[i] = 'ON';
  }

  // W7: EN → L if the previous strong type is L.
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] === 'EN') {
      let strong: BC = seq.sos;
      for (let j = k - 1; j >= 0; j--) {
        const tj = types[idx[j]!]!;
        if (tj === 'R' || tj === 'L') {
          strong = tj;
          break;
        }
      }
      if (strong === 'L') types[i] = 'L';
    }
  }
}

// ---------------------------------------------------------------------------
// N0–N2 — neutral types
// ---------------------------------------------------------------------------

/** True if a working type counts as a "neutral or isolate formatting" char (NI). */
function isNI(t: BC): boolean {
  return t === 'B' || t === 'S' || t === 'WS' || t === 'ON' || t === 'FSI' || t === 'LRI' || t === 'RLI' || t === 'PDI';
}

/** Apply N0 (paired brackets) then N1/N2 to one isolating run sequence. */
function resolveNeutral(
  seq: IsolatingRunSequence,
  types: BC[],
  levels: readonly number[],
  codepoints: readonly number[],
): void {
  const idx = seq.indices;
  const m = idx.length;
  const e: 'L' | 'R' = dirFromLevel(levels[idx[0]!]!);

  // --- N0: paired brackets (BD16) --------------------------------------
  resolveBrackets(seq, types, codepoints, e);

  // --- N1/N2: remaining neutrals ---------------------------------------
  let k = 0;
  while (k < m) {
    if (!isNI(types[idx[k]!]!)) {
      k++;
      continue;
    }
    let end = k;
    while (end < m && isNI(types[idx[end]!]!)) end++;
    // Strong context: treat EN/AN as R (N1).
    const beforeRaw = k > 0 ? types[idx[k - 1]!]! : seq.sos;
    const afterRaw = end < m ? types[idx[end]!]! : seq.eos;
    const before = beforeRaw === 'EN' || beforeRaw === 'AN' ? 'R' : beforeRaw;
    const after = afterRaw === 'EN' || afterRaw === 'AN' ? 'R' : afterRaw;
    const resolved: BC = before === after && (before === 'L' || before === 'R') ? before : e;
    for (let j = k; j < end; j++) types[idx[j]!] = resolved;
    k = end;
  }
}

interface BracketStackEntry {
  bracket: number; // canonical opening bracket code point
  seqPos: number; // position within seq.indices
}

/** N0 paired-bracket resolution (UAX #9 N0 with BD16 pairing). */
function resolveBrackets(
  seq: IsolatingRunSequence,
  types: BC[],
  codepoints: readonly number[],
  e: 'L' | 'R',
): void {
  const idx = seq.indices;
  const m = idx.length;
  const stack: BracketStackEntry[] = [];
  const pairs: Array<{ open: number; close: number }> = [];

  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (types[i] !== 'ON') continue;
    const cp = canonicalBracket(codepoints[i]!);
    const info = BRACKET_PAIRS.get(codepoints[i]!);
    if (!info) continue;
    if (info.open) {
      if (stack.length >= 63) break; // BD16 stack depth limit
      stack.push({ bracket: canonicalBracket(info.other), seqPos: k });
    } else {
      // Closing bracket: search the stack for a matching opener.
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.bracket === cp) {
          pairs.push({ open: stack[s]!.seqPos, close: k });
          stack.length = s; // discard this and everything above
          break;
        }
      }
    }
  }

  pairs.sort((a, b) => a.open - b.open);

  for (const pair of pairs) {
    // Determine the strong type enclosed by the pair.
    let foundE = false;
    let foundOpposite = false;
    const opposite: 'L' | 'R' = e === 'L' ? 'R' : 'L';
    for (let k = pair.open + 1; k < pair.close; k++) {
      const t = strongClass(types[idx[k]!]!);
      if (t === e) {
        foundE = true;
        break;
      }
      if (t === opposite) foundOpposite = true;
    }

    let setDir: 'L' | 'R' | null = null;
    if (foundE) {
      setDir = e; // N0.b
    } else if (foundOpposite) {
      // N0.c: look at the strong context before the opening bracket.
      let context: 'L' | 'R' = seq.sos;
      for (let k = pair.open - 1; k >= 0; k--) {
        const t = strongClass(types[idx[k]!]!);
        if (t === 'L' || t === 'R') {
          context = t;
          break;
        }
      }
      setDir = context === opposite ? opposite : e; // N0.c1 / N0.c2
    }
    // N0.d: leave unchanged when no strong type inside.

    if (setDir) {
      types[idx[pair.open]!] = setDir;
      types[idx[pair.close]!] = setDir;
      // Also fix up NSMs immediately following each bracket (N0 note).
      for (let k = pair.open + 1; k < m; k++) {
        if (originalIsNSM(idx[k]!, codepoints)) types[idx[k]!] = setDir;
        else break;
      }
      for (let k = pair.close + 1; k < m; k++) {
        if (originalIsNSM(idx[k]!, codepoints)) types[idx[k]!] = setDir;
        else break;
      }
    }
  }
}

/** Reduce a working type to the strong direction it counts as for N0 (EN/AN→R). */
function strongClass(t: BC): 'L' | 'R' | null {
  if (t === 'L') return 'L';
  if (t === 'R' || t === 'EN' || t === 'AN') return 'R';
  return null;
}

/** True if the original code point at logical index `i` has Bidi_Class NSM. */
function originalIsNSM(i: number, codepoints: readonly number[]): boolean {
  return bidiClass(codepoints[i]!) === 'NSM';
}

// ---------------------------------------------------------------------------
// I1–I2 — implicit levels
// ---------------------------------------------------------------------------

/** Resolve implicit embedding levels (UAX #9 I1/I2) for one sequence. */
function resolveImplicit(seq: IsolatingRunSequence, types: readonly BC[], levels: number[]): void {
  for (const i of seq.indices) {
    const level = levels[i]!;
    const t = types[i]!;
    if (level % 2 === 0) {
      // I1: even (LTR) level.
      if (t === 'R') levels[i] = level + 1;
      else if (t === 'AN' || t === 'EN') levels[i] = level + 2;
    } else {
      // I2: odd (RTL) level.
      if (t === 'L' || t === 'EN' || t === 'AN') levels[i] = level + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// L1 — reset whitespace/separators at line boundaries
// ---------------------------------------------------------------------------

/**
 * L1: reset to the paragraph level (1) segment/paragraph separators, and
 * (2) any sequence of whitespace / isolate formatting chars preceding a
 * separator or the end of the line. Operates on a single line (= the whole
 * paragraph here, since we do not perform line breaking).
 */
function resetWhitespaceLevels(
  originalTypes: readonly BC[],
  levels: number[],
  baseLevel: number,
): void {
  const n = levels.length;

  // A character is "resettable" for L1 if it is whitespace, an isolate
  // formatting character (FSI/LRI/RLI/PDI), or one of the characters removed
  // by rule X9 (the embedding/override formatting chars + BN). A maximal run of
  // these *preceding* a B/S separator — and the separator itself — is reset to
  // the paragraph level, as is any such run at the very end of the line.
  const resettable = (t: BC): boolean =>
    t === 'WS' || t === 'FSI' || t === 'LRI' || t === 'RLI' || t === 'PDI' || isRemovedByX9(t);

  // Walk left-to-right tracking the start of the current candidate run.
  let runStart = 0;
  for (let i = 0; i < n; i++) {
    const t = originalTypes[i]!;
    if (t === 'B' || t === 'S') {
      // L1 rules 1 & 2: reset the separator and the resettable run preceding it.
      for (let j = runStart; j <= i; j++) levels[j] = baseLevel;
      runStart = i + 1;
    } else if (resettable(t)) {
      // Part of a candidate run; keep it (extend the current run).
    } else {
      // Strong / number / other: ends the candidate run.
      runStart = i + 1;
    }
  }

  // L1 rules 3 & 4: reset any trailing resettable run at the end of the line.
  // `runStart` is the start of the run currently open at end-of-line.
  for (let i = runStart; i < n; i++) levels[i] = baseLevel;
}

// ---------------------------------------------------------------------------
// L2 — reordering
// ---------------------------------------------------------------------------

/** L2: reorder code-unit indices into visual order from the resolved levels. */
function reorderLevels(levels: readonly number[]): number[] {
  const n = levels.length;
  const order: number[] = Array.from({ length: n }, (_, i) => i);
  if (n === 0) return order;

  let highest = 0;
  let lowestOdd = MAX_DEPTH + 2;
  for (const l of levels) {
    if (l > highest) highest = l;
    if (l % 2 === 1 && l < lowestOdd) lowestOdd = l;
  }

  // From the highest level down to the lowest odd level, reverse contiguous
  // runs of characters at or above that level.
  for (let level = highest; level >= lowestOdd; level--) {
    let i = 0;
    while (i < n) {
      if (levels[order[i]!]! >= level) {
        let j = i;
        while (j < n && levels[order[j]!]! >= level) j++;
        // reverse order[i..j)
        for (let a = i, b = j - 1; a < b; a++, b--) {
          const tmp = order[a]!;
          order[a] = order[b]!;
          order[b] = tmp;
        }
        i = j;
      } else {
        i++;
      }
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the Unicode Bidirectional Algorithm (UAX #9) over `text`.
 *
 * Indices in the result refer to UTF-16 code units of the input string (the
 * same units JavaScript's `string[i]` and `.length` use). Astral characters
 * (surrogate pairs) are classified by their scalar value but occupy two code
 * units, both assigned the same level.
 *
 * @param text The logical-order input string.
 * @param base Paragraph direction: `'ltr'` / `'rtl'` force the base level;
 *   `'auto'` (the default) derives it from the first strong character (P2/P3).
 * @returns The resolved levels, same-level runs, visual order and base level.
 */
export function resolveBidi(text: string, base: BidiDirection = 'auto'): BidiResult {
  const n = text.length;

  // Decode to per-code-unit scalar values (surrogate pair → scalar on the
  // high surrogate; the low surrogate copies it so both share a class/level).
  const codepoints: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < n) {
      const c2 = text.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        const scalar = (c - 0xd800) * 0x400 + (c2 - 0xdc00) + 0x10000;
        codepoints[i] = scalar;
        codepoints[i + 1] = scalar;
        i++;
        continue;
      }
    }
    codepoints[i] = c;
  }

  const originalTypes: BC[] = codepoints.map(bidiClass);

  // P2/P3 — paragraph base level.
  let baseLevel: number;
  if (base === 'ltr') baseLevel = 0;
  else if (base === 'rtl') baseLevel = 1;
  else baseLevel = computeBaseLevel(originalTypes);

  const levels: number[] = new Array<number>(n).fill(baseLevel);

  if (n === 0) {
    return { runs: [], levels: [], visualOrder: [], baseLevel };
  }

  // X1–X8 / X5a–X6a — explicit levels & overrides.
  const workingTypes = resolveExplicit(originalTypes, baseLevel, levels);

  // X10 — isolating run sequences.
  const sequences = buildIsolatingRunSequences(workingTypes, levels, baseLevel);

  // W, N, I per sequence.
  for (const seq of sequences) {
    resolveWeak(seq, workingTypes);
    resolveNeutral(seq, workingTypes, levels, codepoints);
    resolveImplicit(seq, workingTypes, levels);
  }

  // L1 — reset whitespace at separators / line end to the paragraph level.
  resetWhitespaceLevels(originalTypes, levels, baseLevel);

  // L2 — reorder into visual order.
  const visualOrder = reorderLevels(levels);

  // Partition into maximal same-level runs in logical order.
  const runs: BidiRun[] = [];
  let start = 0;
  while (start < n) {
    const level = levels[start]!;
    let end = start + 1;
    while (end < n && levels[end] === level) end++;
    runs.push({
      text: text.slice(start, end),
      level,
      direction: dirFromLevel(level) === 'L' ? 'ltr' : 'rtl',
      start,
      length: end - start,
    });
    start = end;
  }

  return { runs, levels, visualOrder, baseLevel };
}

/**
 * Convenience wrapper that returns `text` reordered into visual (left-to-right)
 * order via {@link resolveBidi}'s L2 result.
 *
 * Note: this performs pure reordering of code units. It does not apply Arabic
 * cursive shaping or mirror neutral glyphs; callers that need shaped glyphs
 * should pass the resolved runs to a shaping engine.
 *
 * @param text The logical-order input string.
 * @param base Paragraph direction (see {@link resolveBidi}).
 * @returns The visually reordered string.
 */
export function reorderVisual(text: string, base: BidiDirection = 'auto'): string {
  const { visualOrder } = resolveBidi(text, base);
  let out = '';
  for (const i of visualOrder) out += text[i]!;
  return out;
}
