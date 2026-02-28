/**
 * @module signature/byteRange
 *
 * ByteRange calculation for PDF digital signatures.
 *
 * A PDF signature works by:
 * 1. Inserting a signature dictionary with a `/Contents` placeholder
 *    (a hex string of zeroes) and a `/ByteRange` array.
 * 2. Computing a hash of the PDF bytes *excluding* the `/Contents`
 *    hex string value.
 * 3. Signing the hash with the signer's private key.
 * 4. Embedding the signature (DER-encoded PKCS#7) into the placeholder.
 *
 * The `/ByteRange` is an array of four integers:
 *   [offsetBefore, lengthBefore, offsetAfter, lengthAfter]
 *
 * Where:
 * - `[offsetBefore .. offsetBefore+lengthBefore)` = bytes before the
 *    `<…>` hex string
 * - `[offsetAfter .. offsetAfter+lengthAfter)` = bytes after the
 *    `<…>` hex string
 *
 * Reference: PDF 1.7 spec, SS12.8.1 (Signature Filtering).
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of ByteRange computation for a prepared PDF.
 */
export interface ByteRangeResult {
  /** The byte range array [offset1, length1, offset2, length2]. */
  byteRange: [number, number, number, number];
  /** Start offset of the /Contents hex string placeholder (the `<`). */
  contentsOffset: number;
  /** Length of the placeholder in bytes (including angle brackets `<…>`). */
  contentsLength: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * Build a minimal signature dictionary string for embedding in a PDF.
 *
 * The dictionary includes:
 * - /Type /Sig
 * - /Filter /Adobe.PPKLite
 * - /SubFilter /adbe.pkcs7.detached
 * - /ByteRange [placeholder]
 * - /Contents <zeroes>
 *
 * The /ByteRange values are placeholders that will be updated after
 * the final byte positions are known.
 */
function buildSignatureDictString(
  placeholderSize: number,
  fieldName: string,
  signingDate?: Date,
): string {
  const contentsHex = '0'.repeat(placeholderSize * 2);
  // Use large placeholder values for ByteRange — will be patched later
  const byteRangePlaceholder = '0000000000 0000000000 0000000000 0000000000';

  let dict = '';
  dict += '<< /Type /Sig';
  dict += ' /Filter /Adobe.PPKLite';
  dict += ' /SubFilter /adbe.pkcs7.detached';
  dict += ` /ByteRange [${byteRangePlaceholder}]`;
  dict += ` /Contents <${contentsHex}>`;

  if (signingDate !== undefined) {
    dict += ` /M (D:${formatPdfDate(signingDate)})`;
  }

  dict += ' >>';
  return dict;
}

/**
 * Format a Date as a PDF date string: YYYYMMDDHHmmSS+HH'mm'
 */
function formatPdfDate(date: Date): string {
  const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
  const year = pad(date.getFullYear(), 4);
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const tzOffset = date.getTimezoneOffset();
  let tz: string;
  if (tzOffset === 0) {
    tz = 'Z';
  } else {
    const sign = tzOffset > 0 ? '-' : '+';
    const absOffset = Math.abs(tzOffset);
    const tzHours = pad(Math.floor(absOffset / 60));
    const tzMinutes = pad(absOffset % 60);
    tz = `${sign}${tzHours}'${tzMinutes}'`;
  }

  return `${year}${month}${day}${hours}${minutes}${seconds}${tz}`;
}

/**
 * Find the byte offset of a needle string in a Uint8Array,
 * searching backward from startOffset.
 */
function findStringBackward(
  data: Uint8Array,
  needle: string,
  startOffset: number,
): number {
  const needleBytes = encoder.encode(needle);
  const len = needleBytes.length;
  for (let i = Math.min(startOffset, data.length - len); i >= 0; i--) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (data[i + j] !== needleBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Find the byte offset of a needle string in a Uint8Array,
 * searching forward from startOffset.
 */
function findStringForward(
  data: Uint8Array,
  needle: string,
  startOffset: number,
): number {
  const needleBytes = encoder.encode(needle);
  const len = needleBytes.length;
  for (let i = startOffset; i <= data.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (data[i + j] !== needleBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Build a PDF content stream for a visible signature appearance.
 *
 * Renders a bordered rectangle with optional background color and
 * text lines rendered in Helvetica.
 *
 * @internal
 */
function buildSignatureAppearanceStream(options: PrepareAppearanceOptions): string {
  const [, , w, h] = options.rect;
  const fontSize = options.fontSize ?? 10;
  const borderWidth = options.borderWidth ?? 1;
  const borderColor = options.borderColor ?? [0, 0, 0];
  const bgColor = options.backgroundColor;
  const lines = options.textLines;

  const ops: string[] = [];

  // Save graphics state
  ops.push('q');

  // Background fill
  if (bgColor) {
    ops.push(`${n(bgColor[0])} ${n(bgColor[1])} ${n(bgColor[2])} rg`);
    ops.push(`0 0 ${n(w)} ${n(h)} re`);
    ops.push('f');
  }

  // Border stroke
  if (borderWidth > 0) {
    ops.push(`${n(borderColor[0])} ${n(borderColor[1])} ${n(borderColor[2])} RG`);
    ops.push(`${n(borderWidth)} w`);
    const bw2 = borderWidth / 2;
    ops.push(`${n(bw2)} ${n(bw2)} ${n(w - borderWidth)} ${n(h - borderWidth)} re`);
    ops.push('S');
  }

  // Text
  if (lines.length > 0) {
    const margin = borderWidth + 4;
    const lineHeight = fontSize * 1.2;

    ops.push('BT');
    ops.push(`/F1 ${n(fontSize)} Tf`);
    ops.push('0 0 0 rg');

    // Start from top-left, descending
    const startY = h - margin - fontSize;
    for (let i = 0; i < lines.length; i++) {
      const y = startY - i * lineHeight;
      if (y < margin) break; // Don't overflow the box
      ops.push(`${n(margin)} ${n(y)} Td`);
      ops.push(`(${escapePdfString(lines[i]!)}) Tj`);
      // Reset position for absolute positioning on next line
      ops.push(`${n(-margin)} ${n(-y)} Td`);
    }
    ops.push('ET');
  }

  // Restore graphics state
  ops.push('Q');

  return ops.join('\n');
}

/**
 * Escape a string for use inside a PDF literal string `(...)`.
 * @internal
 */
function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Format a number for PDF operators (max 6 decimal places, no trailing zeros).
 * @internal
 */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(6).replace(/\.?0+$/, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepare a PDF for signing by appending a signature dictionary
 * via incremental update.
 *
 * This function:
 * 1. Appends a new signature field and value to the PDF
 * 2. Inserts an empty `/Contents` placeholder of the specified size
 * 3. Computes the `/ByteRange` that excludes the `/Contents` value
 *
 * The resulting PDF bytes can be hashed (excluding the placeholder gap)
 * and the hash can be signed.
 *
 * @param pdfBytes           The original PDF file bytes.
 * @param signatureFieldName The name for the signature field.
 * @param placeholderSize    Size in bytes for the signature. Default 8192.
 * @returns                  The prepared PDF and ByteRange info.
 */
/**
 * Options for visible signature appearance within the byte-range preparation.
 * @internal
 */
export interface PrepareAppearanceOptions {
  /** Page rectangle [x, y, width, height]. */
  rect: [number, number, number, number];
  /** Lines of text to render inside the signature box. */
  textLines: string[];
  /** Font size. Default: 10. */
  fontSize?: number | undefined;
  /** Background [r,g,b]. Default: none. */
  backgroundColor?: [number, number, number] | undefined;
  /** Border [r,g,b]. Default: [0,0,0]. */
  borderColor?: [number, number, number] | undefined;
  /** Border width. Default: 1. */
  borderWidth?: number | undefined;
}

export function prepareForSigning(
  pdfBytes: Uint8Array,
  signatureFieldName: string,
  placeholderSize: number = 8192,
  appearance?: PrepareAppearanceOptions | undefined,
): { preparedPdf: Uint8Array; byteRange: ByteRangeResult } {
  // Step 1: Find the original trailer/xref info
  const pdfStr = decoder.decode(pdfBytes);

  // Find startxref offset
  const startxrefIdx = pdfStr.lastIndexOf('startxref');
  if (startxrefIdx === -1) {
    throw new Error('Cannot find startxref in PDF — file may be corrupted');
  }

  const afterStartxref = pdfStr.substring(startxrefIdx + 9).trim();
  const xrefOffsetMatch = afterStartxref.match(/^(\d+)/);
  if (!xrefOffsetMatch) {
    throw new Error('Cannot parse xref offset from startxref');
  }
  const prevXrefOffset = parseInt(xrefOffsetMatch[1]!, 10);

  // Find /Size in trailer
  const sizeMatch = pdfStr.match(/\/Size\s+(\d+)/);
  if (!sizeMatch) {
    throw new Error('Cannot find /Size in PDF trailer');
  }
  const originalSize = parseInt(sizeMatch[1]!, 10);

  // Find /Root reference
  const rootMatch = pdfStr.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  if (!rootMatch) {
    throw new Error('Cannot find /Root in PDF trailer');
  }
  const rootObjNum = parseInt(rootMatch[1]!, 10);
  const rootGenNum = parseInt(rootMatch[2]!, 10);

  // Find /Info reference (optional)
  const infoMatch = pdfStr.match(/\/Info\s+(\d+)\s+(\d+)\s+R/);

  // Allocate new object numbers
  const sigValueObjNum = originalSize;     // Signature value dict
  const sigFieldObjNum = originalSize + 1; // Signature field (Widget)
  let apStreamObjNum = -1;
  let newSize = originalSize + 2;

  // If we have a visible appearance, allocate an object for the appearance stream
  if (appearance) {
    apStreamObjNum = newSize;
    newSize++;
  }

  // Step 2: Build the incremental update
  const sigDictStr = buildSignatureDictString(placeholderSize, signatureFieldName);

  // Build rect string
  let rectStr = '0 0 0 0';
  if (appearance) {
    const [x, y, w, h] = appearance.rect;
    rectStr = `${x} ${y} ${x + w} ${y + h}`;
  }

  // Build field dict
  let sigFieldDict =
    `<< /Type /Annot /Subtype /Widget /FT /Sig /T (${signatureFieldName})` +
    ` /V ${sigValueObjNum} 0 R /F 132 /Rect [${rectStr}]`;

  if (appearance && apStreamObjNum >= 0) {
    sigFieldDict += ` /AP << /N ${apStreamObjNum} 0 R >>`;
  }
  sigFieldDict += ' >>';

  // Build the appendix
  let appendix = '\n';
  const objOffsets = new Map<number, number>();

  // Write sig value object
  const sigValueStart = pdfBytes.length + encoder.encode(appendix).length;
  objOffsets.set(sigValueObjNum, sigValueStart);
  appendix += `${sigValueObjNum} 0 obj\n`;
  appendix += sigDictStr;
  appendix += `\nendobj\n`;

  // Write sig field object
  const sigFieldStart = pdfBytes.length + encoder.encode(appendix).length;
  objOffsets.set(sigFieldObjNum, sigFieldStart);
  appendix += `${sigFieldObjNum} 0 obj\n`;
  appendix += sigFieldDict;
  appendix += `\nendobj\n`;

  // Write appearance stream object (if visible)
  let apStreamStart = -1;
  if (appearance && apStreamObjNum >= 0) {
    apStreamStart = pdfBytes.length + encoder.encode(appendix).length;
    objOffsets.set(apStreamObjNum, apStreamStart);

    const apContent = buildSignatureAppearanceStream(appearance);
    const [, , w, h] = appearance.rect;
    appendix += `${apStreamObjNum} 0 obj\n`;
    appendix += `<< /Type /XObject /Subtype /Form /BBox [0 0 ${w} ${h}]`;
    appendix += ` /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>`;
    appendix += ` /Length ${apContent.length} >>\n`;
    appendix += `stream\n`;
    appendix += apContent;
    appendix += `\nendstream\n`;
    appendix += `endobj\n`;
  }

  // Write xref
  const xrefOffset = pdfBytes.length + encoder.encode(appendix).length;
  const objCount = appearance ? 3 : 2;
  appendix += 'xref\n';
  appendix += `${sigValueObjNum} ${objCount}\n`;
  appendix += `${sigValueStart.toString().padStart(10, '0')} 00000 n \n`;
  appendix += `${sigFieldStart.toString().padStart(10, '0')} 00000 n \n`;
  if (appearance && apStreamStart >= 0) {
    appendix += `${apStreamStart.toString().padStart(10, '0')} 00000 n \n`;
  }

  // Write trailer
  appendix += 'trailer\n';
  appendix += '<<\n';
  appendix += `/Size ${newSize}\n`;
  appendix += `/Root ${rootObjNum} ${rootGenNum} R\n`;
  if (infoMatch) {
    appendix += `/Info ${infoMatch[1]} ${infoMatch[2]} R\n`;
  }
  appendix += `/Prev ${prevXrefOffset}\n`;
  appendix += '>>\n';
  appendix += 'startxref\n';
  appendix += `${xrefOffset}\n`;
  appendix += '%%EOF\n';

  // Combine original + appendix
  const appendixBytes = encoder.encode(appendix);
  const preparedPdf = new Uint8Array(pdfBytes.length + appendixBytes.length);
  preparedPdf.set(pdfBytes, 0);
  preparedPdf.set(appendixBytes, pdfBytes.length);

  // Step 3: Find the /Contents placeholder to compute ByteRange
  // The /Contents hex string is in the sig value object
  const contentsMarker = '/Contents <';
  const contentsKeyOffset = findStringForward(
    preparedPdf,
    contentsMarker,
    pdfBytes.length,
  );
  if (contentsKeyOffset === -1) {
    throw new Error('Cannot find /Contents placeholder in prepared PDF');
  }

  // The hex string starts at the `<` after `/Contents `
  const hexStringStart = contentsKeyOffset + '/Contents '.length;

  // Find the closing `>`
  const hexStringEnd = findStringForward(preparedPdf, '>', hexStringStart + 1);
  if (hexStringEnd === -1) {
    throw new Error('Cannot find end of /Contents hex string');
  }

  const contentsOffset = hexStringStart;
  const contentsLength = hexStringEnd - hexStringStart + 1; // includes `<` and `>`

  // Step 4: Compute ByteRange
  const totalLength = preparedPdf.length;
  const byteRange: [number, number, number, number] = [
    0,
    contentsOffset,
    contentsOffset + contentsLength,
    totalLength - (contentsOffset + contentsLength),
  ];

  // Step 5: Patch the /ByteRange in the prepared PDF
  const byteRangeStr =
    `${byteRange[0].toString().padStart(10, ' ')} ` +
    `${byteRange[1].toString().padStart(10, ' ')} ` +
    `${byteRange[2].toString().padStart(10, ' ')} ` +
    `${byteRange[3].toString().padStart(10, ' ')}`;

  const byteRangeMarker = '/ByteRange [';
  const byteRangeKeyOffset = findStringForward(
    preparedPdf,
    byteRangeMarker,
    pdfBytes.length,
  );
  if (byteRangeKeyOffset === -1) {
    throw new Error('Cannot find /ByteRange placeholder in prepared PDF');
  }

  const byteRangeValueStart = byteRangeKeyOffset + byteRangeMarker.length;
  const byteRangeBytes = encoder.encode(byteRangeStr);
  preparedPdf.set(byteRangeBytes, byteRangeValueStart);

  return {
    preparedPdf,
    byteRange: {
      byteRange,
      contentsOffset,
      contentsLength,
    },
  };
}

/**
 * Compute the hash of PDF bytes excluding the signature placeholder.
 *
 * Hashes the bytes covered by the ByteRange (everything except
 * the `/Contents` hex string).
 *
 * @param pdfBytes   The prepared PDF bytes.
 * @param byteRange  The [offset1, length1, offset2, length2] array.
 * @param algorithm  Hash algorithm. Default 'SHA-256'.
 * @returns          The hash digest.
 */
export async function computeSignatureHash(
  pdfBytes: Uint8Array,
  byteRange: [number, number, number, number],
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
): Promise<Uint8Array> {
  const [offset1, length1, offset2, length2] = byteRange;

  // Extract the two ranges
  const part1 = pdfBytes.subarray(offset1, offset1 + length1);
  const part2 = pdfBytes.subarray(offset2, offset2 + length2);

  // Concatenate
  const dataToHash = new Uint8Array(length1 + length2);
  dataToHash.set(part1, 0);
  dataToHash.set(part2, length1);

  // Hash via Web Crypto
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is not available. ' +
      'Requires Node.js 18+, a modern browser, Deno, or Bun.',
    );
  }

  const hashBuffer = await subtle.digest(
    algorithm,
    dataToHash.buffer.slice(
      dataToHash.byteOffset,
      dataToHash.byteOffset + dataToHash.byteLength,
    ) as ArrayBuffer,
  );

  return new Uint8Array(hashBuffer);
}

/**
 * Embed a signature into the prepared PDF at the placeholder position.
 *
 * Writes the hex-encoded signature bytes into the `/Contents <…>`
 * placeholder, replacing the zero bytes.
 *
 * @param preparedPdf     The prepared PDF bytes (from prepareForSigning).
 * @param signatureBytes  The DER-encoded signature (PKCS#7/CMS).
 * @param byteRange       The ByteRange result from prepareForSigning.
 * @returns               The signed PDF bytes.
 */
export function embedSignature(
  preparedPdf: Uint8Array,
  signatureBytes: Uint8Array,
  byteRange: ByteRangeResult,
): Uint8Array {
  const { contentsOffset, contentsLength } = byteRange;

  // Compute maximum signature hex length (minus 2 for angle brackets)
  const maxHexLength = contentsLength - 2; // <...>
  const maxSigBytes = Math.floor(maxHexLength / 2);

  if (signatureBytes.length > maxSigBytes) {
    throw new Error(
      `Signature (${signatureBytes.length} bytes) exceeds placeholder capacity ` +
      `(${maxSigBytes} bytes). Increase placeholderSize.`,
    );
  }

  // Hex-encode the signature and pad remaining space with zeroes
  let hexSig = signatureBytes.toHex().padEnd(maxHexLength, '0');

  // Build the hex string with angle brackets: <hexSig>
  const hexStringBytes = encoder.encode(`<${hexSig}>`);

  // Write into the prepared PDF
  const result = new Uint8Array(preparedPdf);
  result.set(hexStringBytes, contentsOffset);

  return result;
}

/**
 * Find all signature fields in a PDF and extract their ByteRange
 * and Contents information.
 *
 * @param pdfBytes  The PDF bytes to scan.
 * @returns         Array of signature info objects.
 */
export function findSignatures(
  pdfBytes: Uint8Array,
): Array<{
  byteRange: [number, number, number, number];
  contentsHex: string;
  contentsOffset: number;
  contentsLength: number;
}> {
  const text = decoder.decode(pdfBytes);
  const results: Array<{
    byteRange: [number, number, number, number];
    contentsHex: string;
    contentsOffset: number;
    contentsLength: number;
  }> = [];

  // Find all /ByteRange arrays
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let match: RegExpExecArray | null;

  while ((match = byteRangeRegex.exec(text)) !== null) {
    const br: [number, number, number, number] = [
      parseInt(match[1]!, 10),
      parseInt(match[2]!, 10),
      parseInt(match[3]!, 10),
      parseInt(match[4]!, 10),
    ];

    // Find the /Contents hex string near this ByteRange.
    // The hex string can be very large (16K+), so we cannot rely on a
    // small regex window.  Instead, search for "/Contents <" and then
    // scan forward for the closing ">".
    const searchStart = Math.max(0, match.index - 2000);
    const searchEnd = Math.min(text.length, match.index + 2000);
    const searchRegion = text.substring(searchStart, searchEnd);

    const contentsKeyIdx = searchRegion.indexOf('/Contents <');
    if (contentsKeyIdx !== -1) {
      const hexStart = contentsKeyIdx + '/Contents '.length;
      const absoluteHexStart = searchStart + hexStart;

      // Find the closing `>` in the full text (not the truncated region)
      const closingBracket = text.indexOf('>', absoluteHexStart + 1);
      if (closingBracket !== -1) {
        // Extract the hex string (between `<` and `>`)
        const hexStr = text.substring(absoluteHexStart + 1, closingBracket);
        const contentsLen = closingBracket - absoluteHexStart + 1; // includes `<` and `>`

        results.push({
          byteRange: br,
          contentsHex: hexStr,
          contentsOffset: absoluteHexStart,
          contentsLength: contentsLen,
        });
      }
    }
  }

  return results;
}
