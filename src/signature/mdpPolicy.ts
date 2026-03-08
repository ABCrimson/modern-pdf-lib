/**
 * @module signature/mdpPolicy
 *
 * MDP (Modification Detection and Prevention) policy support.
 *
 * MDP policies (also called "certification levels") define what
 * modifications are allowed after a certification signature is applied.
 * The first signature in a document can specify an MDP level via the
 * /DocMDP transform method in the signature's /TransformParams.
 *
 * Levels:
 * - 1 (NoChanges): No changes allowed
 * - 2 (FormFillAndSign): Form filling and signing only
 * - 3 (FormFillSignAnnotate): Form filling, signing, and annotation
 *
 * Reference: PDF 1.7 spec, SS12.8.2.2 (DocMDP Transform Method).
 *
 * @packageDocumentation
 */

import type { SignOptions } from './signatureHandler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * MDP permission levels for certification signatures.
 *
 * These correspond to the /P value in the /TransformParams dictionary
 * of a /DocMDP transform method.
 */
export enum MdpPermission {
  /** No changes to the document are permitted. */
  NoChanges = 1,
  /** Only form filling and signing are permitted. */
  FormFillAndSign = 2,
  /** Form filling, signing, and annotation changes are permitted. */
  FormFillSignAnnotate = 3,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the certification level (MDP permission) on sign options.
 *
 * When applied, the resulting signature will include a /DocMDP
 * transform method in its /TransformParams, which certifies the
 * document and restricts future modifications to the specified level.
 *
 * This should only be used for the FIRST (certification) signature
 * in a document. Subsequent approval signatures should not set MDP.
 *
 * @param options  The sign options to modify (mutated in place).
 * @param level    The MDP permission level to set.
 *
 * @example
 * ```ts
 * const options: SignOptions = {
 *   certificate: certDer,
 *   privateKey: keyDer,
 * };
 * setCertificationLevel(options, MdpPermission.FormFillAndSign);
 * const signedPdf = await signPdf(pdfBytes, 'CertSig', options);
 * ```
 */
export function setCertificationLevel(
  options: SignOptions,
  level: MdpPermission,
): void {
  // Store the MDP permission on the options object
  // The prepareForSigning function will read this when building the sig dict
  (options as SignOptions & { mdpPermission: MdpPermission }).mdpPermission = level;
}

/**
 * Read the certification level (MDP permission) from a PDF.
 *
 * Scans the PDF for the first /DocMDP transform method and extracts
 * the /P value from its /TransformParams. Returns `undefined` if no
 * certification signature is found.
 *
 * @param pdf  The PDF bytes to scan.
 * @returns    The MDP permission level, or `undefined` if not certified.
 */
export function getCertificationLevel(pdf: Uint8Array): MdpPermission | undefined {
  const text = decoder.decode(pdf);

  // Look for /DocMDP in the PDF
  const docMdpIdx = text.indexOf('/DocMDP');
  if (docMdpIdx === -1) return undefined;

  // Look for /TransformParams in the vicinity
  const searchStart = Math.max(0, docMdpIdx - 500);
  const searchEnd = Math.min(text.length, docMdpIdx + 2000);
  const region = text.slice(searchStart, searchEnd);

  // Find /P value in /TransformParams
  const transformParamsIdx = region.indexOf('/TransformParams');
  if (transformParamsIdx === -1) {
    // Try looking for /P directly near /DocMDP
    const pMatch = region.match(/\/P\s+(\d+)/);
    if (pMatch) {
      const pValue = parseInt(pMatch[1]!, 10);
      if (pValue >= 1 && pValue <= 3) {
        return pValue as MdpPermission;
      }
    }
    return undefined;
  }

  // Search after /TransformParams for /P
  const afterParams = region.slice(transformParamsIdx);
  const pMatch = afterParams.match(/\/P\s+(\d+)/);
  if (!pMatch) return undefined;

  const pValue = parseInt(pMatch[1]!, 10);
  if (pValue >= 1 && pValue <= 3) {
    return pValue as MdpPermission;
  }

  return undefined;
}

/**
 * Build a /DocMDP reference dictionary string for inclusion in
 * the signature dictionary.
 *
 * @param sigValueObjNum  The object number of the signature value.
 * @param level           The MDP permission level.
 * @returns               The /Reference array string to include in the sig dict.
 *
 * @internal
 */
export function buildDocMdpReference(
  sigValueObjNum: number,
  level: MdpPermission,
): string {
  return (
    ` /Reference [<< /Type /SigRef /TransformMethod /DocMDP` +
    ` /TransformParams << /Type /TransformParams /P ${level} /V /1.2 >> >>]`
  );
}
