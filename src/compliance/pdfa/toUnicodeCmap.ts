/**
 * @module compliance/pdfa/toUnicodeCmap
 *
 * ToUnicode CMap generator for PDF/A compliance.
 *
 * PDF/A-2u (and higher) requires every font to have a ToUnicode CMap
 * so that text can be extracted from the PDF. The standard 14 fonts
 * don't normally include this, so we generate it.
 *
 * A ToUnicode CMap maps character codes to Unicode code points:
 *
 * ```
 * /CMapType 2 def
 * 1 begincodespacerange
 * <00> <FF>
 * endcodespacerange
 * N beginbfchar
 * <XX> <UUUU>
 * endbfchar
 * ```
 *
 * Three encodings are supported, with the code to Unicode tables the
 * standard fonts write their text with (assets/font/internal/standardEncoding):
 * - **WinAnsiEncoding** (Windows-1252): used by the 12 Latin standard fonts
 * - **SymbolEncoding**: the built-in encoding of Symbol
 * - **ZapfDingbatsEncoding**: the built-in encoding of ZapfDingbats
 *
 * Reference: ISO 32000, 9.10.3 (ToUnicode CMaps) and Annex D.
 */

import { STANDARD_CODE_TO_UNICODE } from '../../assets/font/internal/standardEncoding.js';

// ---------------------------------------------------------------------------
// CMap generation
// ---------------------------------------------------------------------------

/**
 * Build a CMap string from a code to Unicode table (index = character code,
 * `undefined` = no entry).
 *
 * Entries are chunked into blocks of at most 100 `bfchar` mappings,
 * as required by the CMap specification.
 */
function buildCmapString(table: ReadonlyArray<number | undefined>): string {
  const entries: string[] = [];

  // Codes in ascending order for deterministic output
  table.forEach((unicode, code) => {
    if (unicode === undefined) return;
    const codeHex = code.toString(16).padStart(2, '0').toUpperCase();
    const unicodeHex = unicode.toString(16).padStart(4, '0').toUpperCase();
    entries.push(`<${codeHex}> <${unicodeHex}>`);
  });

  // Split into chunks of 100 (CMap spec allows max 100 per bfchar block)
  const chunks: string[][] = [];
  for (let i = 0; i < entries.length; i += 100) {
    chunks.push(entries.slice(i, i + 100));
  }

  let cmap = '/CIDInit /ProcSet findresource begin\n';
  cmap += '12 dict begin\n';
  cmap += 'begincmap\n';
  cmap += '/CIDSystemInfo\n';
  cmap += '<< /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n';
  cmap += '/CMapName /Adobe-Identity-UCS def\n';
  cmap += '/CMapType 2 def\n';
  cmap += '1 begincodespacerange\n';
  cmap += '<00> <FF>\n';
  cmap += 'endcodespacerange\n';

  for (const chunk of chunks) {
    cmap += `${chunk.length} beginbfchar\n`;
    cmap += chunk.join('\n') + '\n';
    cmap += 'endbfchar\n';
  }

  cmap += 'endcmap\n';
  cmap += 'CMapName currentdict /CMap defineresource pop\n';
  cmap += 'end\n';
  cmap += 'end\n';

  return cmap;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a ToUnicode CMap string for a standard WinAnsi-encoded font.
 *
 * WinAnsi (Windows-1252) is the default encoding for the 12 Latin
 * standard 14 fonts (all except Symbol and ZapfDingbats).
 * This maps each code of WinAnsiEncoding (32–255, 218 codes) to its
 * Unicode value, and also maps 0x7F to U+007F as earlier releases did,
 * although WinAnsiEncoding has no glyph there.
 *
 * @returns A complete CMap program as a string.
 */
export function generateWinAnsiToUnicodeCmap(): string {
  const table = STANDARD_CODE_TO_UNICODE.WinAnsiEncoding.with(0x7f, 0x7f);
  return buildCmapString(table);
}

/**
 * Generate a ToUnicode CMap for the Symbol font.
 *
 * The Symbol font uses the Adobe Symbol encoding, which maps
 * character codes to Greek letters, mathematical symbols, and
 * other special characters.
 *
 * @returns A complete CMap program as a string.
 */
export function generateSymbolToUnicodeCmap(): string {
  return buildCmapString(STANDARD_CODE_TO_UNICODE.SymbolEncoding);
}

/**
 * Generate a ToUnicode CMap for the ZapfDingbats font.
 *
 * The ZapfDingbats font uses its own built-in encoding that maps
 * character codes to decorative symbols, arrows, and ornaments.
 *
 * @returns A complete CMap program as a string.
 */
export function generateZapfDingbatsToUnicodeCmap(): string {
  return buildCmapString(STANDARD_CODE_TO_UNICODE.ZapfDingbatsEncoding);
}

/**
 * Get the appropriate ToUnicode CMap for a standard 14 font.
 *
 * - Symbol → Symbol encoding CMap
 * - ZapfDingbats → ZapfDingbats encoding CMap
 * - All others → WinAnsi (Windows-1252) encoding CMap
 *
 * @param fontName  The PDF base font name (e.g. `'Helvetica'`, `'Symbol'`).
 * @returns         A complete CMap program as a string.
 */
export function getToUnicodeCmap(fontName: string): string {
  if (fontName === 'Symbol') return generateSymbolToUnicodeCmap();
  if (fontName === 'ZapfDingbats') return generateZapfDingbatsToUnicodeCmap();
  return generateWinAnsiToUnicodeCmap();
}
