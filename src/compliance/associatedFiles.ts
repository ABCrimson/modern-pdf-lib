/**
 * @module compliance/associatedFiles
 *
 * PDF/A-3 Associated Files (/AF) support.
 *
 * PDF/A-3 (ISO 19005-3:2012) allows embedding files of any type
 * in a PDF document, provided they are declared with an /AF
 * (Associated Files) key and an /AFRelationship value.
 *
 * Common relationships:
 * - /Source — the file is the source from which the PDF was created
 * - /Data — the file contains data represented in the PDF
 * - /Alternative — alternative representation of the PDF content
 * - /Supplement — supplementary information
 * - /EncryptedPayload — encrypted payload
 * - /FormData — form data (XFA)
 * - /Schema — schema definition
 * - /Unspecified — no specific relationship
 *
 * This is used by e-invoicing standards:
 * - ZUGFeRD/Factur-X — embeds XML invoice with /Alternative relationship
 * - XRechnung — embeds XML with /Data relationship
 *
 * Reference: ISO 19005-3:2012, PDF 2.0 (ISO 32000-2:2020) §14.13.
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Relationship type for associated files (PDF 2.0 / PDF/A-3). */
export type AFRelationship =
  | 'Source'
  | 'Data'
  | 'Alternative'
  | 'Supplement'
  | 'EncryptedPayload'
  | 'FormData'
  | 'Schema'
  | 'Unspecified';

/** Options for creating an associated file entry. */
export interface AssociatedFileOptions {
  /** The file data bytes. */
  readonly data: Uint8Array;
  /** The filename. */
  readonly filename: string;
  /** MIME type of the file (e.g. `"text/xml"`, `"application/pdf"`). */
  readonly mimeType: string;
  /** Relationship to the PDF document. */
  readonly relationship: AFRelationship;
  /** Optional description of the file. */
  readonly description?: string | undefined;
  /** Optional creation date (ISO 8601 string, stored as PDF date). */
  readonly creationDate?: string | undefined;
  /** Optional modification date (ISO 8601 string, stored as PDF date). */
  readonly modificationDate?: string | undefined;
}

/** Result of creating an associated file. */
export interface AssociatedFileResult {
  /** Reference to the file specification dictionary. */
  readonly fileSpecRef: PdfRef;
  /** Reference to the embedded file stream. */
  readonly streamRef: PdfRef;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Create a PDF/A-3 compliant associated file entry.
 *
 * Creates:
 * 1. An embedded file stream with the data
 * 2. A file specification dictionary with /AFRelationship
 *
 * The caller is responsible for adding the `fileSpecRef` to the
 * catalog's /AF array and /Names/EmbeddedFiles name tree.
 *
 * @param registry  The PDF object registry.
 * @param options   Associated file configuration.
 * @returns         References to the created objects.
 */
export function createAssociatedFile(
  registry: PdfObjectRegistry,
  options: AssociatedFileOptions,
): AssociatedFileResult {
  // 1. Build the embedded file stream
  const streamDict = new PdfDict();
  streamDict.set('/Type', PdfName.of('EmbeddedFile'));
  streamDict.set('/Subtype', PdfName.of(options.mimeType.replace('/', '#2F')));

  // Params sub-dictionary with size and optional dates
  const params = new PdfDict();
  params.set('/Size', PdfNumber.of(options.data.length));
  if (options.creationDate) {
    params.set('/CreationDate', PdfString.literal(`D:${options.creationDate}`));
  }
  if (options.modificationDate) {
    params.set('/ModDate', PdfString.literal(`D:${options.modificationDate}`));
  }
  streamDict.set('/Params', params);

  const stream = PdfStream.fromBytes(new Uint8Array(options.data), streamDict);
  const streamRef = registry.register(stream);

  // 2. Build the file specification dictionary
  const efDict = new PdfDict();
  efDict.set('/F', streamRef);
  efDict.set('/UF', streamRef);

  const fileSpec = new PdfDict();
  fileSpec.set('/Type', PdfName.of('Filespec'));
  fileSpec.set('/F', PdfString.literal(options.filename));
  fileSpec.set('/UF', PdfString.literal(options.filename));
  fileSpec.set('/EF', efDict);
  fileSpec.set('/AFRelationship', PdfName.of(options.relationship));

  if (options.description) {
    fileSpec.set('/Desc', PdfString.literal(options.description));
  }

  const fileSpecRef = registry.register(fileSpec);

  return { fileSpecRef, streamRef };
}

/**
 * Build an /AF array from multiple associated file specification references.
 *
 * The returned array should be set on the catalog dictionary:
 * ```ts
 * catalogDict.set('/AF', buildAfArray([ref1, ref2]));
 * ```
 *
 * @param fileSpecRefs  Indirect references to file specification dictionaries.
 * @returns             A PdfArray containing the references.
 */
export function buildAfArray(fileSpecRefs: PdfRef[]): PdfArray {
  return PdfArray.of(fileSpecRefs);
}
