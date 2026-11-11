/**
 * @module signature/modificationDetector
 *
 * Certified document modification detection.
 *
 * When a PDF has a certification signature with an MDP policy,
 * this module checks whether subsequent modifications comply with
 * the permitted level. It compares content at each signature's byte
 * range against the current PDF to detect unauthorized changes.
 *
 * Reference: PDF 1.7 spec, SS12.8.2.2 (DocMDP Transform Method).
 *
 * @packageDocumentation
 */

import { getCertificationLevel } from './mdpPolicy.js';
import type { MdpPermission } from './mdpPolicy.js';
import { findExistingSignatures } from './incrementalSave.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Types of modifications that can be detected. `'unknown'` marks an object
 * added or changed after a signed revision whose text carries a signature
 * key (`/Type /Sig`, `/FT /Sig`, `/SubFilter /adbe.pkcs7.detached`); it is
 * not compliant at any certification level.
 */
export type ModificationViolationType =
  | 'content_changed'
  | 'annotation_added'
  | 'form_filled'
  | 'page_added'
  | 'unknown';

/**
 * A single modification violation detected in the document.
 */
export interface ModificationViolation {
  /** The type of modification detected. */
  type: ModificationViolationType;
  /** Human-readable description of the violation. */
  description: string;
  /** Index of the signature whose coverage was violated. */
  affectedSignatureIndex: number;
}

/**
 * Report of modifications detected in a certified document.
 */
export interface ModificationReport {
  /** The certification level, if any. */
  certificationLevel?: MdpPermission | undefined;
  /** Whether the modifications comply with the certification level. */
  isCompliant: boolean;
  /** List of detected violations. */
  violations: ModificationViolation[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

/**
 * Extract objects from a specific revision of the PDF.
 */
function extractObjectsFromRevision(pdf: Uint8Array, revisionEnd: number): Map<number, string> {
  const text = decoder.decode(pdf.subarray(0, revisionEnd));
  const objects = new Map<number, string>();

  const objRegex = /(\d+)\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objRegex.exec(text)) !== null) {
    const objNum = parseInt(match[1]!, 10);
    const bodyStart = match.index + match[0].length;
    const endIdx = text.indexOf('endobj', bodyStart);
    if (endIdx === -1) continue;

    objects.set(objNum, text.slice(bodyStart, endIdx).trim());
  }

  return objects;
}

/**
 * Check if a change looks like a form fill.
 */
function isFormFillChange(oldContent: string, newContent: string): boolean {
  // Form fills typically change /V, /AS, or /AP values
  return (
    newContent.includes('/V ') ||
    newContent.includes('/V(') ||
    newContent.includes('/AS ') ||
    newContent.includes('/AP ')
  );
}

/**
 * Check if a change looks like an annotation addition.
 */
function isAnnotationChange(oldContent: string, newContent: string): boolean {
  return newContent.includes('/Type /Annot') || newContent.includes('/Annots');
}

/**
 * Check if a change looks like a page addition.
 */
function isPageAddition(oldContent: string, newContent: string): boolean {
  return newContent.includes('/Type /Page') && !oldContent.includes('/Type /Page');
}

/**
 * Check whether an object's text carries a signature key, with or without
 * whitespace between key and value. This is a pattern test over the raw text
 * (comments, strings and stream data included), so it only routes the
 * object to the `'unknown'` violation; it never classifies a change as allowed.
 */
function isSignatureChange(newContent: string): boolean {
  return (
    /\/Type\s*\/Sig/.test(newContent) ||
    /\/FT\s*\/Sig/.test(newContent) ||
    /\/SubFilter\s*\/adbe\.pkcs7\.detached/.test(newContent)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect modifications in a certified PDF document.
 *
 * Compares content at each signature's byte range against the current
 * PDF state. If an MDP (DocMDP) certification level is set, checks
 * whether the modifications comply with the permitted level.
 *
 * Modification levels:
 * - MDP 1 (NoChanges): Any change is a violation
 * - MDP 2 (FormFillAndSign): Only form fills and new signatures allowed
 *   (0.40.5: an added signature is reported as `'unknown'` and is not yet
 *   recognised as permitted)
 * - MDP 3 (FormFillSignAnnotate): Form fills, signatures, and annotations allowed
 *   (0.40.5: an added signature is reported as `'unknown'` and is not yet
 *   recognised as permitted)
 *
 * @param pdf  The PDF bytes to analyze.
 * @returns    A detailed modification report.
 */
export async function detectModifications(pdf: Uint8Array): Promise<ModificationReport> {
  const certLevel = getCertificationLevel(pdf);
  const signatures = findExistingSignatures(pdf);
  const violations: ModificationViolation[] = [];

  if (signatures.length === 0) {
    return {
      ...(certLevel !== undefined && { certificationLevel: certLevel }),
      isCompliant: true,
      violations: [],
    };
  }

  // Sort signatures by coverage (end of second range)
  const sortedSigs = [...signatures].sort((a, b) => {
    const aEnd = a.byteRange[2] + a.byteRange[3];
    const bEnd = b.byteRange[2] + b.byteRange[3];
    return aEnd - bEnd;
  });

  // For each signature, check what changed after its coverage
  for (let i = 0; i < sortedSigs.length; i++) {
    const sig = sortedSigs[i]!;
    const sigEnd = sig.byteRange[2] + sig.byteRange[3];

    // If this isn't the last signature, compare revisions
    if (sigEnd < pdf.length) {
      // Get objects at the signature's revision
      const objectsBefore = extractObjectsFromRevision(pdf, sigEnd);
      // Get current objects
      const objectsAfter = extractObjectsFromRevision(pdf, pdf.length);

      // Compare objects
      for (const [objNum, newContent] of objectsAfter) {
        const oldContent = objectsBefore.get(objNum);

        // Skip if unchanged
        if (oldContent !== undefined && oldContent === newContent) continue;

        // This object was added or modified after this signature
        const effectiveOld = oldContent ?? '';

        // Determine the type of change
        if (isSignatureChange(newContent)) {
          // Fail closed: a real added signature and a change disguised behind a
          // signature key look the same to this pattern test, so neither is
          // skipped. 'unknown' is non-compliant at every certification level
          // (case 1 rejects every violation; cases 2 and 3 reject anything
          // that is not form_filled / annotation_added).
          violations.push({
            type: 'unknown',
            description:
              `Object ${objNum} ${oldContent === undefined ? 'added' : 'modified'} after ` +
              `signature at index ${i} carries a signature key; the change cannot be classified`,
            affectedSignatureIndex: i,
          });
          continue;
        }

        if (isPageAddition(effectiveOld, newContent)) {
          violations.push({
            type: 'page_added',
            description: `Page added in object ${objNum} after signature at index ${i}`,
            affectedSignatureIndex: i,
          });
          continue;
        }

        if (isAnnotationChange(effectiveOld, newContent)) {
          violations.push({
            type: 'annotation_added',
            description: `Annotation added/modified in object ${objNum} after signature at index ${i}`,
            affectedSignatureIndex: i,
          });
          continue;
        }

        if (isFormFillChange(effectiveOld, newContent)) {
          violations.push({
            type: 'form_filled',
            description: `Form field filled in object ${objNum} after signature at index ${i}`,
            affectedSignatureIndex: i,
          });
          continue;
        }

        // Generic content change
        if (oldContent !== undefined) {
          violations.push({
            type: 'content_changed',
            description: `Object ${objNum} was modified after signature at index ${i}`,
            affectedSignatureIndex: i,
          });
        }
      }
    }
  }

  // Determine compliance based on MDP level
  let isCompliant = true;

  if (certLevel !== undefined) {
    for (const violation of violations) {
      switch (certLevel) {
        case 1: // NoChanges — any modification is a violation
          isCompliant = false;
          break;

        case 2: // FormFillAndSign — only form fills allowed
          if (violation.type !== 'form_filled') {
            isCompliant = false;
          }
          break;

        case 3: // FormFillSignAnnotate — form fills + annotations allowed
          if (violation.type !== 'form_filled' && violation.type !== 'annotation_added') {
            isCompliant = false;
          }
          break;
      }

      if (!isCompliant) break;
    }
  }

  return {
    ...(certLevel !== undefined && { certificationLevel: certLevel }),
    isCompliant,
    violations,
  };
}
