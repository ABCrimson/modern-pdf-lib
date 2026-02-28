/**
 * @module parser/jbig2Decode
 *
 * Basic JBIG2 stream decoder for the PDF JBIG2Decode filter.
 *
 * JBIG2 (ITU-T T.88 / ISO/IEC 14492) is a bilevel image compression
 * standard that is significantly more complex than CCITT.  This module
 * implements a minimum viable decoder that handles the most common
 * segment types found in PDFs:
 *
 * - File header parsing
 * - Page information segments
 * - Immediate generic region segments (template-based bitmap decoding)
 * - JBIG2Globals support (global segment data stored in DecodeParms)
 *
 * For segment types that are not yet supported (symbol dictionaries,
 * text regions, etc.), a descriptive error is thrown rather than
 * failing silently.
 *
 * Reference: PDF 1.7 spec, SS7.4.7; ITU-T T.88.
 *
 * @packageDocumentation
 */

import type { PdfDict } from '../core/pdfObjects.js';
import { PdfNumber } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// WASM bridge (optional acceleration)
// ---------------------------------------------------------------------------

/** Cached WASM bridge state — avoids repeated dynamic imports. */
let wasmAttempted = false;
let wasmAvailable = false;

/**
 * Try to load the JBIG2 WASM bridge.  Returns `true` if WASM is ready.
 * On failure, silently falls back to the pure-JS decoder.
 */
async function tryLoadJBIG2Wasm(): Promise<boolean> {
  if (wasmAttempted) return wasmAvailable;
  wasmAttempted = true;

  try {
    const { initJBIG2Wasm, isJBIG2WasmAvailable } = await import('./jbig2WasmBridge.js');
    await initJBIG2Wasm();
    wasmAvailable = isJBIG2WasmAvailable();
    return wasmAvailable;
  } catch {
    wasmAvailable = false;
    return false;
  }
}

/**
 * Reset WASM bridge state.  Primarily useful for testing.
 */
export function resetJBIG2WasmBridge(): void {
  wasmAttempted = false;
  wasmAvailable = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode JBIG2Decode stream data.
 *
 * Uses the pure-JS decoder (synchronous).  For optional WASM
 * acceleration, use {@link decodeJBIG2Async}.
 *
 * @param data  - The JBIG2-encoded content stream bytes.
 * @param parms - Optional `/DecodeParms` dictionary.  May contain a
 *                `/JBIG2Globals` key with a PdfDict/stream holding
 *                global segment data.
 * @returns The decoded bilevel image data.
 */
export function decodeJBIG2(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  const decoder = new JBIG2Decoder();

  // Process global segments if present
  const globalsData = extractGlobals(parms);
  if (globalsData) {
    decoder.parseChunk(globalsData, true);
  }

  // Process the main data
  decoder.parseChunk(data, false);

  return decoder.getPageBitmap();
}

/**
 * Decode JBIG2Decode stream data with optional WASM acceleration.
 *
 * Attempts to use the WASM-based decoder for better performance.
 * Falls back to the pure-JS decoder if WASM is not available.
 *
 * @param data  - The JBIG2-encoded content stream bytes.
 * @param parms - Optional `/DecodeParms` dictionary.
 * @returns The decoded bilevel image data.
 */
export async function decodeJBIG2Async(
  data: Uint8Array,
  parms: PdfDict | null,
): Promise<Uint8Array> {
  const globalsData = extractGlobals(parms);

  // Try WASM first
  if (await tryLoadJBIG2Wasm()) {
    try {
      const { decodeJBIG2Wasm } = await import('./jbig2WasmBridge.js');
      const result = decodeJBIG2Wasm(data, globalsData);
      return result.bitmapData;
    } catch {
      // WASM decode failed — fall through to JS
    }
  }

  // Fall back to pure-JS decoder
  return decodeJBIG2(data, parms);
}

// ---------------------------------------------------------------------------
// Extract global segment data from DecodeParms
// ---------------------------------------------------------------------------

/**
 * The JBIG2Globals parameter may be a stream whose data contains
 * global segments.  In our object model it appears as a PdfDict
 * with a `/data` or raw bytes property.  For now, if the parms
 * dictionary contains `/JBIG2Globals`, we try to extract its byte
 * data.
 */
function extractGlobals(parms: PdfDict | null): Uint8Array | null {
  if (!parms) return null;

  const globals = parms.get('/JBIG2Globals');
  if (!globals) return null;

  // If it's a stream-like object with decoded data, access it
  // The PdfStream class typically has a `data` or `decodedData` property
  if (globals && typeof globals === 'object') {
    // Try common patterns for stream data
    const obj = globals as unknown as Record<string, unknown>;
    if (obj['decodedData'] instanceof Uint8Array) {
      return obj['decodedData'] as Uint8Array;
    }
    if (obj['data'] instanceof Uint8Array) {
      return obj['data'] as Uint8Array;
    }
    if (obj['rawData'] instanceof Uint8Array) {
      return obj['rawData'] as Uint8Array;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// JBIG2 Segment types (ITU-T T.88, Table 7.1)
// ---------------------------------------------------------------------------

const SEGMENT_TYPES: Record<number, string> = {
  0: 'SymbolDictionary',
  4: 'IntermediateTextRegion',
  6: 'ImmediateTextRegion',
  7: 'ImmediateLosslessTextRegion',
  16: 'IntermediatePatternDictionary',
  20: 'IntermediateHalftoneRegion',
  22: 'ImmediateHalftoneRegion',
  23: 'ImmediateLosslessHalftoneRegion',
  36: 'IntermediateGenericRegion',
  38: 'ImmediateGenericRegion',
  39: 'ImmediateLosslessGenericRegion',
  40: 'IntermediateGenericRefinementRegion',
  42: 'ImmediateGenericRefinementRegion',
  43: 'ImmediateLosslessGenericRefinementRegion',
  48: 'PageInformation',
  49: 'EndOfPage',
  50: 'EndOfStripe',
  51: 'EndOfFile',
  52: 'Profiles',
  53: 'Tables',
  62: 'Extension',
};

// ---------------------------------------------------------------------------
// Segment header structure
// ---------------------------------------------------------------------------

interface SegmentHeader {
  segmentNumber: number;
  segmentType: number;
  pageAssociation: number;
  referredToSegments: number[];
  dataLength: number;
  headerLength: number;
}

// ---------------------------------------------------------------------------
// Decoded segment result types
// ---------------------------------------------------------------------------

interface SymbolBitmap {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

interface DecodedSymbolDict {
  readonly symbols: SymbolBitmap[];
}

interface DecodedPatternDict {
  readonly patterns: SymbolBitmap[];
  readonly patternWidth: number;
  readonly patternHeight: number;
}

interface DecodedBitmap {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

// ---------------------------------------------------------------------------
// JBIG2 Decoder
// ---------------------------------------------------------------------------

class JBIG2Decoder {
  private pageWidth = 0;
  private pageHeight = 0;
  private pageBitmap: Uint8Array | null = null;
  private pageDefaultPixel = 0;
  private pageCombinationOperator = 0;

  /** Global segments indexed by segment number. */
  private globalSegments = new Map<number, { header: SegmentHeader; data: Uint8Array }>();

  /** Decoded segment results (symbol dicts, pattern dicts, intermediate bitmaps). */
  private decodedSegments = new Map<
    number,
    { symbolDict?: DecodedSymbolDict; patternDict?: DecodedPatternDict; bitmap?: DecodedBitmap }
  >();

  /**
   * Parse a chunk of JBIG2 data (either globals or the main stream).
   */
  parseChunk(data: Uint8Array, isGlobals: boolean): void {
    let offset = 0;

    // Check for file header (standalone JBIG2 files start with the
    // 8-byte signature 0x97 0x4A 0x42 0x32 0x0D 0x0A 0x1A 0x0A)
    // PDFs typically do NOT include the file header.
    if (
      data.length >= 8 &&
      data[0] === 0x97 &&
      data[1] === 0x4a &&
      data[2] === 0x42 &&
      data[3] === 0x32 &&
      data[4] === 0x0d &&
      data[5] === 0x0a &&
      data[6] === 0x1a &&
      data[7] === 0x0a
    ) {
      // Skip file header
      offset = 8;
      // Flags byte
      if (offset < data.length) {
        const flags = data[offset]!;
        offset++;
        // If bit 0 is 0, the number of pages follows (4 bytes)
        if ((flags & 0x01) === 0) {
          offset += 4;
        }
      }
    }

    // Parse segments
    while (offset < data.length) {
      const headerResult = this.parseSegmentHeader(data, offset);
      if (!headerResult) break;

      const { header, newOffset } = headerResult;
      offset = newOffset;

      // Extract segment data
      let segDataLength = header.dataLength;
      if (segDataLength === 0xffffffff) {
        // Unknown data length -- for now, consume remaining data
        segDataLength = data.length - offset;
      }

      if (offset + segDataLength > data.length) {
        // Truncated -- use what we have
        segDataLength = data.length - offset;
      }

      const segData = data.subarray(offset, offset + segDataLength);
      offset += segDataLength;

      if (isGlobals) {
        // Store for later reference
        this.globalSegments.set(header.segmentNumber, { header, data: segData });
        // Also decode symbol/pattern dictionaries so they're available
        // when the main stream references them.
        this.processSegment(header, segData);
      } else {
        this.processSegment(header, segData);
      }

      // End of file segment
      if (header.segmentType === 51) break;
    }
  }

  /**
   * Parse a segment header from the data at the given offset.
   */
  private parseSegmentHeader(data: Uint8Array, offset: number): { header: SegmentHeader; newOffset: number } | null {
    if (offset + 6 > data.length) return null;

    // Segment number (4 bytes, big-endian)
    const segmentNumber = readUint32BE(data, offset);
    offset += 4;

    // Segment header flags (1 byte)
    const flags = data[offset]!;
    offset++;

    const segmentType = flags & 0x3f;
    const pageAssociationSizeLarge = (flags & 0x40) !== 0;

    // Referred-to segment count
    const referredToByte = data[offset]!;
    offset++;

    let referredToCount = (referredToByte >>> 5) & 0x07;
    if (referredToCount === 7) {
      // Long form: read 4-byte count
      if (offset + 3 > data.length) return null;
      referredToCount = readUint32BE(data, offset - 1) & 0x1fffffff;
      offset += 3;
      // Skip the retained flags bytes
      const retainedBytes = Math.ceil((referredToCount + 1) / 8);
      offset += retainedBytes;
    }

    // Referred-to segment numbers
    const referredToSegments: number[] = [];
    const refSize = segmentNumber <= 255 ? 1 : segmentNumber <= 65535 ? 2 : 4;
    for (let i = 0; i < referredToCount; i++) {
      if (offset + refSize > data.length) return null;
      if (refSize === 1) {
        referredToSegments.push(data[offset]!);
        offset++;
      } else if (refSize === 2) {
        referredToSegments.push(readUint16BE(data, offset));
        offset += 2;
      } else {
        referredToSegments.push(readUint32BE(data, offset));
        offset += 4;
      }
    }

    // Page association
    let pageAssociation: number;
    if (pageAssociationSizeLarge) {
      if (offset + 4 > data.length) return null;
      pageAssociation = readUint32BE(data, offset);
      offset += 4;
    } else {
      if (offset >= data.length) return null;
      pageAssociation = data[offset]!;
      offset++;
    }

    // Segment data length (4 bytes)
    if (offset + 4 > data.length) return null;
    const dataLength = readUint32BE(data, offset);
    offset += 4;

    const headerLength = offset;

    return {
      header: {
        segmentNumber,
        segmentType,
        pageAssociation,
        referredToSegments,
        dataLength,
        headerLength,
      },
      newOffset: offset,
    };
  }

  /**
   * Process a decoded segment.
   */
  private processSegment(header: SegmentHeader, data: Uint8Array): void {
    switch (header.segmentType) {
      case 48: // Page Information
        this.processPageInformation(data);
        break;

      case 38: // Immediate Generic Region
      case 39: // Immediate Lossless Generic Region
        this.processImmediateGenericRegion(header, data);
        break;

      case 36: // Intermediate Generic Region
        // Store for later reference (used by refinement regions)
        this.globalSegments.set(header.segmentNumber, { header, data });
        break;

      case 49: // End of Page
        break;

      case 50: // End of Stripe
        break;

      case 51: // End of File
        break;

      case 0: // Symbol Dictionary
        this.processSymbolDictionary(header, data);
        break;

      case 4: // Intermediate Text Region
        this.processTextRegion(header, data, false);
        break;

      case 6: // Immediate Text Region
      case 7: // Immediate Lossless Text Region
        this.processTextRegion(header, data, true);
        break;

      case 16: // Pattern Dictionary
        this.processPatternDictionary(header, data);
        break;

      case 20: // Intermediate Halftone Region
        this.processHalftoneRegion(header, data, false);
        break;

      case 22: // Immediate Halftone Region
      case 23: // Immediate Lossless Halftone Region
        this.processHalftoneRegion(header, data, true);
        break;

      case 40: // Intermediate Generic Refinement Region
        this.processGenericRefinementRegion(header, data, false);
        break;

      case 42: // Immediate Generic Refinement Region
      case 43: // Immediate Lossless Generic Refinement Region
        this.processGenericRefinementRegion(header, data, true);
        break;

      case 52: // Profiles
      case 53: // Tables
      case 62: // Extension
        // Informational -- skip
        break;

      default: {
        const typeName = SEGMENT_TYPES[header.segmentType] ?? `unknown(${header.segmentType})`;
        throw new Error(
          `JBIG2Decode: segment type ${header.segmentType} (${typeName}) is not supported`,
        );
      }
    }
  }

  /**
   * Process a Page Information segment.
   * Structure: width(4), height(4), xResolution(4), yResolution(4),
   *            flags(1), striping(2)
   */
  private processPageInformation(data: Uint8Array): void {
    if (data.length < 19) {
      throw new Error('JBIG2Decode: Page Information segment too short');
    }

    this.pageWidth = readUint32BE(data, 0);
    this.pageHeight = readUint32BE(data, 4);
    // xResolution and yResolution are at offsets 8 and 12 (informational)

    const flags = data[16]!;
    this.pageDefaultPixel = (flags >>> 2) & 1;
    this.pageCombinationOperator = (flags >>> 3) & 3;

    // Handle unknown height (0xFFFFFFFF)
    const height = this.pageHeight === 0xffffffff ? 0 : this.pageHeight;

    if (this.pageWidth > 0 && height > 0) {
      const rowBytes = Math.ceil(this.pageWidth / 8);
      this.pageBitmap = new Uint8Array(rowBytes * height);
      if (this.pageDefaultPixel === 1) {
        // Fill with 1s (black default)
        this.pageBitmap.fill(0xff);
      }
    }
  }

  /**
   * Process an Immediate Generic Region segment.
   *
   * This is the most common region type in PDFs -- it encodes a
   * rectangular bitmap using arithmetic coding or MMR (Modified Modified
   * Read = Group 4 variant).
   */
  private processImmediateGenericRegion(header: SegmentHeader, data: Uint8Array): void {
    if (data.length < 18) {
      throw new Error('JBIG2Decode: Generic Region segment too short');
    }

    // Region segment information field (13 bytes)
    const regionWidth = readUint32BE(data, 0);
    const regionHeight = readUint32BE(data, 4);
    const regionX = readUint32BE(data, 8);
    const regionY = readUint32BE(data, 12);
    const regionFlags = data[16]!;
    const combinationOperator = regionFlags & 0x07;

    // Generic region segment flags
    const genericFlags = data[17]!;
    const mmr = (genericFlags & 0x01) !== 0;
    const templateId = (genericFlags >>> 1) & 0x03;
    const typicalPrediction = (genericFlags & 0x08) !== 0;

    let dataOffset = 18;

    // Adaptive template pixels (AT) for arithmetic coding
    if (!mmr) {
      // Skip AT pixels based on template
      if (templateId === 0) {
        dataOffset += 8; // 4 pairs of (x, y) shorts
      } else {
        dataOffset += 2; // 1 pair
      }
    }

    const regionData = data.subarray(dataOffset);
    let bitmap: Uint8Array;

    if (mmr) {
      // MMR encoding is essentially Group 4 fax coding
      bitmap = decodeMMRBitmap(regionData, regionWidth, regionHeight);
    } else {
      // Arithmetic coding
      bitmap = decodeArithmeticGenericRegion(
        regionData,
        regionWidth,
        regionHeight,
        templateId,
        typicalPrediction,
      );
    }

    // Compose onto page bitmap
    this.composeRegion(bitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
  }

  /**
   * Compose a region bitmap onto the page bitmap.
   */
  private composeRegion(
    regionBitmap: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    operator: number,
  ): void {
    // Ensure page bitmap exists
    if (!this.pageBitmap) {
      // Create it with the region dimensions
      if (this.pageWidth === 0) this.pageWidth = width;
      if (this.pageHeight === 0 || this.pageHeight === 0xffffffff) {
        this.pageHeight = y + height;
      }

      const rowBytes = Math.ceil(this.pageWidth / 8);
      this.pageBitmap = new Uint8Array(rowBytes * this.pageHeight);
      if (this.pageDefaultPixel === 1) {
        this.pageBitmap.fill(0xff);
      }
    }

    const pageRowBytes = Math.ceil(this.pageWidth / 8);
    const regionRowBytes = Math.ceil(width / 8);

    for (let row = 0; row < height; row++) {
      const pageY = y + row;
      if (pageY >= this.pageHeight) break;

      for (let col = 0; col < width; col++) {
        const pageX = x + col;
        if (pageX >= this.pageWidth) break;

        // Get region pixel
        const regionByteIdx = row * regionRowBytes + (col >>> 3);
        const regionBitIdx = 7 - (col & 7);
        const regionPixel = (regionBitmap[regionByteIdx]! >>> regionBitIdx) & 1;

        // Get page pixel
        const pageByteIdx = pageY * pageRowBytes + (pageX >>> 3);
        const pageBitIdx = 7 - (pageX & 7);
        const pagePixel = (this.pageBitmap[pageByteIdx]! >>> pageBitIdx) & 1;

        // Apply combination operator
        let resultPixel: number;
        switch (operator) {
          case 0: // OR
            resultPixel = pagePixel | regionPixel;
            break;
          case 1: // AND
            resultPixel = pagePixel & regionPixel;
            break;
          case 2: // XOR
            resultPixel = pagePixel ^ regionPixel;
            break;
          case 3: // XNOR
            resultPixel = (pagePixel ^ regionPixel) === 0 ? 1 : 0;
            break;
          case 4: // REPLACE
          default:
            resultPixel = regionPixel;
            break;
        }

        // Set page pixel
        if (resultPixel) {
          this.pageBitmap[pageByteIdx] = (this.pageBitmap[pageByteIdx]! | (1 << pageBitIdx)) & 0xff;
        } else {
          this.pageBitmap[pageByteIdx] = this.pageBitmap[pageByteIdx]! & ~(1 << pageBitIdx) & 0xff;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Symbol Dictionary (segment type 0)
  // -------------------------------------------------------------------------

  /**
   * Process a Symbol Dictionary segment.
   *
   * Decodes symbol bitmaps using arithmetic coding and stores them
   * in `decodedSegments` for use by text region segments.
   *
   * Only the arithmetic-coded path is implemented (most common in PDFs).
   * Huffman-coded symbol dictionaries throw.
   */
  private processSymbolDictionary(header: SegmentHeader, data: Uint8Array): void {
    if (data.length < 10) {
      throw new Error('JBIG2Decode: Symbol Dictionary segment too short');
    }

    let offset = 0;

    // SD flags (2 bytes, big-endian)
    const sdFlags = readUint16BE(data, offset);
    offset += 2;

    const sdHuff = sdFlags & 1;
    const sdRefAgg = (sdFlags >>> 1) & 1;
    const sdTemplate = (sdFlags >>> 10) & 3;
    const sdrTemplate = (sdFlags >>> 12) & 1;

    if (sdHuff) {
      throw new Error('JBIG2Decode: Huffman-coded symbol dictionary not supported');
    }

    // Adaptive template (AT) pixels for arithmetic generic region
    if (sdTemplate === 0) {
      offset += 8; // 4 AT pixels × 2 bytes each
    } else {
      offset += 2; // 1 AT pixel × 2 bytes
    }

    // Refinement AT pixels (if refinement aggregate)
    if (sdRefAgg) {
      if (sdrTemplate === 0) {
        offset += 4; // 2 AT pixels × 2 bytes
      } else {
        offset += 2; // 1 AT pixel × 2 bytes
      }
    }

    // Number of exported symbols (4 bytes)
    const numExported = readUint32BE(data, offset);
    offset += 4;

    // Number of new symbols (4 bytes)
    const numNew = readUint32BE(data, offset);
    offset += 4;

    // Collect input symbols from referred-to symbol dictionaries
    const inputSymbols: SymbolBitmap[] = [];
    for (const refSegNum of header.referredToSegments) {
      const refSeg = this.decodedSegments.get(refSegNum);
      if (refSeg?.symbolDict) {
        inputSymbols.push(...refSeg.symbolDict.symbols);
      }
    }

    // Decode new symbols using arithmetic coding
    const arithData = data.subarray(offset);
    const decoder = new ArithmeticDecoder(arithData);
    const iadhDecoder = new IntegerDecoder();
    const iadwDecoder = new IntegerDecoder();

    const newSymbols: SymbolBitmap[] = [];
    let heightClassHeight = 0;
    let symbolsDecoded = 0;

    while (symbolsDecoded < numNew) {
      // Decode height class delta
      const deltaH = iadhDecoder.decode(decoder);
      if (deltaH === null) break; // OOB
      heightClassHeight += deltaH;
      if (heightClassHeight < 0) break;

      let symbolWidth = 0;

      // Decode symbols in this height class
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const deltaW = iadwDecoder.decode(decoder);
        if (deltaW === null) break; // OOB = end of height class
        symbolWidth += deltaW;

        if (symbolsDecoded >= numNew) break;
        if (symbolWidth <= 0 || heightClassHeight <= 0) {
          symbolsDecoded++;
          continue;
        }

        if (sdRefAgg) {
          // Refinement aggregate: skip for now, decode as plain bitmap
          const bitmap = decodeGenericBitmap(
            decoder,
            symbolWidth,
            heightClassHeight,
            sdTemplate,
          );
          newSymbols.push({ data: bitmap, width: symbolWidth, height: heightClassHeight });
        } else {
          // Standard: decode each symbol as a generic bitmap
          const bitmap = decodeGenericBitmap(
            decoder,
            symbolWidth,
            heightClassHeight,
            sdTemplate,
          );
          newSymbols.push({ data: bitmap, width: symbolWidth, height: heightClassHeight });
        }

        symbolsDecoded++;
      }
    }

    // Build exported symbols list
    const allSymbols = [...inputSymbols, ...newSymbols];

    // Decode export flags using IAEX
    const iaexDecoder = new IntegerDecoder();
    const exported: SymbolBitmap[] = [];
    let currentExport = false;
    let i = 0;

    while (i < allSymbols.length && exported.length < numExported) {
      const run = iaexDecoder.decode(decoder);
      if (run === null) break;
      if (currentExport) {
        for (let j = 0; j < run && i + j < allSymbols.length; j++) {
          exported.push(allSymbols[i + j]!);
        }
      }
      i += Math.max(run, 0);
      currentExport = !currentExport;
    }

    // Fallback: if export decoding didn't produce results, export all new symbols
    if (exported.length === 0) {
      exported.push(...allSymbols);
    }

    this.decodedSegments.set(header.segmentNumber, {
      symbolDict: { symbols: exported },
    });
  }

  // -------------------------------------------------------------------------
  // Text Region (segment types 4, 6, 7)
  // -------------------------------------------------------------------------

  /**
   * Process a Text Region segment.
   *
   * Collects symbols from referred symbol dictionaries, then decodes
   * symbol instance positions and IDs using arithmetic integer coding.
   * Each symbol is placed on a region bitmap which is then composed
   * onto the page (for immediate types) or stored (intermediate).
   */
  private processTextRegion(header: SegmentHeader, data: Uint8Array, immediate: boolean): void {
    if (data.length < 19) {
      throw new Error('JBIG2Decode: Text Region segment too short');
    }

    let offset = 0;

    // Region segment information (17 bytes)
    const regionWidth = readUint32BE(data, offset);
    const regionHeight = readUint32BE(data, offset + 4);
    const regionX = readUint32BE(data, offset + 8);
    const regionY = readUint32BE(data, offset + 12);
    const regionFlags = data[offset + 16]!;
    const combinationOperator = regionFlags & 0x07;
    offset += 17;

    if (offset + 2 > data.length) {
      throw new Error('JBIG2Decode: Text Region segment too short for flags');
    }

    // Text region segment flags (2 bytes)
    const trFlags = readUint16BE(data, offset);
    offset += 2;

    const sbHuff = trFlags & 1;
    const sbRefine = (trFlags >>> 1) & 1;
    const logStripSize = (trFlags >>> 2) & 3;
    const stripSize = 1 << logStripSize;
    const refCorner = (trFlags >>> 4) & 3;
    const transposed = (trFlags >>> 6) & 1;
    const sbCombOp = (trFlags >>> 7) & 3;
    const sbDefPixel = (trFlags >>> 9) & 1;
    const sbDsOffset = signExtend((trFlags >>> 10) & 0x1f, 5);
    const sbrTemplate = (trFlags >>> 15) & 1;

    if (sbHuff) {
      throw new Error('JBIG2Decode: Huffman-coded text region not supported');
    }

    // Huffman table selection (if Huffman, skip)
    // For arithmetic: skip refinement AT pixels if refinement is on
    if (sbRefine && !sbHuff) {
      if (sbrTemplate === 0) {
        offset += 4; // 2 refinement AT pixels × 2 bytes
      } else {
        offset += 2; // 1 refinement AT pixel × 2 bytes
      }
    }

    // Number of symbol instances (4 bytes)
    if (offset + 4 > data.length) {
      throw new Error('JBIG2Decode: Text Region segment too short for instance count');
    }
    const numInstances = readUint32BE(data, offset);
    offset += 4;

    // Collect all symbols from referred-to symbol dictionaries
    const symbols: SymbolBitmap[] = [];
    for (const refSegNum of header.referredToSegments) {
      const refSeg = this.decodedSegments.get(refSegNum);
      if (refSeg?.symbolDict) {
        symbols.push(...refSeg.symbolDict.symbols);
      }
    }

    const numSymbols = symbols.length;
    if (numSymbols === 0) {
      // No symbols available — create empty region
      const rowBytes = Math.ceil(regionWidth / 8);
      const bitmap = new Uint8Array(rowBytes * regionHeight);
      if (sbDefPixel) bitmap.fill(0xff);
      if (immediate) {
        this.composeRegion(bitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
      } else {
        this.decodedSegments.set(header.segmentNumber, {
          bitmap: { data: bitmap, width: regionWidth, height: regionHeight },
        });
      }
      return;
    }

    // IAID code length = ceil(log2(numSymbols))
    const symCodeLen = Math.max(1, Math.ceil(Math.log2(numSymbols + 1)));

    // Create region bitmap
    const rowBytes = Math.ceil(regionWidth / 8);
    const regionBitmap = new Uint8Array(rowBytes * regionHeight);
    if (sbDefPixel) regionBitmap.fill(0xff);

    // Create arithmetic decoder and integer decoders
    const arithData = data.subarray(offset);
    const decoder = new ArithmeticDecoder(arithData);
    const iadtDecoder = new IntegerDecoder();
    const iafsDecoder = new IntegerDecoder();
    const iadsDecoder = new IntegerDecoder();
    const iaitDecoder = new IntegerDecoder();
    const iaidDecoder = new IAIDDecoder(symCodeLen);

    // Decode symbol instances
    let stripT = -stripSize; // initial strip T
    let instancesDecoded = 0;
    let firstS = 0;

    while (instancesDecoded < numInstances) {
      // Decode strip delta T
      const dt = iadtDecoder.decode(decoder);
      if (dt === null) break;
      stripT += dt * stripSize;

      // Decode first symbol S coordinate
      const dfs = iafsDecoder.decode(decoder);
      if (dfs === null) break;
      firstS += dfs;
      let curS = firstS;

      // Decode symbols in this strip
      let firstInStrip = true;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!firstInStrip) {
          const ds = iadsDecoder.decode(decoder);
          if (ds === null) break; // OOB = end of strip
          curS += ds + sbDsOffset;
        }
        firstInStrip = false;

        if (instancesDecoded >= numInstances) break;

        // Decode instance T delta (within strip)
        let curT = 0;
        if (stripSize > 1) {
          const dit = iaitDecoder.decode(decoder);
          curT = dit ?? 0;
        }
        const t = stripT + curT;

        // Decode symbol ID
        const symbolId = iaidDecoder.decode(decoder);
        if (symbolId < 0 || symbolId >= numSymbols) {
          instancesDecoded++;
          continue;
        }

        const sym = symbols[symbolId]!;

        // Place symbol on region bitmap
        let si: number, ti: number;
        if (transposed) {
          // Transposed: S is vertical, T is horizontal
          switch (refCorner) {
            case 0: si = curS; ti = t; break;                     // TOPLEFT
            case 1: si = curS; ti = t - sym.width + 1; break;     // TOPRIGHT
            case 2: si = curS - sym.height + 1; ti = t; break;    // BOTTOMLEFT
            case 3: si = curS - sym.height + 1; ti = t - sym.width + 1; break; // BOTTOMRIGHT
            default: si = curS; ti = t; break;
          }
          composeBitmapOnto(regionBitmap, regionWidth, regionHeight, sym.data, sym.width, sym.height, ti, si, sbCombOp);
          curS += sym.height - 1;
        } else {
          // Normal: S is horizontal, T is vertical
          switch (refCorner) {
            case 0: ti = t; si = curS; break;                       // TOPLEFT
            case 1: ti = t; si = curS - sym.width + 1; break;       // TOPRIGHT
            case 2: ti = t - sym.height + 1; si = curS; break;      // BOTTOMLEFT
            case 3: ti = t - sym.height + 1; si = curS - sym.width + 1; break; // BOTTOMRIGHT
            default: ti = t; si = curS; break;
          }
          composeBitmapOnto(regionBitmap, regionWidth, regionHeight, sym.data, sym.width, sym.height, si, ti, sbCombOp);
          curS += sym.width - 1;
        }

        instancesDecoded++;
      }
    }

    if (immediate) {
      this.composeRegion(regionBitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
    } else {
      this.decodedSegments.set(header.segmentNumber, {
        bitmap: { data: regionBitmap, width: regionWidth, height: regionHeight },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pattern Dictionary (segment type 16)
  // -------------------------------------------------------------------------

  /**
   * Process a Pattern Dictionary segment.
   *
   * Decodes a collective bitmap containing all patterns side by side,
   * then splits it into individual pattern bitmaps.
   */
  private processPatternDictionary(header: SegmentHeader, data: Uint8Array): void {
    if (data.length < 9) {
      throw new Error('JBIG2Decode: Pattern Dictionary segment too short');
    }

    let offset = 0;

    // PD flags (1 byte)
    const pdFlags = data[offset]!;
    offset++;

    const pdMMR = pdFlags & 1;
    const pdTemplate = (pdFlags >>> 1) & 3;

    // Pattern width (1 byte)
    const patternWidth = data[offset]!;
    offset++;

    // Pattern height (1 byte)
    const patternHeight = data[offset]!;
    offset++;

    // Gray max (4 bytes)
    const grayMax = readUint32BE(data, offset);
    offset += 4;

    const numPatterns = grayMax + 1;

    // AT pixels for arithmetic coding
    if (!pdMMR) {
      if (pdTemplate === 0) {
        offset += 8;
      } else {
        offset += 2;
      }
    }

    // Decode collective bitmap (all patterns side by side)
    const collectiveWidth = patternWidth * numPatterns;
    const collectiveHeight = patternHeight;
    const regionData = data.subarray(offset);

    let collectiveBitmap: Uint8Array;
    if (pdMMR) {
      collectiveBitmap = decodeMMRBitmap(regionData, collectiveWidth, collectiveHeight);
    } else {
      collectiveBitmap = decodeArithmeticGenericRegion(
        regionData,
        collectiveWidth,
        collectiveHeight,
        pdTemplate,
        false,
      );
    }

    // Split into individual patterns
    const patterns: SymbolBitmap[] = [];
    const collectiveRowBytes = Math.ceil(collectiveWidth / 8);

    for (let i = 0; i < numPatterns; i++) {
      const patRowBytes = Math.ceil(patternWidth / 8);
      const patBitmap = new Uint8Array(patRowBytes * patternHeight);
      const xOffset = i * patternWidth;

      for (let row = 0; row < patternHeight; row++) {
        for (let col = 0; col < patternWidth; col++) {
          const srcCol = xOffset + col;
          const srcByteIdx = row * collectiveRowBytes + (srcCol >>> 3);
          const srcBitIdx = 7 - (srcCol & 7);
          const pixel = (collectiveBitmap[srcByteIdx]! >>> srcBitIdx) & 1;

          if (pixel) {
            const dstByteIdx = row * patRowBytes + (col >>> 3);
            const dstBitIdx = 7 - (col & 7);
            patBitmap[dstByteIdx] = (patBitmap[dstByteIdx]! | (1 << dstBitIdx)) & 0xff;
          }
        }
      }

      patterns.push({ data: patBitmap, width: patternWidth, height: patternHeight });
    }

    this.decodedSegments.set(header.segmentNumber, {
      patternDict: { patterns, patternWidth, patternHeight },
    });
  }

  // -------------------------------------------------------------------------
  // Halftone Region (segment types 20, 22, 23)
  // -------------------------------------------------------------------------

  /**
   * Process a Halftone Region segment.
   *
   * Uses a pattern dictionary to tile patterns into a region bitmap
   * based on gray-level values decoded from the data.
   */
  private processHalftoneRegion(header: SegmentHeader, data: Uint8Array, immediate: boolean): void {
    if (data.length < 22) {
      throw new Error('JBIG2Decode: Halftone Region segment too short');
    }

    let offset = 0;

    // Region segment information (17 bytes)
    const regionWidth = readUint32BE(data, offset);
    const regionHeight = readUint32BE(data, offset + 4);
    const regionX = readUint32BE(data, offset + 8);
    const regionY = readUint32BE(data, offset + 12);
    const regionFlags = data[offset + 16]!;
    const combinationOperator = regionFlags & 0x07;
    offset += 17;

    // Halftone region flags (1 byte)
    const htFlags = data[offset]!;
    offset++;

    const htMMR = htFlags & 1;
    const htTemplate = (htFlags >>> 1) & 3;
    const enableSkip = (htFlags >>> 3) & 1;
    const htCombOp = (htFlags >>> 4) & 7;
    const htDefPixel = (htFlags >>> 7) & 1;

    // Grid dimensions
    const gridW = readUint32BE(data, offset);
    offset += 4;
    const gridH = readUint32BE(data, offset);
    offset += 4;

    // Grid origin offset
    const gridX = readInt32BE(data, offset);
    offset += 4;
    const gridY = readInt32BE(data, offset);
    offset += 4;

    // Grid vector
    const gridStepX = readUint16BE(data, offset);
    offset += 2;
    const gridStepY = readUint16BE(data, offset);
    offset += 2;

    // Collect pattern dictionary from referred segments
    let patDict: DecodedPatternDict | undefined;
    for (const refSegNum of header.referredToSegments) {
      const refSeg = this.decodedSegments.get(refSegNum);
      if (refSeg?.patternDict) {
        patDict = refSeg.patternDict;
        break;
      }
    }

    // Create region bitmap
    const rowBytes = Math.ceil(regionWidth / 8);
    const regionBitmap = new Uint8Array(rowBytes * regionHeight);
    if (htDefPixel) regionBitmap.fill(0xff);

    if (!patDict || patDict.patterns.length === 0) {
      // No patterns — just use default bitmap
      if (immediate) {
        this.composeRegion(regionBitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
      } else {
        this.decodedSegments.set(header.segmentNumber, {
          bitmap: { data: regionBitmap, width: regionWidth, height: regionHeight },
        });
      }
      return;
    }

    // Decode gray-level values for each grid cell
    const numPatterns = patDict.patterns.length;
    const bitsPerGray = Math.max(1, Math.ceil(Math.log2(numPatterns)));
    const regionData = data.subarray(offset);

    // Decode gray bitmaps (one bit-plane per bit of the gray value)
    const grayBitmaps: Uint8Array[] = [];
    const planeWidth = gridW;
    const planeHeight = gridH;

    if (htMMR) {
      let planeOffset = 0;
      for (let bit = 0; bit < bitsPerGray; bit++) {
        const planeBitmap = decodeMMRBitmap(
          regionData.subarray(planeOffset),
          planeWidth,
          planeHeight,
        );
        grayBitmaps.push(planeBitmap);
        planeOffset += Math.ceil(planeWidth / 8) * planeHeight + 2; // approximate
      }
    } else {
      const decoder = new ArithmeticDecoder(regionData);
      for (let bit = 0; bit < bitsPerGray; bit++) {
        const planeBitmap = decodeGenericBitmap(decoder, planeWidth, planeHeight, htTemplate);
        grayBitmaps.push(planeBitmap);
      }
    }

    // Compose gray values into pattern indices and place patterns
    const planeRowBytes = Math.ceil(planeWidth / 8);

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        // Compute gray value from bit planes
        let grayValue = 0;
        for (let bit = bitsPerGray - 1; bit >= 0; bit--) {
          const plane = grayBitmaps[bit];
          if (plane) {
            const byteIdx = gy * planeRowBytes + (gx >>> 3);
            const bitIdx = 7 - (gx & 7);
            grayValue = (grayValue << 1) | ((plane[byteIdx]! >>> bitIdx) & 1);
          }
        }

        // Map to pattern index (gray inversion)
        const patIdx = Math.min(grayValue, numPatterns - 1);
        const pat = patDict.patterns[patIdx]!;

        // Compute pattern position on region
        const px = gridX + gy * gridStepY + gx * gridStepX;
        const py = gridY + gy * gridStepX - gx * gridStepY;

        composeBitmapOnto(
          regionBitmap,
          regionWidth,
          regionHeight,
          pat.data,
          pat.width,
          pat.height,
          px,
          py,
          htCombOp,
        );
      }
    }

    if (immediate) {
      this.composeRegion(regionBitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
    } else {
      this.decodedSegments.set(header.segmentNumber, {
        bitmap: { data: regionBitmap, width: regionWidth, height: regionHeight },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Generic Refinement Region (segment types 40, 42, 43)
  // -------------------------------------------------------------------------

  /**
   * Process a Generic Refinement Region segment.
   *
   * Refines a reference bitmap using arithmetic coding with a template
   * that considers pixels from both the reference and current bitmap.
   */
  private processGenericRefinementRegion(
    header: SegmentHeader,
    data: Uint8Array,
    immediate: boolean,
  ): void {
    if (data.length < 18) {
      throw new Error('JBIG2Decode: Generic Refinement Region segment too short');
    }

    let offset = 0;

    // Region segment information (17 bytes)
    const regionWidth = readUint32BE(data, offset);
    const regionHeight = readUint32BE(data, offset + 4);
    const regionX = readUint32BE(data, offset + 8);
    const regionY = readUint32BE(data, offset + 12);
    const regionFlags = data[offset + 16]!;
    const combinationOperator = regionFlags & 0x07;
    offset += 17;

    // Refinement flags (1 byte)
    const refFlags = data[offset]!;
    offset++;

    const grTemplate = refFlags & 1;

    // AT pixels
    if (grTemplate === 0) {
      offset += 4; // 2 AT pixels × 2 bytes
    }

    // Get reference bitmap from referred-to segment
    let refBitmap: DecodedBitmap | undefined;
    for (const refSegNum of header.referredToSegments) {
      const refSeg = this.decodedSegments.get(refSegNum);
      if (refSeg?.bitmap) {
        refBitmap = refSeg.bitmap;
        break;
      }
    }

    const arithData = data.subarray(offset);
    const rowBytes = Math.ceil(regionWidth / 8);
    let bitmap: Uint8Array;

    if (refBitmap) {
      bitmap = decodeRefinementBitmap(
        arithData,
        regionWidth,
        regionHeight,
        grTemplate,
        refBitmap.data,
        refBitmap.width,
        refBitmap.height,
      );
    } else {
      // No reference — decode as generic bitmap
      bitmap = decodeArithmeticGenericRegion(arithData, regionWidth, regionHeight, grTemplate, false);
    }

    if (immediate) {
      this.composeRegion(bitmap, regionWidth, regionHeight, regionX, regionY, combinationOperator);
    } else {
      this.decodedSegments.set(header.segmentNumber, {
        bitmap: { data: bitmap, width: regionWidth, height: regionHeight },
      });
    }
  }

  /**
   * Get the final page bitmap.
   */
  getPageBitmap(): Uint8Array {
    if (this.pageBitmap) {
      return this.pageBitmap;
    }
    return new Uint8Array(0);
  }
}

// ---------------------------------------------------------------------------
// MMR bitmap decoder (Modified Modified Read -- Group 4 variant)
// ---------------------------------------------------------------------------

/**
 * Decode an MMR-encoded bitmap.  MMR is essentially ITU-T T.6 (Group 4)
 * with the addition that the end-of-data pattern differs.
 */
function decodeMMRBitmap(
  data: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const output = new Uint8Array(rowBytes * height);

  // Reference line starts as all-white
  let referenceLine = new Uint8Array(width); // 0 = white
  const reader = new MMRBitReader(data);

  for (let row = 0; row < height; row++) {
    const currentLine = decodeMMRLine(reader, referenceLine, width);

    // Pack the decoded line into bytes
    for (let col = 0; col < width; col++) {
      if (currentLine[col]) {
        const byteIdx = row * rowBytes + (col >>> 3);
        const bitIdx = 7 - (col & 7);
        output[byteIdx] = (output[byteIdx]! | (1 << bitIdx)) & 0xff;
      }
    }

    referenceLine = new Uint8Array(currentLine);
  }

  return output;
}

/**
 * Simple bit reader for MMR data.
 */
class MMRBitReader {
  private bytePos = 0;
  private bitPos = 0;

  constructor(private readonly data: Uint8Array) {}

  readBit(): number {
    if (this.bytePos >= this.data.length) return 0;
    const bit = (this.data[this.bytePos]! >>> (7 - this.bitPos)) & 1;
    this.bitPos++;
    if (this.bitPos >= 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  get eof(): boolean {
    return this.bytePos >= this.data.length;
  }
}

// MMR uses the same 2D mode codes as Group 4
const enum MMRMode {
  PASS,
  HORIZONTAL,
  VERTICAL_0,
  VERTICAL_R1,
  VERTICAL_L1,
  VERTICAL_R2,
  VERTICAL_L2,
  VERTICAL_R3,
  VERTICAL_L3,
  EOFB,
}

function readMMRMode(reader: MMRBitReader): MMRMode {
  let bit = reader.readBit();

  if (bit === 1) return MMRMode.VERTICAL_0;

  // 0...
  bit = reader.readBit();
  if (bit === 1) {
    bit = reader.readBit();
    if (bit === 0) return MMRMode.VERTICAL_L1;
    return MMRMode.VERTICAL_R1;
  }

  // 00...
  bit = reader.readBit();
  if (bit === 1) return MMRMode.HORIZONTAL;

  // 000...
  bit = reader.readBit();
  if (bit === 1) return MMRMode.PASS;

  // 0000...
  bit = reader.readBit();
  if (bit === 1) {
    bit = reader.readBit();
    if (bit === 0) return MMRMode.VERTICAL_L2;
    return MMRMode.VERTICAL_R2;
  }

  // 00000...
  bit = reader.readBit();
  if (bit === 1) {
    bit = reader.readBit();
    if (bit === 0) return MMRMode.VERTICAL_L3;
    return MMRMode.VERTICAL_R3;
  }

  // 000000... -- EOFB pattern or error
  return MMRMode.EOFB;
}

// Simple Huffman run-length tables for MMR horizontal mode
// These are the same Modified Huffman tables as CCITT

interface MMRHuffNode {
  runLength?: number;
  isMakeup?: boolean;
  children?: [MMRHuffNode | null, MMRHuffNode | null];
}

function buildMMRTree(
  terminating: [number, number, number][],
  makeup: [number, number, number][],
  common: [number, number, number][],
): MMRHuffNode {
  const root: MMRHuffNode = { children: [null, null] };

  function insert(code: number, len: number, rl: number, isMakeup: boolean): void {
    let node = root;
    for (let i = len - 1; i >= 0; i--) {
      const b = (code >>> i) & 1;
      if (!node.children) node.children = [null, null];
      if (!node.children[b]) node.children[b] = {};
      node = node.children[b]!;
    }
    node.runLength = rl;
    node.isMakeup = isMakeup;
  }

  for (const [c, l, r] of terminating) insert(c, l, r, false);
  for (const [c, l, r] of makeup) insert(c, l, r, true);
  for (const [c, l, r] of common) insert(c, l, r, true);

  return root;
}

// White terminating codes
const MMR_WHITE_TERM: [number, number, number][] = [
  [0b00110101, 8, 0], [0b000111, 6, 1], [0b0111, 4, 2], [0b1000, 4, 3],
  [0b1011, 4, 4], [0b1100, 4, 5], [0b1110, 4, 6], [0b1111, 4, 7],
  [0b10011, 5, 8], [0b10100, 5, 9], [0b00111, 5, 10], [0b01000, 5, 11],
  [0b001000, 6, 12], [0b000011, 6, 13], [0b110100, 6, 14], [0b110101, 6, 15],
  [0b101010, 6, 16], [0b101011, 6, 17], [0b0100111, 7, 18], [0b0001100, 7, 19],
  [0b0001000, 7, 20], [0b0010111, 7, 21], [0b0000011, 7, 22], [0b0000100, 7, 23],
  [0b0101000, 7, 24], [0b0101011, 7, 25], [0b0010011, 7, 26], [0b0100100, 7, 27],
  [0b0011000, 7, 28], [0b00000010, 8, 29], [0b00000011, 8, 30], [0b00011010, 8, 31],
  [0b00011011, 8, 32], [0b00010010, 8, 33], [0b00010011, 8, 34], [0b00010100, 8, 35],
  [0b00010101, 8, 36], [0b00010110, 8, 37], [0b00010111, 8, 38], [0b00101000, 8, 39],
  [0b00101001, 8, 40], [0b00101010, 8, 41], [0b00101011, 8, 42], [0b00101100, 8, 43],
  [0b00101101, 8, 44], [0b00000100, 8, 45], [0b00000101, 8, 46], [0b00001010, 8, 47],
  [0b00001011, 8, 48], [0b01010010, 8, 49], [0b01010011, 8, 50], [0b01010100, 8, 51],
  [0b01010101, 8, 52], [0b00100100, 8, 53], [0b00100101, 8, 54], [0b01011000, 8, 55],
  [0b01011001, 8, 56], [0b01011010, 8, 57], [0b01011011, 8, 58], [0b01001010, 8, 59],
  [0b01001011, 8, 60], [0b00110010, 8, 61], [0b00110011, 8, 62], [0b00110100, 8, 63],
];

const MMR_WHITE_MAKEUP: [number, number, number][] = [
  [0b11011, 5, 64], [0b10010, 5, 128], [0b010111, 6, 192], [0b0110111, 7, 256],
  [0b00110110, 8, 320], [0b00110111, 8, 384], [0b01100100, 8, 448], [0b01100101, 8, 512],
  [0b01101000, 8, 576], [0b01100111, 8, 640], [0b011001100, 9, 704], [0b011001101, 9, 768],
  [0b011010010, 9, 832], [0b011010011, 9, 896], [0b011010100, 9, 960], [0b011010101, 9, 1024],
  [0b011010110, 9, 1088], [0b011010111, 9, 1152], [0b011011000, 9, 1216], [0b011011001, 9, 1280],
  [0b011011010, 9, 1344], [0b011011011, 9, 1408], [0b010011000, 9, 1472], [0b010011001, 9, 1536],
  [0b010011010, 9, 1600], [0b011000, 6, 1664], [0b010011011, 9, 1728],
];

const MMR_BLACK_TERM: [number, number, number][] = [
  [0b0000110111, 10, 0], [0b010, 3, 1], [0b11, 2, 2], [0b10, 2, 3],
  [0b011, 3, 4], [0b0011, 4, 5], [0b0010, 4, 6], [0b00011, 5, 7],
  [0b000101, 6, 8], [0b000100, 6, 9], [0b0000100, 7, 10], [0b0000101, 7, 11],
  [0b0000111, 7, 12], [0b00000100, 8, 13], [0b00000111, 8, 14],
  [0b000011000, 9, 15], [0b0000010111, 10, 16], [0b0000011000, 10, 17],
  [0b0000001000, 10, 18], [0b00001100111, 11, 19], [0b00001101000, 11, 20],
  [0b00001101100, 11, 21], [0b00000110111, 11, 22], [0b00000101000, 11, 23],
  [0b00000010111, 11, 24], [0b00000011000, 11, 25], [0b000011001010, 12, 26],
  [0b000011001011, 12, 27], [0b000011001100, 12, 28], [0b000011001101, 12, 29],
  [0b000001101000, 12, 30], [0b000001101001, 12, 31], [0b000001101010, 12, 32],
  [0b000001101011, 12, 33], [0b000011010010, 12, 34], [0b000011010011, 12, 35],
  [0b000011010100, 12, 36], [0b000011010101, 12, 37], [0b000011010110, 12, 38],
  [0b000011010111, 12, 39], [0b000001101100, 12, 40], [0b000001101101, 12, 41],
  [0b000011011010, 12, 42], [0b000011011011, 12, 43], [0b000001010100, 12, 44],
  [0b000001010101, 12, 45], [0b000001010110, 12, 46], [0b000001010111, 12, 47],
  [0b000001100100, 12, 48], [0b000001100101, 12, 49], [0b000001010010, 12, 50],
  [0b000001010011, 12, 51], [0b000000100100, 12, 52], [0b000000110111, 12, 53],
  [0b000000111000, 12, 54], [0b000000100111, 12, 55], [0b000000101000, 12, 56],
  [0b000001011000, 12, 57], [0b000001011001, 12, 58], [0b000000101011, 12, 59],
  [0b000000101100, 12, 60], [0b000001011010, 12, 61], [0b000001100110, 12, 62],
  [0b000001100111, 12, 63],
];

const MMR_BLACK_MAKEUP: [number, number, number][] = [
  [0b0000001111, 10, 64], [0b000011001000, 12, 128], [0b000011001001, 12, 192],
  [0b000001011011, 12, 256], [0b000000110011, 12, 320], [0b000000110100, 12, 384],
  [0b000000110101, 12, 448], [0b0000001101100, 13, 512], [0b0000001101101, 13, 576],
  [0b0000001001010, 13, 640], [0b0000001001011, 13, 704], [0b0000001001100, 13, 768],
  [0b0000001001101, 13, 832], [0b0000001110010, 13, 896], [0b0000001110011, 13, 960],
  [0b0000001110100, 13, 1024], [0b0000001110101, 13, 1088], [0b0000001110110, 13, 1152],
  [0b0000001110111, 13, 1216], [0b0000001010010, 13, 1280], [0b0000001010011, 13, 1344],
  [0b0000001010100, 13, 1408], [0b0000001010101, 13, 1472], [0b0000001011010, 13, 1536],
  [0b0000001011011, 13, 1600], [0b0000001100100, 13, 1664], [0b0000001100101, 13, 1728],
];

const MMR_COMMON_MAKEUP: [number, number, number][] = [
  [0b00000001000, 11, 1792], [0b00000001100, 11, 1856], [0b00000001101, 11, 1920],
  [0b000000010010, 12, 1984], [0b000000010011, 12, 2048], [0b000000010100, 12, 2112],
  [0b000000010101, 12, 2176], [0b000000010110, 12, 2240], [0b000000010111, 12, 2304],
  [0b000000011100, 12, 2368], [0b000000011101, 12, 2432], [0b000000011110, 12, 2496],
  [0b000000011111, 12, 2560],
];

const mmrWhiteTree = buildMMRTree(MMR_WHITE_TERM, MMR_WHITE_MAKEUP, MMR_COMMON_MAKEUP);
const mmrBlackTree = buildMMRTree(MMR_BLACK_TERM, MMR_BLACK_MAKEUP, MMR_COMMON_MAKEUP);

function readMMRRunLength(reader: MMRBitReader, tree: MMRHuffNode): number {
  let totalRun = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let node = tree;
    let codeLen = 0;

    while (node.children) {
      const bit = reader.readBit();
      codeLen++;
      const child = node.children[bit as 0 | 1];
      if (!child) {
        return totalRun > 0 ? totalRun : -1;
      }
      node = child;
      if (codeLen > 13) {
        return totalRun > 0 ? totalRun : -1;
      }
    }

    if (node.runLength === undefined) {
      return totalRun > 0 ? totalRun : -1;
    }

    totalRun += node.runLength;

    if (!node.isMakeup) {
      return totalRun;
    }
  }
}

function mmrFindB1(refLine: Uint8Array, a0: number, currentColor: number, columns: number): number {
  const oppositeColor = currentColor === 0 ? 1 : 0;
  let pos = a0 + 1;
  if (pos >= columns) return columns;

  while (pos < columns) {
    if (refLine[pos] === oppositeColor) {
      if (pos === 0 || refLine[pos - 1] !== oppositeColor) {
        return pos;
      }
      while (pos < columns && refLine[pos] === oppositeColor) pos++;
      continue;
    }
    pos++;
  }

  return columns;
}

function mmrFindB2(refLine: Uint8Array, b1: number, columns: number): number {
  if (b1 >= columns) return columns;
  const color = refLine[b1];
  let pos = b1 + 1;
  while (pos < columns && refLine[pos] === color) pos++;
  return pos;
}

function decodeMMRLine(
  reader: MMRBitReader,
  referenceLine: Uint8Array,
  columns: number,
): Uint8Array {
  const line = new Uint8Array(columns);
  let a0 = 0;
  let currentColor = 0;
  let a0IsBeforeLine = true;

  while (a0 < columns) {
    if (reader.eof) break;

    const mode = readMMRMode(reader);

    switch (mode) {
      case MMRMode.PASS: {
        const b1 = mmrFindB1(referenceLine, a0IsBeforeLine ? -1 : a0, currentColor, columns);
        const b2 = mmrFindB2(referenceLine, b1, columns);
        const fillEnd = Math.min(b2, columns);
        for (let i = (a0IsBeforeLine ? 0 : a0); i < fillEnd; i++) {
          line[i] = currentColor;
        }
        a0 = b2;
        a0IsBeforeLine = false;
        break;
      }

      case MMRMode.HORIZONTAL: {
        const tree1 = currentColor === 0 ? mmrWhiteTree : mmrBlackTree;
        const tree2 = currentColor === 0 ? mmrBlackTree : mmrWhiteTree;
        const run1 = readMMRRunLength(reader, tree1);
        if (run1 < 0) return line;
        const run2 = readMMRRunLength(reader, tree2);
        if (run2 < 0) return line;

        const start = a0IsBeforeLine ? 0 : a0;
        const end1 = Math.min(start + run1, columns);
        for (let i = start; i < end1; i++) line[i] = currentColor;

        const opp = currentColor === 0 ? 1 : 0;
        const end2 = Math.min(end1 + run2, columns);
        for (let i = end1; i < end2; i++) line[i] = opp;

        a0 = end2;
        a0IsBeforeLine = false;
        break;
      }

      case MMRMode.VERTICAL_0:
      case MMRMode.VERTICAL_R1:
      case MMRMode.VERTICAL_L1:
      case MMRMode.VERTICAL_R2:
      case MMRMode.VERTICAL_L2:
      case MMRMode.VERTICAL_R3:
      case MMRMode.VERTICAL_L3: {
        const offMap: Record<number, number> = {
          [MMRMode.VERTICAL_0]: 0,
          [MMRMode.VERTICAL_R1]: 1,
          [MMRMode.VERTICAL_L1]: -1,
          [MMRMode.VERTICAL_R2]: 2,
          [MMRMode.VERTICAL_L2]: -2,
          [MMRMode.VERTICAL_R3]: 3,
          [MMRMode.VERTICAL_L3]: -3,
        };
        const off = offMap[mode]!;
        const b1 = mmrFindB1(referenceLine, a0IsBeforeLine ? -1 : a0, currentColor, columns);
        const a1 = Math.max(0, Math.min(b1 + off, columns));
        const fillStart = a0IsBeforeLine ? 0 : a0;
        for (let i = fillStart; i < a1; i++) line[i] = currentColor;
        a0 = a1;
        a0IsBeforeLine = false;
        currentColor = currentColor === 0 ? 1 : 0;
        break;
      }

      case MMRMode.EOFB:
      default:
        // Fill remaining with current color
        for (let i = (a0IsBeforeLine ? 0 : a0); i < columns; i++) {
          line[i] = currentColor;
        }
        return line;
    }
  }

  return line;
}

// ---------------------------------------------------------------------------
// Arithmetic coding generic region decoder (basic implementation)
// ---------------------------------------------------------------------------

/**
 * Decode a generic region using arithmetic coding.
 *
 * This is a simplified implementation that handles the most common
 * template (template 0) with the standard context model.  For PDFs
 * with more complex JBIG2 content, this provides a reasonable
 * starting point.
 */
function decodeArithmeticGenericRegion(
  data: Uint8Array,
  width: number,
  height: number,
  templateId: number,
  _typicalPrediction: boolean,
): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const output = new Uint8Array(rowBytes * height);

  // Initialize the arithmetic decoder
  const decoder = new ArithmeticDecoder(data);

  // Context model -- number of context bits depends on template
  const contextSize = templateId === 0 ? 16 : templateId === 1 ? 13 : templateId === 2 ? 10 : 10;
  const stats = new Uint8Array(1 << contextSize); // probability states

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // Build context from surrounding pixels
      const cx = buildGenericContext(output, rowBytes, width, row, col, templateId);

      // Decode one pixel using the arithmetic decoder
      const pixel = decoder.decodeBit(stats, cx);

      if (pixel) {
        const byteIdx = row * rowBytes + (col >>> 3);
        const bitIdx = 7 - (col & 7);
        output[byteIdx] = (output[byteIdx]! | (1 << bitIdx)) & 0xff;
      }
    }
  }

  return output;
}

/**
 * Build the context value for a pixel at (row, col) using the
 * specified template.  The context is formed from neighboring
 * already-decoded pixels.
 */
function buildGenericContext(
  bitmap: Uint8Array,
  rowBytes: number,
  _width: number,
  row: number,
  col: number,
  templateId: number,
): number {
  // Helper to read a pixel from the bitmap
  function getPixel(r: number, c: number): number {
    if (r < 0 || c < 0) return 0;
    const byteIdx = r * rowBytes + (c >>> 3);
    const bitIdx = 7 - (c & 7);
    return (bitmap[byteIdx]! >>> bitIdx) & 1;
  }

  let cx = 0;

  if (templateId === 0) {
    // Template 0: 16-bit context
    // Two rows above: 4 pixels
    cx |= getPixel(row - 2, col - 1) << 15;
    cx |= getPixel(row - 2, col) << 14;
    cx |= getPixel(row - 2, col + 1) << 13;
    // One row above: 5 pixels
    cx |= getPixel(row - 1, col - 2) << 12;
    cx |= getPixel(row - 1, col - 1) << 11;
    cx |= getPixel(row - 1, col) << 10;
    cx |= getPixel(row - 1, col + 1) << 9;
    cx |= getPixel(row - 1, col + 2) << 8;
    // Current row: 4 pixels (all to the left)
    cx |= getPixel(row, col - 4) << 7;
    cx |= getPixel(row, col - 3) << 6;
    cx |= getPixel(row, col - 2) << 5;
    cx |= getPixel(row, col - 1) << 4;
    // Adaptive template pixel (AT) -- default position
    cx |= getPixel(row - 2, col + 2) << 3;
    // Padding
    cx |= getPixel(row - 1, col + 3) << 2;
    cx |= getPixel(row - 2, col - 2) << 1;
    cx |= getPixel(row - 2, col + 3);
  } else if (templateId === 1) {
    // Template 1: 13-bit context
    cx |= getPixel(row - 2, col - 1) << 12;
    cx |= getPixel(row - 2, col) << 11;
    cx |= getPixel(row - 2, col + 1) << 10;
    cx |= getPixel(row - 1, col - 2) << 9;
    cx |= getPixel(row - 1, col - 1) << 8;
    cx |= getPixel(row - 1, col) << 7;
    cx |= getPixel(row - 1, col + 1) << 6;
    cx |= getPixel(row - 1, col + 2) << 5;
    cx |= getPixel(row, col - 3) << 4;
    cx |= getPixel(row, col - 2) << 3;
    cx |= getPixel(row, col - 1) << 2;
    // AT pixel
    cx |= getPixel(row - 2, col + 2) << 1;
    cx |= getPixel(row - 1, col + 3);
  } else {
    // Template 2 or 3: 10-bit context
    cx |= getPixel(row - 2, col - 1) << 9;
    cx |= getPixel(row - 2, col) << 8;
    cx |= getPixel(row - 2, col + 1) << 7;
    cx |= getPixel(row - 1, col - 1) << 6;
    cx |= getPixel(row - 1, col) << 5;
    cx |= getPixel(row - 1, col + 1) << 4;
    cx |= getPixel(row, col - 2) << 3;
    cx |= getPixel(row, col - 1) << 2;
    // AT pixel
    cx |= getPixel(row - 2, col + 2) << 1;
    cx |= getPixel(row - 1, col + 2);
  }

  return cx;
}

// ---------------------------------------------------------------------------
// QM (MQ) Arithmetic Decoder
// ---------------------------------------------------------------------------

/**
 * QM-coder probability estimation table.
 * Each entry: [Qe, NMPS, NLPS, SWITCH]
 *   Qe = probability estimate (in fixed-point 0x8000 = 0.5)
 *   NMPS = next state after MPS
 *   NLPS = next state after LPS
 *   SWITCH = 1 if MPS sense should be toggled after LPS
 */
const QE_TABLE: [number, number, number, number][] = [
  [0x5601, 1, 1, 1],   // 0
  [0x3401, 2, 6, 0],   // 1
  [0x1801, 3, 9, 0],   // 2
  [0x0ac1, 4, 12, 0],  // 3
  [0x0521, 5, 29, 0],  // 4
  [0x0221, 38, 33, 0], // 5
  [0x5601, 7, 6, 1],   // 6
  [0x5401, 8, 14, 0],  // 7
  [0x4801, 9, 14, 0],  // 8
  [0x3801, 10, 14, 0], // 9
  [0x3001, 11, 17, 0], // 10
  [0x2401, 12, 18, 0], // 11
  [0x1c01, 13, 20, 0], // 12
  [0x1601, 29, 21, 0], // 13
  [0x5601, 15, 14, 1], // 14
  [0x5401, 16, 14, 0], // 15
  [0x5101, 17, 15, 0], // 16
  [0x4801, 18, 16, 0], // 17
  [0x3801, 19, 17, 0], // 18
  [0x3401, 20, 18, 0], // 19
  [0x3001, 21, 19, 0], // 20
  [0x2801, 22, 19, 0], // 21
  [0x2401, 23, 20, 0], // 22
  [0x2201, 24, 21, 0], // 23
  [0x1c01, 25, 22, 0], // 24
  [0x1801, 26, 23, 0], // 25
  [0x1601, 27, 24, 0], // 26
  [0x1401, 28, 25, 0], // 27
  [0x1201, 29, 26, 0], // 28
  [0x1101, 30, 27, 0], // 29
  [0x0ac1, 31, 28, 0], // 30
  [0x09c1, 32, 29, 0], // 31
  [0x08a1, 33, 30, 0], // 32
  [0x0521, 34, 31, 0], // 33
  [0x0441, 35, 32, 0], // 34
  [0x02a1, 36, 33, 0], // 35
  [0x0221, 37, 34, 0], // 36
  [0x0141, 38, 35, 0], // 37
  [0x0111, 39, 36, 0], // 38
  [0x0085, 40, 37, 0], // 39
  [0x0049, 41, 38, 0], // 40
  [0x0025, 42, 39, 0], // 41
  [0x0015, 43, 40, 0], // 42
  [0x0009, 44, 41, 0], // 43
  [0x0005, 45, 42, 0], // 44
  [0x0001, 45, 43, 0], // 45
  [0x5601, 46, 46, 0], // 46 (uniform context)
];

class ArithmeticDecoder {
  private a = 0; // interval register
  private c = 0; // code register
  private ct = 0; // bit count
  private bytePos = 0;
  private readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
    this.init();
  }

  private init(): void {
    // Read the first two bytes to initialize C
    const b0 = this.readByte();
    const b1 = this.readByte();
    this.c = (b0 << 8) | b1;
    this.c <<= 8; // shift left by 8
    // Read one more byte
    this.c |= this.readByte();
    this.c <<= 7;
    this.ct = 0; // will be set by bytein

    this.a = 0x8000;

    // Initialize properly
    this.c = 0;
    this.bytePos = 0;
    this.a = 0x8000;

    // Start by reading first bytes into code register
    this.c = this.readByte() << 16;
    this.c |= this.readByte() << 8;
    this.c |= this.readByte();
    this.c <<= 5;
    this.ct = 3; // remaining bits in the last byte
  }

  private readByte(): number {
    if (this.bytePos >= this.data.length) return 0xff;
    const b = this.data[this.bytePos]!;
    this.bytePos++;
    return b;
  }

  private byteIn(): void {
    const b = this.readByte();
    this.c = ((this.c << 8) | b) >>> 0;
    this.ct = 8;
  }

  /**
   * Decode a single bit in the given context.
   *
   * `stats` is an array of packed state values:
   *   bits 0-5: state index (0-46)
   *   bit 6: MPS value (0 or 1)
   */
  decodeBit(stats: Uint8Array, cx: number): number {
    const stateByte = stats[cx] ?? 0;
    const stateIdx = stateByte & 0x3f;
    const mps = (stateByte >>> 6) & 1;

    const qe = QE_TABLE[stateIdx]![0]!;
    const nmps = QE_TABLE[stateIdx]![1]!;
    const nlps = QE_TABLE[stateIdx]![2]!;
    const switchFlag = QE_TABLE[stateIdx]![3]!;

    this.a -= qe;

    // Check if the code register is in the MPS or LPS sub-interval
    if ((this.c >>> 16) < this.a) {
      // MPS sub-interval
      if (this.a >= 0x8000) {
        return mps;
      }
      // Need to renormalize
      if (this.a < qe) {
        // Conditional exchange: actually LPS
        const d = 1 - mps;
        if (switchFlag) {
          stats[cx] = (((1 - mps) << 6) | nlps) & 0xff;
        } else {
          stats[cx] = ((mps << 6) | nlps) & 0xff;
        }
        this.renormalize();
        return d;
      } else {
        stats[cx] = ((mps << 6) | nmps) & 0xff;
        this.renormalize();
        return mps;
      }
    } else {
      // LPS sub-interval
      this.c = ((this.c >>> 16) - this.a) << 16 | (this.c & 0xffff);

      if (this.a < qe) {
        // Conditional exchange: actually MPS
        this.a = qe;
        stats[cx] = ((mps << 6) | nmps) & 0xff;
        this.renormalize();
        return mps;
      } else {
        this.a = qe;
        const d = 1 - mps;
        if (switchFlag) {
          stats[cx] = (((1 - mps) << 6) | nlps) & 0xff;
        } else {
          stats[cx] = ((mps << 6) | nlps) & 0xff;
        }
        this.renormalize();
        return d;
      }
    }
  }

  private renormalize(): void {
    while (this.a < 0x8000) {
      if (this.ct === 0) {
        this.byteIn();
      }
      this.a = (this.a << 1) & 0xffff;
      this.c = (this.c << 1) >>> 0;
      this.ct--;
    }
  }
}

// ---------------------------------------------------------------------------
// Integer Arithmetic Decoder (JBIG2 Annex A)
// ---------------------------------------------------------------------------

/**
 * Decodes signed integers using the JBIG2 arithmetic integer procedure.
 *
 * The procedure uses a 9-bit context model (512 entries) with a
 * unary-coded magnitude prefix followed by fixed-width magnitude bits.
 *
 * Returns `null` for OOB (out-of-band), which signals the end of a
 * data structure (e.g. end of a height class in a symbol dictionary).
 *
 * @internal
 */
class IntegerDecoder {
  private readonly stats = new Uint8Array(512);

  decode(decoder: ArithmeticDecoder): number | null {
    let prev = 1;

    const readBits = (n: number): number => {
      let v = 0;
      for (let i = 0; i < n; i++) {
        const bit = decoder.decodeBit(this.stats, prev);
        prev = prev < 256 ? (prev << 1) | bit : (((prev << 1) | bit) & 511) | 256;
        v = (v << 1) | bit;
      }
      return v;
    };

    const sign = readBits(1);

    let value: number;
    if (readBits(1) === 0) {
      value = readBits(2);                  // [0, 3]
    } else if (readBits(1) === 0) {
      value = readBits(2) + 4;              // [4, 7]
    } else if (readBits(1) === 0) {
      value = readBits(4) + 20;             // [20, 35]
    } else if (readBits(1) === 0) {
      value = readBits(8) + 84;             // [84, 339]
    } else if (readBits(1) === 0) {
      value = readBits(12) + 340;           // [340, 4435]
    } else {
      value = readBits(32) + 4436;          // [4436, ...]
    }

    if (sign) {
      return value > 0 ? -value : null;     // null = OOB
    }
    return value;
  }
}

// ---------------------------------------------------------------------------
// IAID Decoder (Integer Arithmetic ID)
// ---------------------------------------------------------------------------

/**
 * Decodes symbol IDs using a fixed-width binary arithmetic code.
 *
 * The number of bits is `ceil(log2(numSymbols))` and determines
 * the context size (2^(codeLen+1) entries).
 *
 * @internal
 */
class IAIDDecoder {
  private readonly stats: Uint8Array;
  private readonly codeLen: number;

  constructor(codeLen: number) {
    this.codeLen = codeLen;
    this.stats = new Uint8Array(1 << (codeLen + 1));
  }

  decode(decoder: ArithmeticDecoder): number {
    let prev = 1;
    for (let i = 0; i < this.codeLen; i++) {
      const bit = decoder.decodeBit(this.stats, prev);
      prev = (prev << 1) | bit;
    }
    // Remove the leading 1 that was used as the initial context
    return prev - (1 << this.codeLen);
  }
}

// ---------------------------------------------------------------------------
// Generic bitmap decoder (shared ArithmeticDecoder variant)
// ---------------------------------------------------------------------------

/**
 * Decode a bitmap using an existing ArithmeticDecoder.
 *
 * Unlike `decodeArithmeticGenericRegion` which creates its own decoder
 * from raw bytes, this function shares a decoder with the calling
 * context (e.g. symbol dictionary decoding where all symbols share
 * one arithmetic stream).
 *
 * @internal
 */
function decodeGenericBitmap(
  decoder: ArithmeticDecoder,
  width: number,
  height: number,
  templateId: number,
): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const output = new Uint8Array(rowBytes * height);

  const contextSize = templateId === 0 ? 16 : templateId === 1 ? 13 : 10;
  const stats = new Uint8Array(1 << contextSize);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cx = buildGenericContext(output, rowBytes, width, row, col, templateId);
      const pixel = decoder.decodeBit(stats, cx);

      if (pixel) {
        const byteIdx = row * rowBytes + (col >>> 3);
        const bitIdx = 7 - (col & 7);
        output[byteIdx] = (output[byteIdx]! | (1 << bitIdx)) & 0xff;
      }
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Bitmap composition helper
// ---------------------------------------------------------------------------

/**
 * Compose a source bitmap onto a destination bitmap at position (x, y).
 *
 * This is a standalone version of the JBIG2Decoder.composeRegion method
 * for composing symbol bitmaps onto region bitmaps during text region
 * decoding.
 *
 * @internal
 */
function composeBitmapOnto(
  dstBitmap: Uint8Array,
  dstWidth: number,
  dstHeight: number,
  srcBitmap: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  x: number,
  y: number,
  operator: number,
): void {
  const dstRowBytes = Math.ceil(dstWidth / 8);
  const srcRowBytes = Math.ceil(srcWidth / 8);

  for (let row = 0; row < srcHeight; row++) {
    const dstY = y + row;
    if (dstY < 0 || dstY >= dstHeight) continue;

    for (let col = 0; col < srcWidth; col++) {
      const dstX = x + col;
      if (dstX < 0 || dstX >= dstWidth) continue;

      // Get source pixel
      const srcByteIdx = row * srcRowBytes + (col >>> 3);
      const srcBitIdx = 7 - (col & 7);
      const srcPixel = (srcBitmap[srcByteIdx]! >>> srcBitIdx) & 1;

      // Get destination pixel
      const dstByteIdx = dstY * dstRowBytes + (dstX >>> 3);
      const dstBitIdx = 7 - (dstX & 7);
      const dstPixel = (dstBitmap[dstByteIdx]! >>> dstBitIdx) & 1;

      // Apply combination operator
      let result: number;
      switch (operator) {
        case 0: result = dstPixel | srcPixel; break;        // OR
        case 1: result = dstPixel & srcPixel; break;        // AND
        case 2: result = dstPixel ^ srcPixel; break;        // XOR
        case 3: result = (dstPixel ^ srcPixel) ^ 1; break;  // XNOR
        case 4: default: result = srcPixel; break;           // REPLACE
      }

      if (result) {
        dstBitmap[dstByteIdx] = (dstBitmap[dstByteIdx]! | (1 << dstBitIdx)) & 0xff;
      } else {
        dstBitmap[dstByteIdx] = dstBitmap[dstByteIdx]! & ~(1 << dstBitIdx) & 0xff;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Generic Refinement bitmap decoder
// ---------------------------------------------------------------------------

/**
 * Decode a refinement region bitmap.
 *
 * The refinement procedure uses pixels from both the reference bitmap
 * and the current (being-decoded) bitmap to build the context for
 * arithmetic coding.
 *
 * @internal
 */
function decodeRefinementBitmap(
  data: Uint8Array,
  width: number,
  height: number,
  templateId: number,
  refBitmap: Uint8Array,
  refWidth: number,
  refHeight: number,
): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const refRowBytes = Math.ceil(refWidth / 8);
  const output = new Uint8Array(rowBytes * height);

  const decoder = new ArithmeticDecoder(data);

  // Context size: template 0 = 13 bits, template 1 = 10 bits
  const contextSize = templateId === 0 ? 13 : 10;
  const stats = new Uint8Array(1 << contextSize);

  function getPixel(bitmap: Uint8Array, rBytes: number, r: number, c: number, w: number, h: number): number {
    if (r < 0 || c < 0 || r >= h || c >= w) return 0;
    return (bitmap[r * rBytes + (c >>> 3)]! >>> (7 - (c & 7))) & 1;
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // Build refinement context from reference + current bitmaps
      let cx = 0;

      if (templateId === 0) {
        // Template 0: 13-bit context
        // Reference bitmap pixels (6 bits)
        cx |= getPixel(refBitmap, refRowBytes, row - 1, col - 1, refWidth, refHeight) << 12;
        cx |= getPixel(refBitmap, refRowBytes, row - 1, col, refWidth, refHeight) << 11;
        cx |= getPixel(refBitmap, refRowBytes, row - 1, col + 1, refWidth, refHeight) << 10;
        cx |= getPixel(refBitmap, refRowBytes, row, col - 1, refWidth, refHeight) << 9;
        cx |= getPixel(refBitmap, refRowBytes, row, col, refWidth, refHeight) << 8;
        cx |= getPixel(refBitmap, refRowBytes, row, col + 1, refWidth, refHeight) << 7;
        cx |= getPixel(refBitmap, refRowBytes, row + 1, col, refWidth, refHeight) << 6;
        // Current bitmap pixels (6 bits)
        cx |= getPixel(output, rowBytes, row - 1, col - 1, width, height) << 5;
        cx |= getPixel(output, rowBytes, row - 1, col, width, height) << 4;
        cx |= getPixel(output, rowBytes, row - 1, col + 1, width, height) << 3;
        cx |= getPixel(output, rowBytes, row, col - 1, width, height) << 2;
        // AT pixels (default positions)
        cx |= getPixel(refBitmap, refRowBytes, row + 1, col - 1, refWidth, refHeight) << 1;
        cx |= getPixel(refBitmap, refRowBytes, row + 1, col + 1, refWidth, refHeight);
      } else {
        // Template 1: 10-bit context
        cx |= getPixel(refBitmap, refRowBytes, row - 1, col, refWidth, refHeight) << 9;
        cx |= getPixel(refBitmap, refRowBytes, row - 1, col + 1, refWidth, refHeight) << 8;
        cx |= getPixel(refBitmap, refRowBytes, row, col - 1, refWidth, refHeight) << 7;
        cx |= getPixel(refBitmap, refRowBytes, row, col, refWidth, refHeight) << 6;
        cx |= getPixel(refBitmap, refRowBytes, row, col + 1, refWidth, refHeight) << 5;
        cx |= getPixel(refBitmap, refRowBytes, row + 1, col, refWidth, refHeight) << 4;
        cx |= getPixel(output, rowBytes, row - 1, col, width, height) << 3;
        cx |= getPixel(output, rowBytes, row - 1, col + 1, width, height) << 2;
        cx |= getPixel(output, rowBytes, row, col - 1, width, height) << 1;
        cx |= getPixel(refBitmap, refRowBytes, row + 1, col - 1, refWidth, refHeight);
      }

      const pixel = decoder.decodeBit(stats, cx);

      if (pixel) {
        const byteIdx = row * rowBytes + (col >>> 3);
        const bitIdx = 7 - (col & 7);
        output[byteIdx] = (output[byteIdx]! | (1 << bitIdx)) & 0xff;
      }
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Utility: big-endian readers
// ---------------------------------------------------------------------------

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

function readInt32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! << 24) |
    (data[offset + 1]! << 16) |
    (data[offset + 2]! << 8) |
    data[offset + 3]!
  );
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return ((data[offset]! << 8) | data[offset + 1]!) >>> 0;
}

/**
 * Sign-extend a value from a given bit width to a signed 32-bit integer.
 * @internal
 */
function signExtend(value: number, bits: number): number {
  const sign = 1 << (bits - 1);
  return (value ^ sign) - sign;
}
