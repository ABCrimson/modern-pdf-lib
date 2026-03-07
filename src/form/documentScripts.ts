/**
 * @module form/documentScripts
 *
 * Utilities for managing document-level JavaScript actions in a PDF.
 *
 * PDF supports several document-level triggers:
 * - **Open action** (`/OpenAction` in the catalog) — runs when the document opens.
 * - **Additional actions** (`/AA` in the catalog) — runs on close, print, save events.
 *   - `/WC` = WillClose (before close)
 *   - `/WS` = WillSave (before save)
 *   - `/DS` = DidSave (after save)
 *   - `/WP` = WillPrint (before print)
 *   - `/DP` = DidPrint (after print)
 * - **Named JavaScript** (in `/Names` → `/JavaScript` name tree) — auto-executed on open.
 *
 * Reference: PDF 1.7 spec, §12.6.3 (Trigger Events),
 *            §12.6.4.2 (JavaScript Actions), §7.7.4 (Name Trees).
 */

import type { PdfDocument } from '../core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A document-level JavaScript entry from the Names dictionary. */
export interface DocumentScript {
  /** The unique name of this script entry. */
  name: string;
  /** The JavaScript source code. */
  script: string;
}

/** Options for adding before/after print actions. */
export interface PrintActionOptions {
  /** Script to execute before printing (`/WP` — WillPrint). */
  beforePrint?: string | undefined;
  /** Script to execute after printing (`/DP` — DidPrint). */
  afterPrint?: string | undefined;
}

/** Options for adding before/after save actions. */
export interface SaveActionOptions {
  /** Script to execute before saving (`/WS` — WillSave). */
  beforeSave?: string | undefined;
  /** Script to execute after saving (`/DS` — DidSave). */
  afterSave?: string | undefined;
}

// ---------------------------------------------------------------------------
// Internal: Storage on PdfDocument
// ---------------------------------------------------------------------------

/**
 * Internal storage attached to a PdfDocument instance via a WeakMap.
 * This avoids modifying PdfDocument's private fields.
 */
interface DocumentScriptState {
  openAction?: string;
  closeAction?: string;
  beforePrint?: string;
  afterPrint?: string;
  beforeSave?: string;
  afterSave?: string;
}

/** WeakMap to store document-level action state per PdfDocument instance. */
const documentActionState = new WeakMap<PdfDocument, DocumentScriptState>();

/** Get or create the action state for a document. */
function getState(doc: PdfDocument): DocumentScriptState {
  let state = documentActionState.get(doc);
  if (!state) {
    state = {};
    documentActionState.set(doc, state);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve all document-level JavaScript entries from the document.
 *
 * This reads from the scripts that have been added via
 * {@link PdfDocument.addJavaScript} (the `/Names` → `/JavaScript` name tree).
 *
 * @param doc  The PDF document.
 * @returns    An array of `{ name, script }` entries, in insertion order.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { getDocumentScripts } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * doc.addJavaScript('init', 'app.alert("Hello!");');
 * const scripts = getDocumentScripts(doc);
 * // [{ name: 'init', script: 'app.alert("Hello!");' }]
 * ```
 */
export function getDocumentScripts(doc: PdfDocument): DocumentScript[] {
  const scripts: DocumentScript[] = [];
  // PdfDocument stores scripts in a private Map<string, string>
  // accessed via addJavaScript(). We use getJavaScripts() which we
  // expose as a companion method.
  const jsMap = getJavaScriptMap(doc);
  for (const [name, script] of jsMap) {
    scripts.push({ name, script });
  }
  return scripts;
}

/**
 * Add a JavaScript action that runs when the document is opened.
 *
 * This sets the `/OpenAction` entry in the PDF catalog to a JavaScript
 * action dictionary. Only one open action can exist at a time; calling
 * this again replaces the previous one.
 *
 * @param doc     The PDF document.
 * @param script  The JavaScript source to execute on open.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { addDocumentOpenAction } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * addDocumentOpenAction(doc, 'app.alert("Document opened!");');
 * ```
 */
export function addDocumentOpenAction(doc: PdfDocument, script: string): void {
  const state = getState(doc);
  state.openAction = script;
  // Also register as a named JS entry so it persists through buildStructure
  doc.addJavaScript('__openAction__', script);
}

/**
 * Add a JavaScript action that runs when the document is closed.
 *
 * This is set via the catalog's `/AA` (Additional Actions) dictionary
 * under the `/WC` (WillClose) key.
 *
 * @param doc     The PDF document.
 * @param script  The JavaScript source to execute before close.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { addDocumentCloseAction } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * addDocumentCloseAction(doc, 'app.alert("Goodbye!");');
 * ```
 */
export function addDocumentCloseAction(doc: PdfDocument, script: string): void {
  const state = getState(doc);
  state.closeAction = script;
  // Register as named JS so the action dict is reachable
  doc.addJavaScript('__closeAction__', script);
}

/**
 * Add before-print and/or after-print JavaScript actions.
 *
 * These are stored in the catalog's `/AA` dictionary:
 * - `/WP` (WillPrint) — executes before printing
 * - `/DP` (DidPrint) — executes after printing
 *
 * @param doc      The PDF document.
 * @param options  Print action options (beforePrint and/or afterPrint scripts).
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { addDocumentPrintAction } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * addDocumentPrintAction(doc, {
 *   beforePrint: 'console.println("Printing...");',
 *   afterPrint: 'console.println("Done printing.");',
 * });
 * ```
 */
export function addDocumentPrintAction(
  doc: PdfDocument,
  options: PrintActionOptions,
): void {
  const state = getState(doc);
  if (options.beforePrint !== undefined) {
    state.beforePrint = options.beforePrint;
    doc.addJavaScript('__beforePrint__', options.beforePrint);
  }
  if (options.afterPrint !== undefined) {
    state.afterPrint = options.afterPrint;
    doc.addJavaScript('__afterPrint__', options.afterPrint);
  }
}

/**
 * Add before-save and/or after-save JavaScript actions.
 *
 * These are stored in the catalog's `/AA` dictionary:
 * - `/WS` (WillSave) — executes before saving
 * - `/DS` (DidSave) — executes after saving
 *
 * @param doc      The PDF document.
 * @param options  Save action options (beforeSave and/or afterSave scripts).
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { addDocumentSaveAction } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * addDocumentSaveAction(doc, {
 *   beforeSave: 'this.dirty = false;',
 *   afterSave: 'app.alert("Saved!");',
 * });
 * ```
 */
export function addDocumentSaveAction(
  doc: PdfDocument,
  options: SaveActionOptions,
): void {
  const state = getState(doc);
  if (options.beforeSave !== undefined) {
    state.beforeSave = options.beforeSave;
    doc.addJavaScript('__beforeSave__', options.beforeSave);
  }
  if (options.afterSave !== undefined) {
    state.afterSave = options.afterSave;
    doc.addJavaScript('__afterSave__', options.afterSave);
  }
}

/**
 * Remove a named document-level JavaScript entry.
 *
 * Removes the script from the `/Names` → `/JavaScript` name tree.
 * This does NOT remove catalog-level actions (`/OpenAction`, `/AA`);
 * those can be overwritten by adding a new action or cleared manually.
 *
 * @param doc   The PDF document.
 * @param name  The name of the script to remove.
 * @returns     `true` if the script was found and removed, `false` otherwise.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { removeDocumentScript } from 'modern-pdf-lib/form';
 *
 * const doc = createPdf();
 * doc.addJavaScript('init', 'app.alert("Hello!");');
 * removeDocumentScript(doc, 'init'); // true
 * removeDocumentScript(doc, 'nonexistent'); // false
 * ```
 */
export function removeDocumentScript(doc: PdfDocument, name: string): boolean {
  const jsMap = getJavaScriptMap(doc);
  return jsMap.delete(name);
}

/**
 * Get the internal state for a document's catalog-level actions.
 *
 * Used by the catalog builder to set `/OpenAction` and `/AA` entries.
 *
 * @internal
 */
export function getDocumentActionState(
  doc: PdfDocument,
): DocumentScriptState | undefined {
  return documentActionState.get(doc);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Access the private `javaScripts` Map on PdfDocument.
 *
 * PdfDocument stores JavaScript entries in a private `Map<string, string>`
 * field called `javaScripts`. We access it via a type assertion since
 * this is an internal module within the same library.
 *
 * @internal
 */
function getJavaScriptMap(doc: PdfDocument): Map<string, string> {
  // Access the private field through a type assertion
  return (doc as unknown as { javaScripts: Map<string, string> }).javaScripts;
}
