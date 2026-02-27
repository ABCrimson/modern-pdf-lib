/**
 * @module assets/font/standardFonts
 *
 * Pre-computed metric data for the 14 standard PDF fonts (aka the
 * "Base 14").  Every conforming PDF viewer must have built-in support
 * for these fonts, so they can be referenced without embedding any
 * font program data.
 *
 * Metrics are expressed in the standard 1000 units-per-em coordinate
 * system used by Type 1 fonts.  Width tables cover the full
 * WinAnsiEncoding range (256 entries) unless the font uses a
 * specialised encoding (Symbol, ZapfDingbats).
 *
 * References:
 * - PDF 1.7 spec §9.6.2.2 (Standard Type 1 Fonts)
 * - Adobe Font Metrics (AFM) files for the Base-14 fonts
 * - WinAnsiEncoding: PDF 1.7 spec, Annex D, Table D.1
 */

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Metric data for a standard PDF font.
 *
 * Width values are in thousandths of a unit of text space (the standard
 * Type 1 coordinate system: 1000 units = 1 em).
 */
export interface StandardFont {
  /** PostScript font name (e.g. `"Helvetica-Bold"`). */
  readonly name: string;
  /**
   * Advance widths for each of the 256 WinAnsiEncoding codepoints.
   * Index `i` gives the width of the character at WinAnsi code `i`.
   * Missing / undefined glyphs have width 0.
   */
  readonly widths: readonly number[];
  /** Ascender in font units (positive). */
  readonly ascender: number;
  /** Descender in font units (negative). */
  readonly descender: number;
  /** Line gap in font units. */
  readonly lineGap: number;
  /** Cap height in font units. */
  readonly capHeight: number;
  /** x-height in font units. */
  readonly xHeight: number;
  /** Font bounding box [xMin, yMin, xMax, yMax]. */
  readonly bbox: readonly [number, number, number, number];
  /** StemV (dominant vertical stem width). */
  readonly stemV: number;
  /** Italic angle in degrees (0 for upright fonts). */
  readonly italicAngle: number;
  /** PDF font flags (for /FontDescriptor /Flags). */
  readonly flags: number;
}

// ---------------------------------------------------------------------------
// Width data — Helvetica family
// ---------------------------------------------------------------------------

// Helvetica widths (WinAnsiEncoding, all 256 codepoints).
// Source: Adobe Helvetica AFM.
// Each entry is the advance width × 1000 / unitsPerEm.
// prettier-ignore
const HELVETICA_WIDTHS: readonly number[] = [
  // 0x00–0x1F: control characters (width 0)
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  // 0x20 space – 0x7E tilde
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  // 0x40 @ – 0x5F _
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  // 0x60 ` – 0x7F DEL
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  // 0x80–0x8F (Windows-1252 specials)
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  // 0x90–0x9F
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  // 0xA0 NBSP – 0xAF
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  // 0xB0 ° – 0xBF
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  // 0xC0 À – 0xCF
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  // 0xD0 Ð – 0xDF
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  // 0xE0 à – 0xEF
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  // 0xF0 ð – 0xFF
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];

// prettier-ignore
const HELVETICA_BOLD_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

// prettier-ignore
const HELVETICA_OBLIQUE_WIDTHS: readonly number[] = HELVETICA_WIDTHS;

// prettier-ignore
const HELVETICA_BOLD_OBLIQUE_WIDTHS: readonly number[] = HELVETICA_BOLD_WIDTHS;

// ---------------------------------------------------------------------------
// Width data — Courier family (all fixed-width 600)
// ---------------------------------------------------------------------------

const COURIER_WIDTHS: readonly number[] = Array.from({ length: 256 }, (_, i) =>
  i < 32 ? 0 : 600,
);

const COURIER_BOLD_WIDTHS: readonly number[] = COURIER_WIDTHS;
const COURIER_OBLIQUE_WIDTHS: readonly number[] = COURIER_WIDTHS;
const COURIER_BOLD_OBLIQUE_WIDTHS: readonly number[] = COURIER_WIDTHS;

// ---------------------------------------------------------------------------
// Width data — Times family
// ---------------------------------------------------------------------------

// prettier-ignore
const TIMES_ROMAN_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444,
  921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722,
  556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500,
  333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500,
  500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541, 0,
  500, 0, 333, 500, 444, 1000, 500, 500, 333, 1000, 556, 333, 889, 0, 611, 0,
  0, 333, 333, 444, 444, 350, 500, 1000, 333, 980, 389, 333, 722, 0, 444, 722,
  250, 333, 500, 500, 500, 500, 200, 500, 333, 760, 276, 500, 564, 333, 760, 333,
  400, 564, 300, 300, 333, 500, 453, 250, 333, 300, 310, 500, 750, 750, 750, 444,
  722, 722, 722, 722, 722, 722, 889, 667, 611, 611, 611, 611, 333, 333, 333, 333,
  722, 722, 722, 722, 722, 722, 722, 564, 722, 722, 722, 722, 722, 722, 556, 500,
  444, 444, 444, 444, 444, 444, 667, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 500, 500, 500, 500, 500, 500, 564, 500, 500, 500, 500, 500, 500, 500, 500,
];

// prettier-ignore
const TIMES_BOLD_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500,
  930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778,
  611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500,
  333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500,
  556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520, 0,
  500, 0, 333, 500, 500, 1000, 500, 500, 333, 1000, 556, 333, 1000, 0, 667, 0,
  0, 333, 333, 500, 500, 350, 500, 1000, 333, 1000, 389, 333, 722, 0, 444, 722,
  250, 333, 500, 500, 500, 500, 220, 500, 333, 747, 300, 500, 570, 333, 747, 333,
  400, 570, 300, 300, 333, 556, 540, 250, 333, 300, 330, 500, 750, 750, 750, 500,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 389, 389, 389, 389,
  722, 722, 778, 778, 778, 778, 778, 570, 778, 722, 722, 722, 722, 722, 611, 556,
  500, 500, 500, 500, 500, 500, 722, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 556, 500, 500, 500, 500, 500, 570, 500, 556, 556, 556, 556, 500, 556, 500,
];

// prettier-ignore
const TIMES_ITALIC_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 333, 420, 500, 500, 833, 778, 214, 333, 333, 500, 675, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 675, 675, 675, 500,
  920, 611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556, 833, 667, 722,
  611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556, 389, 278, 389, 422, 500,
  333, 500, 500, 444, 500, 444, 278, 500, 500, 278, 278, 444, 278, 722, 500, 500,
  500, 500, 389, 389, 278, 500, 444, 667, 444, 444, 389, 400, 275, 400, 541, 0,
  500, 0, 333, 500, 556, 889, 500, 500, 333, 1000, 500, 333, 944, 0, 556, 0,
  0, 333, 333, 556, 556, 350, 500, 889, 333, 980, 389, 333, 667, 0, 389, 556,
  250, 389, 500, 500, 500, 500, 275, 500, 333, 760, 276, 500, 675, 333, 760, 333,
  400, 675, 300, 300, 333, 500, 523, 250, 333, 300, 310, 500, 750, 750, 750, 500,
  611, 611, 611, 611, 611, 611, 889, 667, 611, 611, 611, 611, 333, 333, 333, 333,
  722, 667, 722, 722, 722, 722, 722, 675, 722, 722, 722, 722, 722, 556, 611, 500,
  500, 500, 500, 500, 500, 500, 667, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 500, 500, 500, 500, 500, 500, 675, 500, 500, 500, 500, 500, 444, 500, 444,
];

// prettier-ignore
const TIMES_BOLD_ITALIC_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 389, 555, 500, 500, 833, 778, 278, 333, 333, 500, 570, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500,
  832, 667, 667, 667, 722, 667, 667, 722, 778, 389, 500, 667, 611, 889, 722, 722,
  611, 722, 667, 556, 611, 722, 667, 889, 667, 611, 611, 333, 278, 333, 570, 500,
  333, 500, 500, 444, 500, 444, 333, 500, 556, 278, 278, 500, 278, 778, 556, 500,
  500, 500, 389, 389, 278, 556, 444, 667, 500, 444, 389, 348, 220, 348, 570, 0,
  500, 0, 333, 500, 500, 1000, 500, 500, 333, 1000, 556, 333, 944, 0, 611, 0,
  0, 333, 333, 500, 500, 350, 500, 1000, 333, 1000, 389, 333, 722, 0, 389, 611,
  250, 389, 500, 500, 500, 500, 220, 500, 333, 747, 266, 500, 606, 333, 747, 333,
  400, 570, 300, 300, 333, 576, 500, 250, 333, 300, 300, 500, 750, 750, 750, 500,
  667, 667, 667, 667, 667, 667, 944, 667, 667, 667, 667, 667, 389, 389, 389, 389,
  722, 722, 722, 722, 722, 722, 722, 570, 722, 722, 722, 722, 722, 611, 611, 500,
  500, 500, 500, 500, 500, 500, 722, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 556, 500, 500, 500, 500, 500, 570, 500, 556, 556, 556, 556, 444, 500, 444,
];

// ---------------------------------------------------------------------------
// Width data — Symbol & ZapfDingbats
// ---------------------------------------------------------------------------

// Symbol font — uses Symbol encoding, not WinAnsi.
// We provide widths indexed by the byte values used in Symbol encoding.
// prettier-ignore
const SYMBOL_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 333, 713, 500, 549, 833, 778, 439, 333, 333, 500, 549, 250, 549, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 549, 549, 549, 444,
  549, 722, 667, 722, 612, 611, 763, 603, 722, 333, 631, 722, 686, 889, 722, 722,
  768, 741, 556, 592, 611, 690, 439, 768, 645, 795, 611, 333, 863, 333, 658, 500,
  500, 631, 549, 549, 494, 439, 521, 411, 603, 329, 603, 549, 549, 576, 521, 549,
  549, 521, 549, 603, 439, 576, 713, 686, 493, 686, 494, 480, 200, 480, 549, 0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  250, 620, 247, 549, 167, 713, 500, 753, 753, 753, 753, 1042, 987, 603, 987, 603,
  400, 549, 411, 549, 549, 713, 494, 460, 549, 549, 549, 549, 1000, 603, 1000, 658,
  823, 686, 795, 987, 768, 768, 823, 768, 768, 713, 713, 713, 713, 713, 713, 713,
  768, 713, 790, 790, 890, 823, 549, 250, 713, 603, 603, 1042, 987, 603, 987, 603,
  494, 329, 790, 790, 786, 713, 384, 384, 384, 384, 384, 384, 494, 494, 494, 494,
  0, 329, 274, 686, 686, 686, 384, 384, 384, 384, 384, 384, 494, 494, 494, 0,
];

// ZapfDingbats — uses ZapfDingbats encoding.
// prettier-ignore
const ZAPFDINGBATS_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278, 974, 961, 974, 980, 719, 789, 790, 791, 690, 960, 939, 549, 855, 911, 933,
  911, 945, 974, 755, 846, 762, 761, 571, 677, 763, 760, 759, 754, 494, 552, 537,
  577, 692, 786, 788, 788, 790, 793, 794, 816, 823, 789, 841, 823, 833, 816, 831,
  923, 744, 723, 749, 790, 792, 695, 776, 768, 792, 759, 707, 708, 682, 701, 826,
  815, 789, 789, 707, 687, 696, 689, 786, 787, 713, 791, 785, 791, 873, 761, 762,
  762, 759, 759, 892, 892, 788, 784, 438, 138, 277, 415, 392, 392, 668, 668, 0,
  0, 390, 390, 317, 317, 276, 276, 509, 509, 410, 410, 234, 234, 334, 334, 0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278, 732, 544, 544, 910, 667, 760, 760, 776, 595, 694, 626, 788, 788, 788, 788,
  788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788,
  788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788, 788,
  788, 788, 788, 788, 894, 838, 1016, 458, 748, 924, 748, 918, 927, 928, 928, 834,
  873, 828, 924, 924, 917, 930, 931, 463, 883, 836, 836, 867, 867, 696, 696, 874,
  0, 874, 760, 946, 771, 865, 771, 888, 967, 888, 831, 873, 927, 970, 918, 0,
];

// ---------------------------------------------------------------------------
// Font definitions
// ---------------------------------------------------------------------------

/** @internal */
function def(
  name: string,
  widths: readonly number[],
  ascender: number,
  descender: number,
  lineGap: number,
  capHeight: number,
  xHeight: number,
  bbox: readonly [number, number, number, number],
  stemV: number,
  italicAngle: number,
  flags: number,
): StandardFont {
  return {
    name,
    widths,
    ascender,
    descender,
    lineGap,
    capHeight,
    xHeight,
    bbox,
    stemV,
    italicAngle,
    flags,
  };
}

// ---------------------------------------------------------------------------
// The 14 standard fonts
// ---------------------------------------------------------------------------

/**
 * Map of all 14 standard PDF font names to their metric data.
 *
 * Keys are the exact PostScript font names as they appear in PDF
 * `/BaseFont` entries.
 */
export const STANDARD_FONTS: ReadonlyMap<string, StandardFont> = new Map<string, StandardFont>([
  [
    'Helvetica',
    def('Helvetica', HELVETICA_WIDTHS, 718, -207, 0, 718, 523,
      [-166, -225, 1000, 931], 88, 0, 32),
  ],
  [
    'Helvetica-Bold',
    def('Helvetica-Bold', HELVETICA_BOLD_WIDTHS, 718, -207, 0, 718, 532,
      [-170, -228, 1003, 962], 140, 0, 32),
  ],
  [
    'Helvetica-Oblique',
    def('Helvetica-Oblique', HELVETICA_OBLIQUE_WIDTHS, 718, -207, 0, 718, 523,
      [-170, -225, 1116, 931], 88, -12, 96),
  ],
  [
    'Helvetica-BoldOblique',
    def('Helvetica-BoldOblique', HELVETICA_BOLD_OBLIQUE_WIDTHS, 718, -207, 0, 718, 532,
      [-174, -228, 1114, 962], 140, -12, 96),
  ],
  [
    'Courier',
    def('Courier', COURIER_WIDTHS, 629, -157, 0, 562, 426,
      [-23, -250, 715, 805], 51, 0, 33),
  ],
  [
    'Courier-Bold',
    def('Courier-Bold', COURIER_BOLD_WIDTHS, 629, -157, 0, 562, 439,
      [-113, -250, 749, 801], 106, 0, 33),
  ],
  [
    'Courier-Oblique',
    def('Courier-Oblique', COURIER_OBLIQUE_WIDTHS, 629, -157, 0, 562, 426,
      [-27, -250, 849, 805], 51, -12, 97),
  ],
  [
    'Courier-BoldOblique',
    def('Courier-BoldOblique', COURIER_BOLD_OBLIQUE_WIDTHS, 629, -157, 0, 562, 439,
      [-57, -250, 869, 801], 106, -12, 97),
  ],
  [
    'Times-Roman',
    def('Times-Roman', TIMES_ROMAN_WIDTHS, 683, -217, 0, 662, 450,
      [-168, -218, 1000, 898], 84, 0, 34),
  ],
  [
    'Times-Bold',
    def('Times-Bold', TIMES_BOLD_WIDTHS, 683, -217, 0, 676, 461,
      [-168, -218, 1000, 935], 139, 0, 34),
  ],
  [
    'Times-Italic',
    def('Times-Italic', TIMES_ITALIC_WIDTHS, 683, -217, 0, 653, 441,
      [-169, -217, 1010, 883], 76, -15.5, 98),
  ],
  [
    'Times-BoldItalic',
    def('Times-BoldItalic', TIMES_BOLD_ITALIC_WIDTHS, 683, -217, 0, 669, 462,
      [-200, -218, 996, 921], 121, -15, 98),
  ],
  [
    'Symbol',
    def('Symbol', SYMBOL_WIDTHS, 1010, -293, 0, 1010, 0,
      [-180, -293, 1090, 1010], 85, 0, 4),
  ],
  [
    'ZapfDingbats',
    def('ZapfDingbats', ZAPFDINGBATS_WIDTHS, 820, -143, 0, 820, 0,
      [-1, -143, 981, 820], 90, 0, 4),
  ],
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The exact PostScript names of the 14 standard PDF fonts.
 */
export type StandardFontName =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Helvetica-Oblique'
  | 'Helvetica-BoldOblique'
  | 'Courier'
  | 'Courier-Bold'
  | 'Courier-Oblique'
  | 'Courier-BoldOblique'
  | 'Times-Roman'
  | 'Times-Bold'
  | 'Times-Italic'
  | 'Times-BoldItalic'
  | 'Symbol'
  | 'ZapfDingbats';

/**
 * All 14 standard font names, for iteration.
 */
export const STANDARD_FONT_NAMES: readonly StandardFontName[] = [
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Symbol',
  'ZapfDingbats',
] as const;

/**
 * Look up a standard font by name.
 *
 * @param name - The PostScript font name.
 * @returns The font metrics, or `undefined` if not a standard font.
 */
export function getStandardFont(name: string): StandardFont | undefined {
  return STANDARD_FONTS.get(name);
}

/**
 * Check whether a font name is one of the 14 standard PDF fonts.
 *
 * @param name - The PostScript font name.
 * @returns `true` if it is a standard font.
 */
export function isStandardFont(name: string): name is StandardFontName {
  return STANDARD_FONTS.has(name);
}

/**
 * Measure the width of a text string using a standard font.
 *
 * Characters outside the WinAnsiEncoding range are measured as the
 * width of the space character.
 *
 * @param text     - The text to measure.
 * @param fontName - The standard font name.
 * @param fontSize - The font size in points.
 * @returns The total advance width in points.
 */
export function measureStandardText(
  text: string,
  fontName: StandardFontName,
  fontSize: number,
): number {
  const font = STANDARD_FONTS.get(fontName);
  if (!font) {
    throw new Error(`Unknown standard font: ${fontName}`);
  }

  const scale = fontSize / 1000;
  let totalWidth = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // WinAnsiEncoding only covers 0–255
    const width = code < 256 ? (font.widths[code] ?? 0) : (font.widths[32] ?? 0);
    totalWidth += width;
  }

  return totalWidth * scale;
}

/**
 * Compute the height of the font at a given size.
 *
 * @param fontName - The standard font name.
 * @param fontSize - The font size in points.
 * @returns The height (ascender - descender) in points.
 */
export function standardFontHeight(
  fontName: StandardFontName,
  fontSize: number,
): number {
  const font = STANDARD_FONTS.get(fontName);
  if (!font) {
    throw new Error(`Unknown standard font: ${fontName}`);
  }
  return ((font.ascender - font.descender) / 1000) * fontSize;
}

/**
 * Create a standard font object compatible with the drawing API's
 * expectations for width lookups and metrics queries.
 *
 * This produces an object that can be used by the PDF embedding
 * pipeline to emit the correct `/Font` dictionary entries and
 * measure text for layout.
 *
 * @param fontName - One of the 14 standard font names.
 * @returns A StandardFont object with all metrics.
 * @throws If the font name is not one of the 14 standard fonts.
 */
export function createStandardFont(fontName: StandardFontName): StandardFont {
  const font = STANDARD_FONTS.get(fontName);
  if (!font) {
    throw new Error(
      `"${fontName}" is not a standard PDF font.  Valid names: ${STANDARD_FONT_NAMES.join(', ')}`,
    );
  }
  return font;
}
