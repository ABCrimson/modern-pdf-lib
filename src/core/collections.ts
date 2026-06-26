/**
 * @module core/collections
 *
 * PDF Portfolios / Collections (ISO 32000-2 §7.11.6).
 *
 * A *collection* (also called a "PDF Portfolio" or "package") turns a PDF
 * into a container for a set of embedded files presented through a richer
 * UI than a flat attachment list.  The collection is described by a
 * `/Collection` dictionary stored in the document catalog.
 *
 * This module builds that `/Collection` dictionary from a small, typed
 * options object.  It produces only PDF object-model values
 * ({@link PdfDict} etc.) and does not touch the catalog itself — wiring the
 * returned dictionary into `/Collection` is the caller's responsibility.
 *
 * Supported entries (ISO 32000-2, Table 43 "Entries in a collection
 * dictionary"):
 *
 * - `/Type`   — always `/Collection`.
 * - `/View`   — `/D` (Details), `/T` (Tile), or `/H` (Hidden).
 * - `/Schema` — a collection-schema dictionary mapping field names to
 *               collection-field (subfield) dictionaries.
 * - `/Sort`   — a collection-sort dictionary; `/S` is a field name or an
 *               array of field names.
 * - `/D`      — the name (in the `EmbeddedFiles` name tree) of the file to
 *               present initially.
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  type PdfObject,
} from './pdfObjects.js';

/**
 * Collection view mode (ISO 32000-2, Table 43, `/View`):
 *
 * - `'D'` — Details: a multi-column list with the schema fields as columns.
 * - `'T'` — Tile: a tiled icon view.
 * - `'H'` — Hidden: the collection UI is initially hidden.
 */
export type CollectionView = 'D' | 'T' | 'H';

/**
 * One field of a collection schema (ISO 32000-2, Table 44 "Entries in a
 * collection field dictionary").
 */
export interface CollectionSchemaField {
  /** Schema key — the name under which the subfield dict is stored in `/Schema`. */
  readonly key: string;
  /** Human-readable column label (`/N`). */
  readonly label: string;
  /**
   * Field data type (`/Subtype`):
   *
   * - `'S'` — text string.
   * - `'D'` — date.
   * - `'N'` — number.
   */
  readonly fieldType: 'S' | 'D' | 'N';
  /** Optional relative column order (`/O`); lower sorts first. */
  readonly order?: number | undefined;
}

/** Options controlling the generated `/Collection` dictionary. */
export interface CollectionOptions {
  /** Initial view mode; defaults to `'D'` (Details). */
  readonly view?: CollectionView | undefined;
  /** Schema fields describing the columns / metadata of each embedded file. */
  readonly schema?: readonly CollectionSchemaField[] | undefined;
  /**
   * One or more schema keys used to sort the file list initially.
   * A single key serializes `/S` as a name; multiple keys as an array.
   */
  readonly sortKeys?: readonly string[] | undefined;
  /**
   * Name (in the `EmbeddedFiles` name tree) of the file to present first
   * (`/D`).
   */
  readonly initialDocument?: string | undefined;
}

/** Default view mode when none is supplied. */
const DEFAULT_VIEW: CollectionView = 'D';

/**
 * Build a single collection-field (subfield) dictionary.
 *
 * @internal
 */
function buildSchemaField(field: CollectionSchemaField): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('/CollectionField'));
  dict.set('/Subtype', PdfName.of(`/${field.fieldType}`));
  dict.set('/N', PdfString.literal(field.label));
  if (field.order !== undefined) {
    dict.set('/O', PdfNumber.of(field.order));
  }
  return dict;
}

/**
 * Build a `/Collection` dictionary (ISO 32000-2 §7.11.6) suitable for
 * placing in the document catalog under `/Collection`.
 *
 * @param options - Collection configuration; all fields are optional.  An
 *   empty/omitted options object yields a minimal collection with
 *   `/Type /Collection` and `/View /D`.
 * @returns The populated collection dictionary.
 */
export function buildCollection(options: CollectionOptions = {}): PdfDict {
  const collection = new PdfDict();
  collection.set('/Type', PdfName.of('/Collection'));

  const view = options.view ?? DEFAULT_VIEW;
  collection.set('/View', PdfName.of(`/${view}`));

  const schema = options.schema;
  if (schema !== undefined && schema.length > 0) {
    const schemaDict = new PdfDict();
    schemaDict.set('/Type', PdfName.of('/CollectionSchema'));
    for (const field of schema) {
      schemaDict.set(`/${field.key}`, buildSchemaField(field));
    }
    collection.set('/Schema', schemaDict);
  }

  const sortKeys = options.sortKeys;
  if (sortKeys !== undefined && sortKeys.length > 0) {
    const sortDict = new PdfDict();
    sortDict.set('/Type', PdfName.of('/CollectionSort'));
    if (sortKeys.length === 1) {
      const [only] = sortKeys;
      sortDict.set('/S', PdfName.of(`/${only}`));
    } else {
      const arr = new PdfArray();
      for (const key of sortKeys) {
        arr.push(PdfName.of(`/${key}`));
      }
      sortDict.set('/S', arr);
    }
    collection.set('/Sort', sortDict);
  }

  const initialDocument = options.initialDocument;
  if (initialDocument !== undefined) {
    const value: PdfObject = PdfString.literal(initialDocument);
    collection.set('/D', value);
  }

  return collection;
}
