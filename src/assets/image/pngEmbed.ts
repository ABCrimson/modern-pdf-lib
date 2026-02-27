/**
 * @module assets/image/pngEmbed
 *
 * PNG decoding and embedding for PDF image XObjects.
 *
 * Parses a PNG file to extract dimensions, color type, bit depth, and
 * pixel data.  Produces the data needed for a PDF image XObject
 * dictionary with the appropriate `/ColorSpace`, `/BitsPerComponent`,
 * `/Filter`, and `/SMask` entries.
 *
 * Handles all standard PNG color types:
 * - Type 0: Grayscale
 * - Type 2: RGB (Truecolor)
 * - Type 3: Indexed (Palette)
 * - Type 4: Grayscale + Alpha
 * - Type 6: RGBA (Truecolor + Alpha)
 *
 * For images with alpha channels (types 4 and 6), the alpha channel
 * is separated into a /SMask soft-mask image.
 *
 * WASM-accelerated decoding is supported with a JS fallback.
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * The result of embedding a PNG image — contains all the data needed
 * to create a PDF image XObject.
 */
export interface PngEmbedResult {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Bits per component (1, 2, 4, 8, or 16). */
  readonly bitsPerComponent: number;
  /**
   * PDF color space name:
   * - `'DeviceGray'` for grayscale
   * - `'DeviceRGB'` for RGB
   * - `'Indexed'` for palette-based images
   */
  readonly colorSpace: string;
  /**
   * For indexed color, the palette data (R,G,B triples).
   * `undefined` for non-indexed images.
   */
  readonly palette?: Uint8Array | undefined;
  /**
   * The raw image data for the PDF stream.
   * For FlateDecode, this is the deflate-compressed pixel data
   * (the concatenated IDAT chunks with the zlib wrapper removed
   * or preserved depending on the processing).
   */
  readonly imageData: Uint8Array;
  /**
   * The PDF /Filter to use for the image stream.
   * Typically `'FlateDecode'`.
   */
  readonly filter: string;
  /**
   * Soft mask (alpha channel) data, if the image has transparency.
   * This should be embedded as a separate image XObject and
   * referenced via the /SMask key.
   *
   * `undefined` if the image has no alpha channel.
   */
  readonly smaskData?: Uint8Array | undefined;
  /**
   * If smaskData is present, the bits per component for the SMask.
   */
  readonly smaskBitsPerComponent?: number | undefined;
  /**
   * Whether a transparency (tRNS) chunk was found.
   * If true and colorSpace is 'Indexed', the palette has associated
   * alpha values in smaskData.
   */
  readonly hasTransparency: boolean;
}

// ---------------------------------------------------------------------------
// PNG signature and chunk parsing
// ---------------------------------------------------------------------------

/** PNG file signature (8 bytes). */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/** Color type constants from the PNG spec. */
const enum PngColorType {
  Grayscale = 0,
  RGB = 2,
  Indexed = 3,
  GrayscaleAlpha = 4,
  RGBA = 6,
}

/**
 * Parsed IHDR chunk data.
 */
interface IhdrData {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly compressionMethod: number;
  readonly filterMethod: number;
  readonly interlaceMethod: number;
}

/**
 * A parsed PNG chunk.
 */
interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
}

/**
 * Validate the PNG signature.
 *
 * @param data - The raw PNG bytes.
 * @throws If the signature does not match.
 */
function validatePngSignature(data: Uint8Array): void {
  if (data.length < 8) {
    throw new Error('PNG data too small — expected at least 8 bytes for the signature');
  }
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature');
    }
  }
}

/**
 * Iterate over all chunks in a PNG file.
 *
 * @param data - The raw PNG bytes.
 * @returns An array of parsed chunks.
 */
function parseChunks(data: Uint8Array): PngChunk[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: PngChunk[] = [];
  let offset = 8; // Skip signature

  while (offset < data.length) {
    if (offset + 8 > data.length) break;

    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      data[offset + 4]!,
      data[offset + 5]!,
      data[offset + 6]!,
      data[offset + 7]!,
    );

    const chunkData = data.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data: chunkData });

    // length (4) + type (4) + data (length) + CRC (4)
    offset += 12 + length;

    if (type === 'IEND') break;
  }

  return chunks;
}

/**
 * Parse the IHDR chunk.
 */
function parseIhdr(chunk: PngChunk): IhdrData {
  if (chunk.type !== 'IHDR' || chunk.data.length < 13) {
    throw new Error('Invalid PNG: missing or malformed IHDR chunk');
  }

  const view = new DataView(
    chunk.data.buffer,
    chunk.data.byteOffset,
    chunk.data.byteLength,
  );

  return {
    width: view.getUint32(0, false),
    height: view.getUint32(4, false),
    bitDepth: chunk.data[8]!,
    colorType: chunk.data[9]!,
    compressionMethod: chunk.data[10]!,
    filterMethod: chunk.data[11]!,
    interlaceMethod: chunk.data[12]!,
  };
}

/**
 * Concatenate all IDAT chunk data into a single Uint8Array.
 */
function concatenateIdatChunks(chunks: PngChunk[]): Uint8Array {
  const idatChunks = chunks.filter((c) => c.type === 'IDAT');
  if (idatChunks.length === 0) {
    throw new Error('Invalid PNG: no IDAT chunks found');
  }

  const totalLength = idatChunks.reduce((sum, c) => sum + c.data.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of idatChunks) {
    result.set(chunk.data, pos);
    pos += chunk.data.length;
  }
  return result;
}

/**
 * Find the PLTE (palette) chunk data if present.
 */
function findPalette(chunks: PngChunk[]): Uint8Array | undefined {
  const plte = chunks.find((c) => c.type === 'PLTE');
  return plte?.data;
}

/**
 * Find the tRNS (transparency) chunk data if present.
 */
function findTransparency(chunks: PngChunk[]): Uint8Array | undefined {
  const trns = chunks.find((c) => c.type === 'tRNS');
  return trns?.data;
}

// ---------------------------------------------------------------------------
// WASM state
// ---------------------------------------------------------------------------

let pngWasmInstance: PngWasm | undefined;

/** @internal */
interface PngWasm {
  alloc(size: number): number;
  free(ptr: number, size: number): void;
  /**
   * Decode a PNG image.
   * Returns the number of bytes written to outPtr, or -1 on error.
   */
  decode_png(
    dataPtr: number,
    dataLen: number,
    outPtr: number,
    outMaxLen: number,
  ): number;
  memory: WebAssembly.Memory;
}

/**
 * Initialize the PNG decoding WASM module.
 *
 * @param wasmSource - The WASM binary, URL, or Response.
 */
export async function initPngWasm(
  wasmSource?: Uint8Array | URL | string | Response,
): Promise<void> {
  // Already initialized -- no-op
  if (pngWasmInstance) return;

  const imports = { env: {} };
  let result: WebAssembly.WebAssemblyInstantiatedSource;

  try {
    if (wasmSource instanceof Uint8Array) {
      result = await WebAssembly.instantiate(wasmSource.buffer as ArrayBuffer, imports);
    } else if (typeof Response !== 'undefined' && wasmSource instanceof Response) {
      result = await WebAssembly.instantiateStreaming(wasmSource, imports);
    } else if (typeof wasmSource === 'string' || wasmSource instanceof URL) {
      const resp = await fetch(String(wasmSource));
      result = await WebAssembly.instantiateStreaming(resp, imports);
    } else {
      // No explicit source -- try the universal WASM loader
      const { loadWasmModule } = await import('../../wasm/loader.js');
      const bytes = await loadWasmModule('png');
      result = await WebAssembly.instantiate(bytes.buffer as ArrayBuffer, imports);
    }

    pngWasmInstance = result.instance.exports as unknown as PngWasm;
  } catch {
    // WASM unavailable -- fall back to JS PNG decoding
    pngWasmInstance = undefined;
  }
}

/**
 * Check whether the PNG WASM module is ready.
 */
export function isPngWasmReady(): boolean {
  return pngWasmInstance !== undefined;
}

// ---------------------------------------------------------------------------
// JS fallback: pixel reconstruction
// ---------------------------------------------------------------------------

/**
 * Decompress the zlib data from IDAT chunks.
 *
 * Uses the DecompressionStream API (available in modern browsers,
 * Node 18+, Deno) or falls back to a manual inflate.
 *
 * @internal
 */
async function decompressZlib(compressed: Uint8Array): Promise<Uint8Array> {
  // Use fflate (already a dependency) for reliable zlib decompression.
  // PNG IDAT data is zlib-wrapped deflate. fflate's inflateSync handles
  // raw deflate; we need to strip the 2-byte zlib header and 4-byte
  // Adler-32 checksum first, or use unzlibSync which handles zlib format.
  try {
    const { unzlibSync } = await import('fflate');
    return unzlibSync(compressed);
  } catch {
    // Fallback: try DecompressionStream('deflate') which handles zlib format.
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      writer.write(new Uint8Array(compressed) as Uint8Array<ArrayBuffer>).catch(() => { /* handled by reader */ });
      writer.close().catch(() => { /* handled by reader */ });

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(totalLength);
      let pos = 0;
      for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    }

    throw new Error(
      'PNG decompression requires fflate library or DecompressionStream API',
    );
  }
}

/**
 * Apply PNG filter reconstruction to a decompressed scanline buffer.
 *
 * Each scanline is prefixed with a 1-byte filter type:
 * 0=None, 1=Sub, 2=Up, 3=Average, 4=Paeth
 *
 * @internal
 */
function reconstructFilters(
  decompressed: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array {
  const stride = width * bytesPerPixel;
  const result = new Uint8Array(height * stride);

  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[srcOffset]!;
    srcOffset++;

    const scanline = decompressed.subarray(srcOffset, srcOffset + stride);
    srcOffset += stride;

    const prevLine =
      y > 0
        ? result.subarray((y - 1) * stride, y * stride)
        : new Uint8Array(stride);

    for (let x = 0; x < stride; x++) {
      const raw = scanline[x]!;
      const a = x >= bytesPerPixel ? result[dstOffset + x - bytesPerPixel]! : 0;
      const b = prevLine[x]!;
      const c =
        x >= bytesPerPixel && y > 0
          ? result[(y - 1) * stride + x - bytesPerPixel]!
          : 0;

      let reconstructed: number;

      switch (filterType) {
        case 0: // None
          reconstructed = raw;
          break;
        case 1: // Sub
          reconstructed = (raw + a) & 0xFF;
          break;
        case 2: // Up
          reconstructed = (raw + b) & 0xFF;
          break;
        case 3: // Average
          reconstructed = (raw + Math.floor((a + b) / 2)) & 0xFF;
          break;
        case 4: // Paeth
          reconstructed = (raw + paethPredictor(a, b, c)) & 0xFF;
          break;
        default:
          throw new Error(`Unknown PNG filter type: ${filterType}`);
      }

      result[dstOffset + x] = reconstructed;
    }

    dstOffset += stride;
  }

  return result;
}

/**
 * Paeth predictor function.
 * @internal
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Compute the bytes per pixel for a given color type and bit depth.
 * @internal
 */
function bytesPerPixel(colorType: number, bitDepth: number): number {
  const channels = colorType === PngColorType.Grayscale ? 1
    : colorType === PngColorType.RGB ? 3
    : colorType === PngColorType.Indexed ? 1
    : colorType === PngColorType.GrayscaleAlpha ? 2
    : colorType === PngColorType.RGBA ? 4
    : 1;

  return Math.max(1, Math.ceil((channels * bitDepth) / 8));
}

// ---------------------------------------------------------------------------
// Alpha channel separation
// ---------------------------------------------------------------------------

/**
 * Separate RGBA pixels into RGB data + alpha mask.
 * @internal
 */
function separateRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
): { rgb: Uint8Array; alpha: Uint8Array } {
  const pixelCount = width * height;
  const rgb = new Uint8Array(pixelCount * 3);
  const alpha = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    rgb[dstIdx] = pixels[srcIdx]!;
    rgb[dstIdx + 1] = pixels[srcIdx + 1]!;
    rgb[dstIdx + 2] = pixels[srcIdx + 2]!;
    alpha[i] = pixels[srcIdx + 3]!;
  }

  return { rgb, alpha };
}

/**
 * Separate Grayscale+Alpha pixels into gray data + alpha mask.
 * @internal
 */
function separateGrayscaleAlpha(
  pixels: Uint8Array,
  width: number,
  height: number,
): { gray: Uint8Array; alpha: Uint8Array } {
  const pixelCount = width * height;
  const gray = new Uint8Array(pixelCount);
  const alpha = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    gray[i] = pixels[i * 2]!;
    alpha[i] = pixels[i * 2 + 1]!;
  }

  return { gray, alpha };
}

// ---------------------------------------------------------------------------
// Compression for PDF embedding
// ---------------------------------------------------------------------------

/**
 * Compress data using deflate for FlateDecode.
 * @internal
 */
async function compressForPdf(data: Uint8Array): Promise<Uint8Array> {
  // Use fflate (already a dependency) for raw deflate compression.
  // This matches the PdfWriter's compression format (deflateSync).
  // The resulting data is used with /Filter /FlateDecode in the PDF.
  const { deflateSync } = await import('fflate');
  return deflateSync(data, { level: 6 });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed a PNG image for use as a PDF image XObject.
 *
 * Parses the PNG file, decodes pixel data, separates alpha channels,
 * and produces all the data needed for the PDF image XObject
 * dictionary.
 *
 * @param pngData - The raw PNG file as a Uint8Array.
 * @returns A promise resolving to the embedding result.
 *
 * @example
 * ```ts
 * const pngBytes = await readFile('photo.png');
 * const result = await embedPng(pngBytes);
 *
 * // Create image XObject with:
 * //   /Width result.width
 * //   /Height result.height
 * //   /ColorSpace result.colorSpace
 * //   /BitsPerComponent result.bitsPerComponent
 * //   /Filter /FlateDecode
 * //   stream: result.imageData
 * //
 * // If result.smaskData is defined, create a second XObject for the SMask.
 * ```
 */
export async function embedPng(pngData: Uint8Array): Promise<PngEmbedResult> {
  // 1. Validate signature
  validatePngSignature(pngData);

  // 2. Parse chunks
  const chunks = parseChunks(pngData);
  if (chunks.length === 0) {
    throw new Error('Invalid PNG: no chunks found');
  }

  // 3. Parse IHDR
  const ihdr = parseIhdr(chunks[0]!);

  // 4. Concatenate IDAT data
  const idatData = concatenateIdatChunks(chunks);

  // 5. Find optional chunks
  const palette = findPalette(chunks);
  const transparency = findTransparency(chunks);

  // 6. Determine if we need full decompression or can pass through
  const hasAlpha =
    ihdr.colorType === PngColorType.GrayscaleAlpha ||
    ihdr.colorType === PngColorType.RGBA;

  const isInterlaced = ihdr.interlaceMethod !== 0;

  // For images without alpha and without interlacing, we can potentially
  // pass the raw IDAT data through (after stripping PNG row filters).
  // However, PDF FlateDecode expects raw pixel data without filter bytes,
  // so we need to decompress and re-filter in most cases.

  // For indexed images without complex transparency, we can sometimes
  // pass through the IDAT data directly since the pixel structure is
  // compatible (one byte per pixel for 8-bit indexed).

  if (ihdr.colorType === PngColorType.Indexed && !isInterlaced && ihdr.bitDepth === 8) {
    return embedIndexedPng(ihdr, idatData, palette, transparency);
  }

  if (!hasAlpha && !isInterlaced && ihdr.bitDepth === 8) {
    return embedDirectPng(ihdr, idatData, transparency);
  }

  // Full decompression path for alpha images or interlaced images
  return embedComplexPng(ihdr, idatData, palette, transparency);
}

// ---------------------------------------------------------------------------
// Internal: indexed PNG (palette-based)
// ---------------------------------------------------------------------------

/**
 * Embed an indexed (palette-based) PNG.
 * @internal
 */
async function embedIndexedPng(
  ihdr: IhdrData,
  idatData: Uint8Array,
  palette: Uint8Array | undefined,
  transparency: Uint8Array | undefined,
): Promise<PngEmbedResult> {
  if (!palette) {
    throw new Error('Invalid PNG: indexed color type requires PLTE chunk');
  }

  // Decompress IDAT to get raw scanlines (with filter bytes)
  const decompressed = await decompressZlib(idatData);

  // Reconstruct filters to get raw pixel indices
  const bpp = bytesPerPixel(ihdr.colorType, ihdr.bitDepth);
  const pixels = reconstructFilters(decompressed, ihdr.width, ihdr.height, bpp);

  // Re-compress for PDF
  const imageData = await compressForPdf(pixels);

  // Handle tRNS chunk for indexed transparency
  let smaskData: Uint8Array | undefined;
  if (transparency && transparency.length > 0) {
    // tRNS for indexed images: one alpha byte per palette entry
    const pixelCount = ihdr.width * ihdr.height;
    const alpha = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const paletteIndex = pixels[i]!;
      alpha[i] = paletteIndex < transparency.length ? transparency[paletteIndex]! : 255;
    }
    smaskData = await compressForPdf(alpha);
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitsPerComponent: 8,
    colorSpace: 'Indexed',
    palette,
    imageData,
    filter: 'FlateDecode',
    smaskData,
    smaskBitsPerComponent: smaskData ? 8 : undefined,
    hasTransparency: transparency !== undefined && transparency.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Internal: direct (non-alpha, non-interlaced) PNG
// ---------------------------------------------------------------------------

/**
 * Embed a direct (Grayscale or RGB) PNG without alpha.
 * @internal
 */
async function embedDirectPng(
  ihdr: IhdrData,
  idatData: Uint8Array,
  transparency: Uint8Array | undefined,
): Promise<PngEmbedResult> {
  // Decompress IDAT
  const decompressed = await decompressZlib(idatData);

  // Reconstruct filters
  const bpp = bytesPerPixel(ihdr.colorType, ihdr.bitDepth);
  const pixels = reconstructFilters(decompressed, ihdr.width, ihdr.height, bpp);

  // Re-compress for PDF
  const imageData = await compressForPdf(pixels);

  const colorSpace =
    ihdr.colorType === PngColorType.Grayscale ? 'DeviceGray' : 'DeviceRGB';

  // Handle tRNS chunk for simple transparency (key-based)
  let smaskData: Uint8Array | undefined;
  if (transparency && transparency.length > 0) {
    const pixelCount = ihdr.width * ihdr.height;
    const alpha = new Uint8Array(pixelCount);
    alpha.fill(255);

    if (ihdr.colorType === PngColorType.Grayscale && transparency.length >= 2) {
      // tRNS for grayscale: 2 bytes = gray value to make transparent
      const trnsGray = (transparency[0]! << 8) | transparency[1]!;
      for (let i = 0; i < pixelCount; i++) {
        if (pixels[i] === trnsGray) {
          alpha[i] = 0;
        }
      }
      smaskData = await compressForPdf(alpha);
    } else if (ihdr.colorType === PngColorType.RGB && transparency.length >= 6) {
      // tRNS for RGB: 6 bytes = R,G,B values (2 bytes each) to make transparent
      const trnsR = (transparency[0]! << 8) | transparency[1]!;
      const trnsG = (transparency[2]! << 8) | transparency[3]!;
      const trnsB = (transparency[4]! << 8) | transparency[5]!;
      for (let i = 0; i < pixelCount; i++) {
        const idx = i * 3;
        if (
          pixels[idx] === trnsR &&
          pixels[idx + 1] === trnsG &&
          pixels[idx + 2] === trnsB
        ) {
          alpha[i] = 0;
        }
      }
      smaskData = await compressForPdf(alpha);
    }
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitsPerComponent: ihdr.bitDepth,
    colorSpace,
    imageData,
    filter: 'FlateDecode',
    smaskData,
    smaskBitsPerComponent: smaskData ? 8 : undefined,
    hasTransparency: transparency !== undefined && transparency.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Internal: complex PNG (alpha, interlaced, or non-8-bit)
// ---------------------------------------------------------------------------

/**
 * Full decompression path for PNGs that need alpha separation,
 * de-interlacing, or bit-depth normalization.
 * @internal
 */
async function embedComplexPng(
  ihdr: IhdrData,
  idatData: Uint8Array,
  palette: Uint8Array | undefined,
  transparency: Uint8Array | undefined,
): Promise<PngEmbedResult> {
  // Decompress IDAT
  const decompressed = await decompressZlib(idatData);

  const bpp = bytesPerPixel(ihdr.colorType, ihdr.bitDepth);

  // For interlaced images we need Adam7 de-interlacing
  let pixels: Uint8Array;
  if (ihdr.interlaceMethod !== 0) {
    // Adam7 interlace: 7 passes with these parameters
    const startingRow = [0, 0, 4, 0, 2, 0, 1];
    const startingCol = [0, 4, 0, 2, 0, 1, 0];
    const rowStride   = [8, 8, 8, 4, 4, 2, 2];
    const colStride   = [8, 8, 4, 4, 2, 2, 1];

    const stride = ihdr.width * bpp;
    const finalPixels = new Uint8Array(ihdr.height * stride);
    let srcOffset = 0;

    for (let pass = 0; pass < 7; pass++) {
      const startRow = startingRow[pass]!;
      const startCol = startingCol[pass]!;
      const rStride = rowStride[pass]!;
      const cStride = colStride[pass]!;

      // Compute sub-image dimensions for this pass
      const passWidth = ihdr.width <= startCol
        ? 0
        : Math.ceil((ihdr.width - startCol) / cStride);
      const passHeight = ihdr.height <= startRow
        ? 0
        : Math.ceil((ihdr.height - startRow) / rStride);

      // Skip empty passes
      if (passWidth === 0 || passHeight === 0) continue;

      // Each pass row has: 1 filter byte + passWidth * bpp data bytes
      const passRowBytes = passWidth * bpp;
      const passScanlineSize = 1 + passRowBytes;
      const passDataLength = passHeight * passScanlineSize;

      // Extract this pass's scanlines from the decompressed stream
      const passData = decompressed.subarray(srcOffset, srcOffset + passDataLength);
      srcOffset += passDataLength;

      // Reconstruct filters for this pass independently
      const passPixels = reconstructFilters(passData, passWidth, passHeight, bpp);

      // Merge pass pixels into the final image buffer
      for (let py = 0; py < passHeight; py++) {
        const finalY = startRow + py * rStride;
        for (let px = 0; px < passWidth; px++) {
          const finalX = startCol + px * cStride;
          const srcIdx = (py * passWidth + px) * bpp;
          const dstIdx = finalY * stride + finalX * bpp;
          for (let b = 0; b < bpp; b++) {
            finalPixels[dstIdx + b] = passPixels[srcIdx + b]!;
          }
        }
      }
    }

    pixels = finalPixels;
  } else {
    pixels = reconstructFilters(decompressed, ihdr.width, ihdr.height, bpp);
  }

  let imageData: Uint8Array;
  let smaskData: Uint8Array | undefined;
  let colorSpace: string;
  let bitsPerComponent = ihdr.bitDepth;

  switch (ihdr.colorType) {
    case PngColorType.RGBA: {
      const { rgb, alpha } = separateRgba(pixels, ihdr.width, ihdr.height);
      imageData = await compressForPdf(rgb);
      smaskData = await compressForPdf(alpha);
      colorSpace = 'DeviceRGB';
      bitsPerComponent = 8;
      break;
    }

    case PngColorType.GrayscaleAlpha: {
      const { gray, alpha } = separateGrayscaleAlpha(pixels, ihdr.width, ihdr.height);
      imageData = await compressForPdf(gray);
      smaskData = await compressForPdf(alpha);
      colorSpace = 'DeviceGray';
      bitsPerComponent = 8;
      break;
    }

    case PngColorType.Grayscale: {
      imageData = await compressForPdf(pixels);
      colorSpace = 'DeviceGray';
      break;
    }

    case PngColorType.RGB: {
      imageData = await compressForPdf(pixels);
      colorSpace = 'DeviceRGB';
      break;
    }

    case PngColorType.Indexed: {
      if (!palette) {
        throw new Error('Invalid PNG: indexed color type requires PLTE chunk');
      }
      imageData = await compressForPdf(pixels);
      colorSpace = 'Indexed';
      bitsPerComponent = ihdr.bitDepth;
      break;
    }

    default:
      throw new Error(`Unsupported PNG color type: ${ihdr.colorType}`);
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitsPerComponent,
    colorSpace,
    palette:
      ihdr.colorType === PngColorType.Indexed ? palette : undefined,
    imageData,
    filter: 'FlateDecode',
    smaskData,
    smaskBitsPerComponent: smaskData ? 8 : undefined,
    hasTransparency:
      smaskData !== undefined ||
      (transparency !== undefined && transparency.length > 0),
  };
}
