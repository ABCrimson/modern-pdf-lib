/**
 * @module types/pdf
 *
 * Internal type definitions that model the low-level PDF object system.
 *
 * These types are **not** part of the public API; they are consumed by
 * the serializer, parser, and cross-reference table implementation.
 *
 * Reference: ISO 32000-1:2008 (PDF 1.7) and ISO 32000-2:2020 (PDF 2.0).
 */

// ---------------------------------------------------------------------------
// Version & basic enumerations
// ---------------------------------------------------------------------------

/**
 * PDF specification version that governs the feature set available.
 *
 * - `'1.7'` — most widely supported; ISO 32000-1.
 * - `'2.0'` — ISO 32000-2; adds AES-256, UTF-8 text strings, etc.
 */
export type PdfVersion = '1.7' | '2.0';

/**
 * Device colour spaces defined by the PDF specification.
 *
 * - `DeviceRGB` — three components `[0, 1]`.
 * - `DeviceCMYK` — four components `[0, 1]`.
 * - `DeviceGray` — one component `[0, 1]`.
 * - `Indexed` — palette-based colour.
 */
export type PdfColorSpace =
  | 'DeviceRGB'
  | 'DeviceCMYK'
  | 'DeviceGray'
  | 'Indexed';

/**
 * Stream compression / encoding filters the engine knows about.
 *
 * - `FlateDecode` — zlib/deflate (most common).
 * - `DCTDecode` — JPEG passthrough.
 * - `ASCIIHexDecode` — hex encoding.
 * - `ASCII85Decode` — base-85 encoding.
 * - `RunLengthDecode` — run-length encoding.
 */
export type PdfFilter =
  | 'FlateDecode'
  | 'DCTDecode'
  | 'ASCIIHexDecode'
  | 'ASCII85Decode'
  | 'RunLengthDecode';

/**
 * Font types supported by the engine.
 *
 * - `Type0` — composite (CID) font; used for CJK and OpenType/CFF.
 * - `Type1` — Adobe Type 1 (the 14 standard fonts).
 * - `TrueType` — TrueType outlines.
 * - `CIDFontType2` — CID font backed by TrueType outlines.
 */
export type FontType = 'Type0' | 'Type1' | 'TrueType' | 'CIDFontType2';

// ---------------------------------------------------------------------------
// Image XObject
// ---------------------------------------------------------------------------

/**
 * Data required to build an Image XObject stream in the PDF.
 *
 * This is the *decoded* representation; the actual stream data may be
 * FlateDecode- or DCTDecode-compressed.
 */
export interface ImageXObjectData {
  /** Pixel width of the source image. */
  readonly width: number;
  /** Pixel height of the source image. */
  readonly height: number;
  /** Colour space of the decoded sample data. */
  readonly colorSpace: PdfColorSpace;
  /** Bits per colour component (1, 2, 4, 8, or 16). */
  readonly bitsPerComponent: 1 | 2 | 4 | 8 | 16;
  /** The (possibly compressed) sample data. */
  readonly data: Uint8Array;
  /**
   * Filters applied to `data`, in decode order.
   * An empty array means the data is uncompressed.
   */
  readonly filters: readonly PdfFilter[];
  /**
   * Optional soft-mask (alpha) image data.
   * When present, this becomes the `/SMask` entry.
   */
  readonly softMask?: Uint8Array | undefined;
  /**
   * Optional decode parameters for each filter.
   * Each element corresponds to a filter in `filters` at the same index.
   */
  readonly decodeParms?: ReadonlyArray<DecodeParms> | undefined;
}

// ---------------------------------------------------------------------------
// DecodeParms sub-types (ISO 32000-1 Table 10, 13, 14)
// ---------------------------------------------------------------------------

/**
 * Decode parameters for `FlateDecode` and `LZWDecode` filters.
 *
 * These parameters control predictor-based pre-processing that
 * improves compression ratios for image data.
 *
 * See ISO 32000-1:2008 Table 10.
 */
export interface FlateDecodeParams {
  /**
   * Predictor algorithm:
   * - `1`  -- No prediction (default).
   * - `2`  -- TIFF Predictor 2 (horizontal differencing).
   * - `10` -- PNG prediction (None).
   * - `11` -- PNG prediction (Sub).
   * - `12` -- PNG prediction (Up).
   * - `13` -- PNG prediction (Average).
   * - `14` -- PNG prediction (Paeth).
   * - `15` -- PNG prediction (optimum per row).
   */
  readonly Predictor?: 1 | 2 | 10 | 11 | 12 | 13 | 14 | 15 | undefined;
  /**
   * Number of interleaved colour components per sample.
   * Default: `1`.
   */
  readonly Colors?: number | undefined;
  /**
   * Number of bits per colour component.
   * Default: `8`.
   */
  readonly BitsPerComponent?: 1 | 2 | 4 | 8 | 16 | undefined;
  /**
   * Number of samples per row.
   * Default: `1`.
   */
  readonly Columns?: number | undefined;
}

/**
 * Decode parameters for `DCTDecode` (JPEG) filter.
 *
 * See ISO 32000-1:2008 Table 13.
 */
export interface DCTDecodeParams {
  /**
   * Controls whether the decoder converts colour data:
   * - `0` -- No transform.
   * - `1` -- YCbCr to RGB (default for 3-component images).
   *
   * When omitted, the decoder infers the transform from the
   * number of components in the JPEG data.
   */
  readonly ColorTransform?: 0 | 1 | undefined;
}

/**
 * Decode parameters for `LZWDecode` filter.
 *
 * Shares the same predictor parameters as FlateDecode, plus
 * the `EarlyChange` parameter specific to LZW.
 *
 * See ISO 32000-1:2008 Table 10.
 */
export interface LZWDecodeParams {
  /** Predictor algorithm (same values as FlateDecodeParams). */
  readonly Predictor?: 1 | 2 | 10 | 11 | 12 | 13 | 14 | 15 | undefined;
  /** Number of interleaved colour components per sample. Default: `1`. */
  readonly Colors?: number | undefined;
  /** Bits per colour component. Default: `8`. */
  readonly BitsPerComponent?: 1 | 2 | 4 | 8 | 16 | undefined;
  /** Number of samples per row. Default: `1`. */
  readonly Columns?: number | undefined;
  /**
   * Controls when the LZW code length increases:
   * - `1` -- Code length increases one code early (default).
   * - `0` -- Code length increases at the standard point.
   */
  readonly EarlyChange?: 0 | 1 | undefined;
}

/**
 * Decode parameters for `JBIG2Decode` filter.
 *
 * JBIG2 global data is typically provided via a separate stream
 * referenced by this dictionary. Currently a placeholder for
 * future implementation.
 *
 * See ISO 32000-1:2008 Table 14.
 */
export interface Jbig2DecodeParams {
  // Reserved for future JBIG2 global segment data reference.
}

/**
 * Union of all supported decode parameter types.
 *
 * Each variant corresponds to a specific PDF stream filter.
 */
export type DecodeParms =
  | FlateDecodeParams
  | DCTDecodeParams
  | LZWDecodeParams
  | Jbig2DecodeParams;

// ---------------------------------------------------------------------------
// Font embedding
// ---------------------------------------------------------------------------

/**
 * Everything needed to write a font into the PDF.
 *
 * The font subsetting / glyph extraction pipeline produces one of
 * these, and the serializer turns it into the appropriate indirect
 * objects.
 */
export interface FontEmbedData {
  /** The PDF font type. */
  readonly fontType: FontType;
  /** PostScript name (e.g. `TimesNewRomanPSMT`). */
  readonly postScriptName: string;
  /** Base font name used in the /Type1 or /TrueType dictionary. */
  readonly baseFontName: string;
  /**
   * The (possibly subsetted) font program bytes.
   * `undefined` for the 14 standard fonts.
   */
  readonly fontProgram?: Uint8Array | undefined;
  /**
   * Filter applied to `fontProgram`.
   * Typically `FlateDecode` for embedded fonts.
   */
  readonly fontProgramFilter?: PdfFilter | undefined;
  /**
   * Per-glyph widths array.
   * Index 0 corresponds to `firstChar`.
   */
  readonly widths: readonly number[];
  /** First character code in the widths array. */
  readonly firstChar: number;
  /** Last character code in the widths array. */
  readonly lastChar: number;
  /** Font descriptor flags (see PDF spec Table 123). */
  readonly flags: number;
  /** Font bounding box `[llx, lly, urx, ury]`. */
  readonly fontBBox: readonly [number, number, number, number];
  /** Italic angle in degrees. */
  readonly italicAngle: number;
  /** Ascent value (positive). */
  readonly ascent: number;
  /** Descent value (negative). */
  readonly descent: number;
  /** Cap height. */
  readonly capHeight: number;
  /** Stem vertical width. */
  readonly stemV: number;
  /**
   * CIDToGID mapping bytes for CIDFontType2 fonts.
   * Required for TrueType-based CID fonts.
   */
  readonly cidToGidMap?: Uint8Array | undefined;
  /**
   * ToUnicode CMap string for text extraction.
   * Generated from the glyph-to-Unicode mapping at embed/save time.
   */
  readonly toUnicodeCMap?: string | undefined;
}

// ---------------------------------------------------------------------------
// Content stream
// ---------------------------------------------------------------------------

/**
 * Pre-built content stream data ready for serialization.
 *
 * A page may have multiple content streams that are concatenated
 * by the viewer.
 */
export interface ContentStreamData {
  /** The raw operator bytes (uncompressed). */
  readonly data: Uint8Array;
  /** Filters to apply during serialization. */
  readonly filters: readonly PdfFilter[];
}

// ---------------------------------------------------------------------------
// Cross-reference table
// ---------------------------------------------------------------------------

/**
 * A single entry in the cross-reference table.
 *
 * Matches the two entry types defined in PDF 1.7 section 7.5.4.
 */
export interface XrefEntry {
  /**
   * - `'in-use'` — the object exists at `byteOffset`.
   * - `'free'` — the object has been deleted; `nextFreeObject` points
   *   to the next free entry in the linked list.
   */
  readonly type: 'in-use' | 'free';
  /** Byte offset from the start of the file (in-use entries). */
  readonly byteOffset: number;
  /** Generation number. */
  readonly generationNumber: number;
  /**
   * For free entries: the object number of the next free object.
   * For in-use entries: unused (always 0).
   */
  readonly nextFreeObject: number;
}

// ---------------------------------------------------------------------------
// Trailer
// ---------------------------------------------------------------------------

/**
 * Data that appears in the PDF trailer dictionary.
 *
 * The trailer provides the entry points into the document:
 * `/Root` (catalog), `/Info`, `/Encrypt`, `/ID`.
 */
export interface TrailerData {
  /** Total number of entries in the xref table (including entry 0). */
  readonly size: number;
  /** Object number of the catalog dictionary. */
  readonly rootObjectNumber: number;
  /** Generation number of the catalog dictionary. */
  readonly rootGenerationNumber: number;
  /** Object number of the document info dictionary. */
  readonly infoObjectNumber: number;
  /** Generation number of the document info dictionary. */
  readonly infoGenerationNumber: number;
  /**
   * Optional: byte offset of the previous xref section (for
   * incremental updates).
   */
  readonly prevXrefOffset?: number | undefined;
  /**
   * Optional: two-element file identifier array.
   * Each element is a 16-byte Uint8Array.
   */
  readonly id?: readonly [Uint8Array, Uint8Array] | undefined;
}
