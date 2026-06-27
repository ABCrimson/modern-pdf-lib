/**
 * Tests for the PDF sanitizer (`src/security/sanitize.ts`).
 *
 * The sanitizer produces a cleaned copy of a PDF with active/hidden
 * content neutralised: document JavaScript, auto-run /OpenAction +
 * /AA actions, embedded files, and metadata (XMP /Metadata stream +
 * the /Info dictionary).
 *
 * These tests build inputs with the public `createPdf()` API, save them
 * to bytes, run `sanitizePdf()`, then RE-PARSE the cleaned bytes to prove
 * the offending structures are physically gone — not merely unreferenced.
 *
 * Reference: ISO 32000-1:2008
 *   §7.7.2  Document catalog (/Names, /OpenAction, /AA, /Metadata, /AF)
 *   §7.7.4  Name trees (/JavaScript, /EmbeddedFiles)
 *   §12.6.4.16 JavaScript actions
 *   §14.3.2 Metadata streams / §14.3.3 Document information dictionary
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { serializePdf } from '../../../src/core/pdfWriter.js';
import { buildInfoDict } from '../../../src/core/pdfCatalog.js';
import { renderPageToImage } from '../../../src/render/rasterizer.js';
import { PdfDict, PdfName, PdfString, PdfRef } from '../../../src/core/pdfObjects.js';
import type { PdfObject } from '../../../src/core/pdfObjects.js';
import { sanitizePdf } from '../../../src/security/sanitize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find every /Type /Catalog dictionary in a loaded document's registry. */
function findCatalogs(doc: { getRegistry(): Iterable<{ object: PdfObject }> }): PdfDict[] {
  const seen = new Set<PdfDict>();
  for (const { object } of doc.getRegistry()) {
    if (object instanceof PdfDict) {
      const t = object.get('/Type');
      if (t instanceof PdfName && t.value === '/Catalog') seen.add(object);
    }
  }
  return [...seen];
}

/** Decode raw PDF bytes as Latin-1 text for substring scanning. */
function asText(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/** Build a clean one-page PDF with visible text and no active content. */
async function buildCleanPdf(): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  const font = await doc.embedFont('Helvetica');
  page.drawText('Hello sanitizer', { x: 10, y: 100, size: 14, font });
  return doc.save();
}

/**
 * Build a one-page PDF that DOES contain document JavaScript and an
 * embedded file (plus visible text so we can prove the page survives).
 */
async function buildHostilePdf(): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  const font = await doc.embedFont('Helvetica');
  page.drawText('Hello sanitizer', { x: 10, y: 100, size: 14, font });

  // Document-level JavaScript → /Names /JavaScript name tree.
  doc.addJavaScript('autoInit', 'app.alert("ACTIVE-CONTENT-PAYLOAD");');

  // Embedded file → /Names /EmbeddedFiles name tree.
  doc.attachFile(
    'secret.txt',
    new TextEncoder().encode('EMBEDDED-FILE-PAYLOAD'),
    'text/plain',
  );

  // Metadata that should be strippable.
  doc.setTitle('Confidential Title');
  doc.setAuthor('Mallory');
  doc.setKeywords('classified-keyword');

  return doc.save();
}

/**
 * Build a one-page PDF whose catalog carries an auto-run `/OpenAction`
 * JavaScript action and an `/AA` (document additional-actions) dictionary
 * with a JavaScript close action. These structures are not reachable
 * through the high-level `createPdf()` API, so they are injected directly
 * into the parsed catalog and re-serialized verbatim (no catalog rebuild).
 */
async function buildOpenActionPdf(): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  const font = await doc.embedFont('Helvetica');
  page.drawText('Hello sanitizer', { x: 10, y: 100, size: 14, font });
  const base = await doc.save();

  const loaded = await loadPdf(base);
  const registry = loaded.getRegistry();

  let catalogRef: PdfRef | undefined;
  let catalog: PdfDict | undefined;
  let pagesRef: PdfObject | undefined;
  for (const { ref, object } of registry) {
    if (object instanceof PdfDict) {
      const type = object.get('/Type');
      if (type instanceof PdfName && type.value === '/Catalog') {
        catalogRef = ref;
        catalog = object;
        pagesRef = object.get('/Pages');
      }
    }
  }
  if (!catalogRef || !catalog || !(pagesRef instanceof PdfRef)) {
    throw new Error('test fixture: catalog/pages not found');
  }

  // /OpenAction → JavaScript action (§12.3.4 / §12.6.4.16).
  const openAction = new PdfDict();
  openAction.set('/Type', PdfName.of('Action'));
  openAction.set('/S', PdfName.of('JavaScript'));
  openAction.set('/JS', PdfString.literal('OPENACTION-PAYLOAD'));
  catalog.set('/OpenAction', registry.register(openAction));

  // /AA /WC → JavaScript close action (§12.6.3).
  const closeAction = new PdfDict();
  closeAction.set('/Type', PdfName.of('Action'));
  closeAction.set('/S', PdfName.of('JavaScript'));
  closeAction.set('/JS', PdfString.literal('AA-CLOSE-PAYLOAD'));
  const aa = new PdfDict();
  aa.set('/WC', registry.register(closeAction));
  catalog.set('/AA', aa);

  const infoRef = buildInfoDict({}, registry);
  return serializePdf(registry, { catalogRef, infoRef, pagesRef });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sanitizePdf', () => {
  it('reports and removes document JavaScript and embedded files', async () => {
    const src = await buildHostilePdf();

    // Sanity: the offending payloads ARE present in the source bytes.
    const srcText = asText(src);
    expect(srcText).toContain('ACTIVE-CONTENT-PAYLOAD');
    expect(srcText).toContain('EMBEDDED-FILE-PAYLOAD');

    const { pdf, report } = await sanitizePdf(src);

    // Report lists the classes that were actually present.
    expect(report.removed).toContain('javascript');
    expect(report.removed).toContain('embeddedFiles');

    // Re-scan the catalog of the cleaned PDF: the name trees are gone.
    const reloaded = await loadPdf(pdf);
    for (const catalog of findCatalogs(reloaded)) {
      const names = catalog.get('/Names');
      if (names instanceof PdfDict) {
        expect(names.has('/JavaScript')).toBe(false);
        expect(names.has('/EmbeddedFiles')).toBe(false);
      }
      expect(catalog.has('/OpenAction')).toBe(false);
      expect(catalog.has('/AA')).toBe(false);
      expect(catalog.has('/AF')).toBe(false);
    }

    // The payload bytes are physically gone (not merely unreferenced).
    const outText = asText(pdf);
    expect(outText).not.toContain('ACTIVE-CONTENT-PAYLOAD');
    expect(outText).not.toContain('EMBEDDED-FILE-PAYLOAD');
  });

  it('strips XMP /Metadata and the /Info dictionary when metadata=true', async () => {
    const src = await buildHostilePdf();
    expect(asText(src)).toContain('Mallory');

    const { pdf, report } = await sanitizePdf(src);

    expect(report.removed).toContain('metadata');

    const outText = asText(pdf);
    expect(outText).not.toContain('Mallory');
    expect(outText).not.toContain('Confidential Title');
    expect(outText).not.toContain('classified-keyword');

    const reloaded = await loadPdf(pdf);
    expect(reloaded.getTitle()).toBeUndefined();
    expect(reloaded.getAuthor()).toBeUndefined();
    expect(reloaded.getKeywords()).toBeUndefined();

    // No /Metadata stream should remain referenced from any catalog.
    for (const catalog of findCatalogs(reloaded)) {
      expect(catalog.has('/Metadata')).toBe(false);
    }
  });

  it('keeps a class when its option is disabled', async () => {
    const src = await buildHostilePdf();

    // Disable JavaScript removal → it must NOT be reported or removed.
    const { pdf, report } = await sanitizePdf(src, { javascript: false });

    expect(report.removed).not.toContain('javascript');
    // Embedded files still removed (default true).
    expect(report.removed).toContain('embeddedFiles');

    const reloaded = await loadPdf(pdf);
    let foundJs = false;
    for (const catalog of findCatalogs(reloaded)) {
      const names = catalog.get('/Names');
      if (names instanceof PdfDict && names.has('/JavaScript')) foundJs = true;
    }
    expect(foundJs).toBe(true);
  });

  it('returns an empty report for an already-clean PDF', async () => {
    // A freshly created page with only visible text has no JavaScript,
    // no embedded files, no /OpenAction, no XMP, and no descriptive
    // /Info fields (only an auto producer + dates) → nothing to remove.
    const src = await buildCleanPdf();
    const { pdf, report } = await sanitizePdf(src);

    expect(report.removed).toEqual([]);

    // The cleaned PDF still parses and has its page.
    const reloaded = await loadPdf(pdf);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('produces a PDF that still parses and renders its page', async () => {
    const src = await buildHostilePdf();
    const { pdf } = await sanitizePdf(src);

    // Round-trip: cleaned PDF must loadPdf() without error.
    const reloaded = await loadPdf(pdf);
    expect(reloaded.getPageCount()).toBe(1);

    // And the page must still rasterize to a non-empty image.
    const page = reloaded.getPage(0);
    const img = await renderPageToImage(page);
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
    expect(img.data.length).toBeGreaterThan(0);
  });

  it('removes /OpenAction and /AA JavaScript actions', async () => {
    const src = await buildOpenActionPdf();

    const srcText = asText(src);
    expect(srcText).toContain('OPENACTION-PAYLOAD');
    expect(srcText).toContain('AA-CLOSE-PAYLOAD');

    const { pdf, report } = await sanitizePdf(src);

    // /OpenAction is its own class; the /AA JavaScript action is reported
    // under the javascript class.
    expect(report.removed).toContain('openActions');
    expect(report.removed).toContain('javascript');

    const outText = asText(pdf);
    expect(outText).not.toContain('OPENACTION-PAYLOAD');
    expect(outText).not.toContain('AA-CLOSE-PAYLOAD');

    const reloaded = await loadPdf(pdf);
    expect(reloaded.getPageCount()).toBe(1);
    for (const catalog of findCatalogs(reloaded)) {
      expect(catalog.has('/OpenAction')).toBe(false);
      expect(catalog.has('/AA')).toBe(false);
    }
  });

  it('preserves /OpenAction when openActions is disabled', async () => {
    const src = await buildOpenActionPdf();

    const { pdf, report } = await sanitizePdf(src, { openActions: false });

    expect(report.removed).not.toContain('openActions');
    // The auto-run action survives verbatim.
    expect(asText(pdf)).toContain('OPENACTION-PAYLOAD');
    const reloaded = await loadPdf(pdf);
    let hasOpenAction = false;
    for (const catalog of findCatalogs(reloaded)) {
      if (catalog.has('/OpenAction')) hasOpenAction = true;
    }
    expect(hasOpenAction).toBe(true);
  });

  it('preserves descriptive metadata when metadata is disabled', async () => {
    const src = await buildHostilePdf();

    const { pdf, report } = await sanitizePdf(src, { metadata: false });

    expect(report.removed).not.toContain('metadata');

    const reloaded = await loadPdf(pdf);
    expect(reloaded.getTitle()).toBe('Confidential Title');
    expect(reloaded.getAuthor()).toBe('Mallory');
  });

  it('does not list a class that was not present', async () => {
    // Clean doc → nothing should be reported even though all options default on.
    const src = await buildCleanPdf();
    const { report } = await sanitizePdf(src);
    expect(report.removed).not.toContain('javascript');
    expect(report.removed).not.toContain('embeddedFiles');
    expect(report.removed).not.toContain('openActions');
    // A clean createPdf() doc has no XMP and an /Info dict with only a
    // producer/dates default, so "metadata" may or may not be reported;
    // we only assert the active-content classes here.
  });
});
