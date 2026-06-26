/**
 * @module assets/font/cffEmbed
 *
 * Helpers for embedding CFF-based OpenType fonts in PDF documents.
 *
 * CFF (Compact Font Format) data is stored in the "CFF " table of an
 * OpenType font file.  For PDF embedding, we need to extract just the
 * raw CFF table data (not the full OTF wrapper) and embed it as a
 * /FontFile3 stream with /Subtype /CIDFontType0C.
 */

/**
 * Locate an OpenType table by its 4-byte tag.
 *
 * Parses the table directory from the font binary and returns the
 * offset and length of the requested table.
 *
 * @param data - Raw font file bytes.
 * @param tag  - The 4-character table tag (e.g. `'CFF '`, `'head'`).
 * @returns `{ offset, length }` or `undefined` if not found.
 */
export function findTable(data: Uint8Array, tag: string): { offset: number; length: number } | undefined {
  if (data.length < 12) return undefined;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4, false);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > data.length) break;
    const t = String.fromCharCode(data[rec]!, data[rec + 1]!, data[rec + 2]!, data[rec + 3]!);
    if (t === tag) {
      const offset = view.getUint32(rec + 8, false);
      const length = view.getUint32(rec + 12, false);
      return { offset, length };
    }
  }
  return undefined;
}
