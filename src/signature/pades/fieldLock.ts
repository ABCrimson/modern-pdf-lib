/**
 * @module signature/pades/fieldLock
 *
 * Signature field lock dictionary support.
 *
 * A signature field may contain a /Lock dictionary that specifies
 * which form fields should be locked (made read-only) when the
 * signature is applied.
 *
 * Lock actions:
 * - 'All': Lock all form fields in the document
 * - 'Include': Lock only the specified fields
 * - 'Exclude': Lock all fields EXCEPT the specified ones
 *
 * Reference: PDF 1.7 spec, SS12.7.4.5 (Signature Fields),
 *            Table 233 (Lock Dictionary).
 *
 * @packageDocumentation
 */

import { readStringEntry } from './byteRange.js';
import { InvalidArgumentError } from '../../errors.js';
import type { SignOptions } from './signatureHandler.js';
import { UNSUPPORTED_OPTIONS, rejectOption } from '../../internal/options.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for locking fields when a signature is applied.
 */
export interface FieldLockOptions {
  /** Lock action: 'All', 'Include', or 'Exclude'. */
  action: 'All' | 'Include' | 'Exclude';
  /** Field names to include or exclude (required for 'Include' and 'Exclude'). */
  fields?: string[] | undefined;
}

/**
 * Information about a field lock on a signature field.
 */
export interface FieldLockInfo {
  /** The name of the signature field that has the lock. */
  signatureFieldName: string;
  /** The lock action: 'All', 'Include', or 'Exclude'. */
  action: 'All' | 'Include' | 'Exclude';
  /** The list of locked fields (empty for 'All' action). */
  lockedFields: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

/** The row of the option table that refuses {@link addFieldLock} as a whole call. */
const REFUSED_CALL = /* @__PURE__ */ UNSUPPORTED_OPTIONS.filter(
  (rule) => rule.entry === 'addFieldLock()',
);

/**
 * Escape a string for use in a PDF name.
 */
function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a field lock dictionary to sign options.
 *
 * Not supported in this release: `signPdf()` does not write a /Lock
 * dictionary, so a call with a valid lock throws an `UnsupportedOptionError`
 * (planned for 0.45.0) and leaves `options` unchanged.
 *
 * @param options  The sign options the lock is meant for.
 * @param lock     The field lock configuration.
 * @throws {InvalidArgumentError}  When an `Include` or `Exclude` lock lists
 *         no field (argument `lock.fields`); this check comes first.
 * @throws {UnsupportedOptionError}  For every valid lock, in this release.
 *
 * @example
 * ```ts
 * import { UnsupportedOptionError } from 'modern-pdf-lib';
 *
 * try {
 *   addFieldLock(options, { action: 'Include', fields: ['Name', 'Address', 'Amount'] });
 * } catch (error) {
 *   if (!(error instanceof UnsupportedOptionError)) throw error;
 *   // error.plannedFor === '0.45.0'
 * }
 * ```
 */
export function addFieldLock(options: SignOptions, lock: FieldLockOptions): void {
  if (lock.action !== 'All' && (!lock.fields || lock.fields.length === 0)) {
    throw new InvalidArgumentError(
      `Field lock action "${lock.action}" requires at least one field name`,
      { argument: 'lock.fields' },
    );
  }
  for (const rule of REFUSED_CALL) rejectOption(rule);
}

/**
 * Read all field lock dictionaries from signature fields in a PDF.
 *
 * Scans the PDF for signature field dictionaries that contain a /Lock
 * entry and extracts the lock action and field names.
 *
 * @param pdf  The PDF bytes to scan.
 * @returns    Array of field lock information objects.
 */
export function getFieldLocks(pdf: Uint8Array): FieldLockInfo[] {
  const text = decoder.decode(pdf);
  const results: FieldLockInfo[] = [];

  // Find all signature fields (Widget with /FT /Sig)
  const sigFieldRegex = /\/FT\s*\/Sig\b/g;
  let match: RegExpExecArray | null;

  while ((match = sigFieldRegex.exec(text)) !== null) {
    const fieldStart = Math.max(0, match.index - 2000);
    const fieldEnd = Math.min(text.length, match.index + 3000);
    const fieldRegion = text.slice(fieldStart, fieldEnd);

    // Check for /Lock dictionary
    const lockIdx = fieldRegion.indexOf('/Lock');
    if (lockIdx === -1) continue;

    // Extract field name
    const fieldName = readStringEntry(fieldRegion, 'T') ?? 'Unknown';

    // Extract lock action
    const actionMatch = fieldRegion.match(/\/Action\s*\/(All|Include|Exclude)/);
    if (!actionMatch) continue;

    const action = actionMatch[1] as 'All' | 'Include' | 'Exclude';

    // Extract locked fields
    const lockedFields: string[] = [];
    if (action !== 'All') {
      // Find /Fields array
      const lockRegion = fieldRegion.slice(lockIdx);
      const fieldsMatch = lockRegion.match(/\/Fields\s*\[(.*?)\]/);
      if (fieldsMatch) {
        const fieldsStr = fieldsMatch[1]!;
        const fieldNames = fieldsStr.match(/\(([^)]*)\)/g);
        if (fieldNames) {
          for (const fn of fieldNames) {
            lockedFields.push(fn.slice(1, -1));
          }
        }
      }
    }

    results.push({
      signatureFieldName: fieldName,
      action,
      lockedFields,
    });
  }

  return results;
}

/**
 * Build a /Lock dictionary string for inclusion in a signature field.
 *
 * @param lock  The field lock options.
 * @returns     The /Lock dictionary string.
 *
 * @internal
 */
export function buildFieldLockDict(lock: FieldLockOptions): string {
  let dict = `/Lock << /Type /SigFieldLock /Action /${lock.action}`;

  if (lock.action !== 'All' && lock.fields && lock.fields.length > 0) {
    const fieldEntries = lock.fields.map((f) => `(${escapePdfString(f)})`).join(' ');
    dict += ` /Fields [${fieldEntries}]`;
  }

  dict += ' >>';
  return dict;
}
