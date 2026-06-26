/**
 * @module compliance/pdfVT
 *
 * PDF/VT variable & transactional printing support (ISO 16612-2).
 *
 * PDF/VT extends PDF/X for high-volume *variable data printing* (VDP): a
 * single output file carries many personalized *records* (e.g. one statement
 * per recipient).  Record boundaries are expressed through the PDF 2.0
 * *Document Part* (DPart) hierarchy (ISO 32000-2 §14.12): each record maps to
 * one `/DPart` node whose *Document Part Metadata* (`/DPM`) dictionary uses the
 * VT namespace (`/S /VT`) to label the record and attach arbitrary key/value
 * production fields.
 *
 * This module is additive and self-contained: it produces spec-shaped
 * `/DPM` and `/DPartRoot` dictionaries from a flat list of {@link RecordMetadata}.
 * Resolving page indices to concrete page references and wiring up `/Parent`
 * back-links remain the writer's concern (see {@link buildDPartRoot}).
 *
 * Reference: ISO 16612-2 (PDF/VT); ISO 32000-2:2020, §14.12 (Document parts).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfString,
} from '../core/pdfObjects.js';
import { buildDPartRoot } from '../core/documentParts.js';
import type { DocumentPart } from '../core/documentParts.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * PDF/VT conformance level (ISO 16612-2).
 *
 * - `PDF/VT-1` — self-contained single file (built on PDF/X-4).
 * - `PDF/VT-2` — may reference external content via PDF/X-5 / external graphics.
 * - `PDF/VT-3` — streamed variant (PDF/VT-1s) for incremental production.
 */
export type PdfVtConformance = 'PDF/VT-1' | 'PDF/VT-2' | 'PDF/VT-3';

/**
 * Metadata describing a single variable-data *record*.
 *
 * A record spans a contiguous, inclusive range of zero-based page indices and
 * carries a stable identifier plus optional production fields.
 */
export interface RecordMetadata {
  /** Zero-based index of the first page in this record (inclusive). */
  readonly startPage: number;
  /** Zero-based index of the last page in this record (inclusive). */
  readonly endPage: number;
  /** Stable record identifier (emitted as `/RecordID`). */
  readonly recordId: string;
  /**
   * Optional per-record production fields.  Each key/value pair is emitted as
   * a PDF name → literal-string entry inside the record's `/DPM` dictionary.
   */
  readonly fields?: Readonly<Record<string, string>> | undefined;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build the VT *Document Part Metadata* (`/DPM`) dictionary for a single record.
 *
 * The dictionary carries:
 *  - `/Type /DPM`
 *  - `/S /VT` — selects the VT (variable / transactional) metadata namespace
 *  - `/RecordID` — the record's stable identifier (literal string)
 *  - one literal-string entry per {@link RecordMetadata.fields} pair
 *
 * @param record - The record whose metadata to encode.
 * @returns A spec-shaped VT `/DPM` {@link PdfDict}.
 */
export function buildVtDpm(record: RecordMetadata): PdfDict {
  const dpm = new PdfDict();
  dpm.set('/Type', PdfName.of('DPM'));
  dpm.set('/S', PdfName.of('VT'));
  dpm.set('/RecordID', PdfString.literal(record.recordId));

  const fields = record.fields;
  if (fields !== undefined) {
    for (const [key, value] of Object.entries(fields)) {
      dpm.set(PdfName.of(key).value, PdfString.literal(value));
    }
  }

  return dpm;
}

/**
 * Build a PDF/VT `/DPartRoot` dictionary from a flat list of records.
 *
 * Each record becomes one child `/DPart` node (via {@link buildDPartRoot}),
 * and that child is augmented with a VT `/DPM` dictionary produced by
 * {@link buildVtDpm}.  The returned structure mirrors {@link buildDPartRoot}:
 *  - `/Type /DPartRoot`
 *  - `/DPartRootNode` → a top `/DPart` node whose `/DParts` array holds one
 *    child `/DPart` per record, each carrying `/Start`, `/End`, and a VT `/DPM`.
 *
 * The structure is self-contained: page positions are stored as plain numbers
 * rather than resolved page references.
 *
 * @param records - The variable-data records, in page order.
 * @returns A spec-shaped PDF/VT `/DPartRoot` {@link PdfDict}.
 */
export function buildPdfVtDParts(records: readonly RecordMetadata[]): PdfDict {
  // Build the underlying DPart hierarchy with bare page ranges; the VT /DPM
  // is attached afterward so each child carries the VT namespace metadata.
  const parts: readonly DocumentPart[] = records.map((record) => ({
    startPage: record.startPage,
    endPage: record.endPage,
  }));

  const root = buildDPartRoot(parts);

  const rootNode = root.get('/DPartRootNode');
  if (!(rootNode instanceof PdfDict)) return root;

  const dparts = rootNode.get('/DParts');
  if (!(dparts instanceof PdfArray)) return root;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === undefined) continue;
    const child = dparts.items[i];
    if (!(child instanceof PdfDict)) continue;
    child.set('/DPM', buildVtDpm(record));
  }

  return root;
}

/**
 * Map a {@link PdfVtConformance} level to its `GTS_PDFVTVersion` string, the
 * value placed in the document's XMP / output-intent VT version field.
 *
 * @param conformance - The conformance level (defaults to `PDF/VT-1`).
 * @returns The `GTS_PDFVTVersion` string (e.g. `PDF/VT-1`).
 */
export function gtsPdfVtVersion(conformance: PdfVtConformance = 'PDF/VT-1'): string {
  return conformance;
}
