/**
 * Tests for document-level JavaScript actions.
 *
 * Covers:
 * - Adding a single JavaScript action
 * - Adding multiple JavaScript actions
 * - JavaScript actions survive save (check raw bytes for /JavaScript and /JS)
 * - JavaScript actions survive round-trip (save -> load -> check catalog)
 */

import { describe, it, expect } from 'vitest';
import { createPdf, PdfDocument } from '../../../src/core/pdfDocument.js';
import { PageSizes } from '../../../src/core/pdfPage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

/**
 * Convert a Uint8Array to a latin1 string for substring searching.
 */
function bytesToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

// ---------------------------------------------------------------------------
// addJavaScript - basic API
// ---------------------------------------------------------------------------

describe('addJavaScript', () => {
  it('should add a single JavaScript action', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addJavaScript('init', 'app.alert("Hello!");');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // The output should contain the /JavaScript name tree entry
    expect(str).toContain('/JavaScript');
    // The output should contain the /JS key in the action dictionary
    expect(str).toContain('/JS');
    // The output should contain the /S /JavaScript action subtype
    expect(str).toContain('/S /JavaScript');
    // The script contents should appear as a literal string
    expect(str).toContain('app.alert');
  });

  it('should add multiple JavaScript actions', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addJavaScript('first', 'var x = 1;');
    doc.addJavaScript('second', 'var y = 2;');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // Both script names should appear in the name tree
    expect(str).toContain('first');
    expect(str).toContain('second');
    // Both script contents should appear
    expect(str).toContain('var x = 1;');
    expect(str).toContain('var y = 2;');
  });

  it('should produce valid PDF bytes containing /JavaScript and /JS', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addJavaScript('validate', 'console.println("PDF loaded");');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // Verify the action dictionary structure
    expect(str).toContain('/Type /Action');
    expect(str).toContain('/S /JavaScript');
    expect(str).toContain('/JS');
    expect(str).toContain('console.println');

    // Verify the name tree structure: /Names dict should have /JavaScript
    expect(str).toContain('/JavaScript');
    // The name tree should reference the action via /Names array
    expect(str).toContain('/Names');
  });

  it('should survive a save and load round-trip', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addJavaScript('onOpen', 'app.alert("Opened!");');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // The saved bytes should contain the JavaScript action structure
    expect(str).toContain('/JavaScript');
    expect(str).toContain('/JS');
    expect(str).toContain('app.alert');

    // Load the saved PDF and re-add the same JavaScript, then re-save
    const loaded = await PdfDocument.load(bytes);
    loaded.addJavaScript('onOpen', 'app.alert("Opened!");');

    const bytes2 = await loaded.save();
    const str2 = bytesToString(bytes2);

    // The round-tripped PDF with JavaScript re-added should contain
    // the /Names /JavaScript structure in the catalog
    expect(str2).toContain('/JavaScript');
    expect(str2).toContain('/JS');
    expect(str2).toContain('app.alert');
  });

  it('should coexist with embedded file attachments', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);

    // Add a JavaScript action
    doc.addJavaScript('init', 'var ready = true;');

    // Add an embedded file attachment
    const encoder = new TextEncoder();
    doc.attachFile('data.txt', encoder.encode('file content'), 'text/plain');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // Both /JavaScript and /EmbeddedFiles should be present under /Names
    expect(str).toContain('/JavaScript');
    expect(str).toContain('/EmbeddedFiles');
    expect(str).toContain('var ready = true;');
    expect(str).toContain('data.txt');
  });

  it('should overwrite a script with the same name', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addJavaScript('init', 'var old = true;');
    doc.addJavaScript('init', 'var replaced = true;');

    const bytes = await doc.save();
    const str = bytesToString(bytes);

    // The old script should be replaced
    expect(str).not.toContain('var old = true;');
    expect(str).toContain('var replaced = true;');
  });
});
