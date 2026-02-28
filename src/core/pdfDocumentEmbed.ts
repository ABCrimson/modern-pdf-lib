/**
 * @module core/pdfDocumentEmbed
 *
 * Pure helper functions for font CMap generation and image format
 * validation/parsing.  Extracted from {@link pdfDocument} to keep the
 * PdfDocument class focused on high-level document management.
 */

// ---------------------------------------------------------------------------
// ToUnicode CMap builder
// ---------------------------------------------------------------------------

/**
 * Build a /ToUnicode CMap from a font's cmap table.
 * Maps glyph IDs (used as CIDs with Identity-H) to Unicode codepoints.
 *
 * @param cmapTable  Mapping from Unicode codepoint to glyph ID.
 * @returns          A CMap string suitable for a PDF /ToUnicode stream.
 */
export function buildToUnicodeCmap(cmapTable: ReadonlyMap<number, number>): string {
  // Build reverse map: glyph ID → Unicode codepoint(s)
  const gidToUnicode = new Map<number, number>();
  for (const [codepoint, gid] of cmapTable) {
    // Keep the first mapping found (prefer lower codepoints)
    if (!gidToUnicode.has(gid)) {
      gidToUnicode.set(gid, codepoint);
    }
  }

  const entries = gidToUnicode.entries().toArray().sort((a, b) => a[0] - b[0]);

  const lines: string[] = [];
  lines.push('/CIDInit /ProcSet findresource begin');
  lines.push('12 dict begin');
  lines.push('begincmap');
  lines.push('/CIDSystemInfo');
  lines.push('<< /Registry (Adobe)');
  lines.push('/Ordering (UCS)');
  lines.push('/Supplement 0');
  lines.push('>> def');
  lines.push('/CMapName /Adobe-Identity-UCS def');
  lines.push('/CMapType 2 def');
  lines.push('1 begincodespacerange');
  lines.push('<0000> <FFFF>');
  lines.push('endcodespacerange');

  // Emit in chunks of 100
  const CHUNK_SIZE = 100;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    lines.push(`${chunk.length} beginbfchar`);
    for (const [gid, codepoint] of chunk) {
      const gidHex = gid.toString(16).padStart(4, '0').toUpperCase();
      const uniHex = codepoint.toString(16).padStart(4, '0').toUpperCase();
      lines.push(`<${gidHex}> <${uniHex}>`);
    }
    lines.push('endbfchar');
  }

  lines.push('endcmap');
  lines.push('CMapName currentdict /CMap defineresource pop');
  lines.push('end');
  lines.push('end');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PNG helpers
// ---------------------------------------------------------------------------

/**
 * Validate a PNG file signature.
 *
 * @param data  The raw file bytes.
 * @throws      If the data is too short or the signature is invalid.
 */
export function validatePngSignature(data: Uint8Array): void {
  if (data.length < 24) {
    throw new Error('Invalid PNG: file too short');
  }
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) {
      throw new Error('Invalid PNG: bad signature');
    }
  }
}

/**
 * Parse width and height from a PNG file's IHDR chunk.
 *
 * @param data  The raw PNG file bytes.
 * @returns     Width and height in pixels.
 */
export function parsePngDimensions(data: Uint8Array): { width: number; height: number } {
  validatePngSignature(data);

  // IHDR chunk starts at offset 8.  Type is at offset 12.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  return { width, height };
}

/**
 * Extract PNG chunks from a PNG file.
 *
 * @param data  The raw PNG file bytes (signature already validated).
 * @returns     Array of chunk objects with type and data.
 */
export function extractPngChunks(
  data: Uint8Array,
): Array<{ type: string; data: Uint8Array }> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: Array<{ type: string; data: Uint8Array }> = [];
  let offset = 8; // Skip PNG signature

  while (offset < data.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      data[offset + 4]!,
      data[offset + 5]!,
      data[offset + 6]!,
      data[offset + 7]!,
    );

    chunks.push({
      type,
      data: data.slice(offset + 8, offset + 8 + length),
    });

    // Move past: length (4) + type (4) + data (length) + CRC (4)
    offset += 12 + length;
  }

  return chunks;
}

/**
 * Extract concatenated IDAT data from a PNG.
 *
 * @param data  The raw PNG file bytes.
 * @returns     The concatenated IDAT payload.
 */
export function extractPngIdatData(data: Uint8Array): Uint8Array {
  const chunks = extractPngChunks(data);
  const idatChunks = chunks.filter(c => c.type === 'IDAT');

  if (idatChunks.length === 0) {
    throw new Error('Invalid PNG: no IDAT chunks found');
  }

  // Concatenate all IDAT chunks
  const totalLength = idatChunks.reduce((sum, c) => sum + c.data.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of idatChunks) {
    result.set(chunk.data, pos);
    pos += chunk.data.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// JPEG helpers
// ---------------------------------------------------------------------------

/**
 * Validate a JPEG file signature (SOI marker).
 *
 * @param data  The raw file bytes.
 * @throws      If the data is too short or the SOI marker is invalid.
 */
export function validateJpegSignature(data: Uint8Array): void {
  if (data.length < 2 || data[0] !== 0xff || data[1] !== 0xd8) {
    throw new Error('Invalid JPEG: bad SOI marker');
  }
}

/**
 * Parse width, height, and component count from a JPEG's SOF marker.
 *
 * @param data  The raw JPEG file bytes.
 * @returns     Width, height, and number of color components.
 */
export function parseJpegDimensions(
  data: Uint8Array,
): { width: number; height: number; components: number } {
  validateJpegSignature(data);

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      throw new Error('Invalid JPEG: expected marker');
    }

    const marker = data[offset + 1]!;

    // SOF markers: 0xC0 – 0xC3, 0xC5 – 0xC7, 0xC9 – 0xCB, 0xCD – 0xCF
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      // SOF data: length (2), precision (1), height (2), width (2), components (1)
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      const components = data[offset + 9]!;
      return { width, height, components };
    }

    // Skip this marker segment
    const segmentLength = view.getUint16(offset + 2, false);
    offset += 2 + segmentLength;
  }

  throw new Error('Invalid JPEG: SOF marker not found');
}
