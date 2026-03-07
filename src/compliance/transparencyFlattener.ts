/**
 * Transparency flattener for PDF/A-1 compliance.
 *
 * PDF/A-1 (ISO 19005-1:2005) prohibits transparency features:
 * - ExtGState with /CA (stroke opacity) < 1.0
 * - ExtGState with /ca (fill opacity) < 1.0
 * - /SMask references (soft masks)
 * - /BM (blend mode) other than /Normal
 *
 * This module detects transparency usage and can modify the PDF
 * to remove or flatten it for PDF/A-1 compliance.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Detected transparency usage in a PDF. */
export interface TransparencyInfo {
  /** Whether any transparency was found. */
  readonly hasTransparency: boolean;
  /** Number of ExtGState objects with non-1.0 CA. */
  readonly strokeOpacityCount: number;
  /** Number of ExtGState objects with non-1.0 ca. */
  readonly fillOpacityCount: number;
  /** Number of SMask references found. */
  readonly softMaskCount: number;
  /** Number of non-Normal blend mode references. */
  readonly blendModeCount: number;
  /** Detailed findings. */
  readonly findings: TransparencyFinding[];
}

/** A single transparency finding with type, value, and byte position. */
export interface TransparencyFinding {
  readonly type: 'stroke-opacity' | 'fill-opacity' | 'soft-mask' | 'blend-mode';
  readonly value: string;
  readonly position: number;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Analyze PDF bytes for transparency usage.
 *
 * Scans the raw PDF text for ExtGState entries that use:
 * - `/CA <value>` where value < 1.0 (stroke opacity)
 * - `/ca <value>` where value < 1.0 (fill opacity)
 * - `/SMask <ref>` where ref is not `/None`
 * - `/BM /<mode>` where mode is not `Normal`
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         A {@link TransparencyInfo} describing any transparency found.
 */
export function detectTransparency(pdfBytes: Uint8Array): TransparencyInfo {
  const text = new TextDecoder().decode(pdfBytes);
  const findings: TransparencyFinding[] = [];

  // Check for non-1.0 CA (stroke opacity)
  let strokeOpacityCount = 0;
  for (const match of text.matchAll(/\/CA\s+([\d.]+)/g)) {
    const val = parseFloat(match[1]!);
    if (val < 1.0) {
      strokeOpacityCount++;
      findings.push({
        type: 'stroke-opacity',
        value: match[1]!,
        position: match.index!,
      });
    }
  }

  // Check for non-1.0 ca (fill opacity)
  let fillOpacityCount = 0;
  for (const match of text.matchAll(/\/ca\s+([\d.]+)/g)) {
    const val = parseFloat(match[1]!);
    if (val < 1.0) {
      fillOpacityCount++;
      findings.push({
        type: 'fill-opacity',
        value: match[1]!,
        position: match.index!,
      });
    }
  }

  // Check for SMask references (not /SMask /None)
  let softMaskCount = 0;
  for (const match of text.matchAll(/\/SMask\s+(?!\/None)(\S+)/g)) {
    softMaskCount++;
    findings.push({
      type: 'soft-mask',
      value: match[1]!,
      position: match.index!,
    });
  }

  // Check for non-Normal blend modes
  let blendModeCount = 0;
  for (const match of text.matchAll(/\/BM\s+\/([\w]+)/g)) {
    if (match[1] !== 'Normal') {
      blendModeCount++;
      findings.push({
        type: 'blend-mode',
        value: match[1]!,
        position: match.index!,
      });
    }
  }

  return {
    hasTransparency: findings.length > 0,
    strokeOpacityCount,
    fillOpacityCount,
    softMaskCount,
    blendModeCount,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Flattening
// ---------------------------------------------------------------------------

/**
 * Flatten transparency by modifying PDF bytes.
 *
 * This replaces:
 * - `/CA <value>` with `/CA 1` (where value < 1)
 * - `/ca <value>` with `/ca 1` (where value < 1)
 * - `/SMask <ref>` with `/SMask /None`
 * - `/BM /<mode>` with `/BM /Normal`
 *
 * **Note:** This is a "lossy" operation — semi-transparent elements
 * will become fully opaque. For print-quality output, manual review
 * is recommended.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         Modified PDF bytes with transparency removed.
 */
export function flattenTransparency(pdfBytes: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  let text = new TextDecoder().decode(pdfBytes);

  // Replace non-1.0 CA with /CA 1
  text = text.replace(/\/CA\s+[\d.]+/g, (match) => {
    const val = parseFloat(match.split(/\s+/)[1]!);
    return val < 1.0 ? '/CA 1' : match;
  });

  // Replace non-1.0 ca with /ca 1
  text = text.replace(/\/ca\s+[\d.]+/g, (match) => {
    const val = parseFloat(match.split(/\s+/)[1]!);
    return val < 1.0 ? '/ca 1' : match;
  });

  // Replace SMask references with /SMask /None
  text = text.replace(/\/SMask\s+(?!\/None)\S+/g, '/SMask /None');

  // Replace non-Normal blend modes with /BM /Normal
  text = text.replace(/\/BM\s+\/(?!Normal)\w+/g, '/BM /Normal');

  return encoder.encode(text);
}
