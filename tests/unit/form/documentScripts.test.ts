/**
 * Tests for document-level JavaScript actions.
 *
 * Covers: getDocumentScripts, addDocumentOpenAction, addDocumentCloseAction,
 * addDocumentPrintAction, addDocumentSaveAction, removeDocumentScript.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/index.js';
import {
  getDocumentScripts,
  addDocumentOpenAction,
  addDocumentCloseAction,
  addDocumentPrintAction,
  addDocumentSaveAction,
  removeDocumentScript,
} from '../../../src/form/documentScripts.js';

// ---------------------------------------------------------------------------
// getDocumentScripts
// ---------------------------------------------------------------------------

describe('getDocumentScripts', () => {
  it('returns an empty array for a new document', () => {
    const doc = createPdf();
    const scripts = getDocumentScripts(doc);
    expect(scripts).toEqual([]);
  });

  it('returns scripts added via addJavaScript', () => {
    const doc = createPdf();
    doc.addJavaScript('init', 'app.alert("Hello!");');
    doc.addJavaScript('calc', 'var x = 1 + 2;');

    const scripts = getDocumentScripts(doc);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toEqual({ name: 'init', script: 'app.alert("Hello!");' });
    expect(scripts[1]).toEqual({ name: 'calc', script: 'var x = 1 + 2;' });
  });

  it('reflects removal of scripts', () => {
    const doc = createPdf();
    doc.addJavaScript('a', 'script_a');
    doc.addJavaScript('b', 'script_b');

    removeDocumentScript(doc, 'a');
    const scripts = getDocumentScripts(doc);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.name).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// addDocumentOpenAction
// ---------------------------------------------------------------------------

describe('addDocumentOpenAction', () => {
  it('adds an open action that appears in the saved PDF bytes', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentOpenAction(doc, 'app.alert("Opened!");');

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    // The catalog should contain /OpenAction pointing to a JS action
    expect(text).toContain('/OpenAction');
    expect(text).toContain('/JavaScript');
    expect(text).toContain('app.alert');
  });

  it('replaces a previous open action', () => {
    const doc = createPdf();
    addDocumentOpenAction(doc, 'first');
    addDocumentOpenAction(doc, 'second');

    // The named JS entry should have the second script
    const scripts = getDocumentScripts(doc);
    const openScript = scripts.find((s) => s.name === '__openAction__');
    expect(openScript?.script).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// addDocumentCloseAction
// ---------------------------------------------------------------------------

describe('addDocumentCloseAction', () => {
  it('adds a close action that produces /AA /WC in the PDF', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentCloseAction(doc, 'app.alert("Closing!");');

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/AA');
    expect(text).toContain('/WC');
    expect(text).toContain('Closing!');
  });
});

// ---------------------------------------------------------------------------
// addDocumentPrintAction
// ---------------------------------------------------------------------------

describe('addDocumentPrintAction', () => {
  it('adds before-print action (/WP)', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentPrintAction(doc, {
      beforePrint: 'console.println("Printing...");',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/WP');
    expect(text).toContain('Printing...');
  });

  it('adds after-print action (/DP)', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentPrintAction(doc, {
      afterPrint: 'console.println("Done.");',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/DP');
    expect(text).toContain('Done.');
  });

  it('adds both before and after print actions', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentPrintAction(doc, {
      beforePrint: 'before()',
      afterPrint: 'after()',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/WP');
    expect(text).toContain('/DP');
  });
});

// ---------------------------------------------------------------------------
// addDocumentSaveAction
// ---------------------------------------------------------------------------

describe('addDocumentSaveAction', () => {
  it('adds before-save action (/WS)', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentSaveAction(doc, {
      beforeSave: 'this.dirty = false;',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/WS');
  });

  it('adds after-save action (/DS)', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentSaveAction(doc, {
      afterSave: 'app.alert("Saved!");',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/DS');
    expect(text).toContain('Saved!');
  });

  it('adds both before and after save actions', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    addDocumentSaveAction(doc, {
      beforeSave: 'bsave()',
      afterSave: 'asave()',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('/WS');
    expect(text).toContain('/DS');
  });
});

// ---------------------------------------------------------------------------
// removeDocumentScript
// ---------------------------------------------------------------------------

describe('removeDocumentScript', () => {
  it('returns true when a script is found and removed', () => {
    const doc = createPdf();
    doc.addJavaScript('myScript', 'var x = 1;');
    expect(removeDocumentScript(doc, 'myScript')).toBe(true);
  });

  it('returns false when the script does not exist', () => {
    const doc = createPdf();
    expect(removeDocumentScript(doc, 'nonexistent')).toBe(false);
  });

  it('actually removes the script from the document', () => {
    const doc = createPdf();
    doc.addJavaScript('a', 'script_a');
    doc.addJavaScript('b', 'script_b');

    removeDocumentScript(doc, 'a');
    const scripts = getDocumentScripts(doc);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.name).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Combined actions
// ---------------------------------------------------------------------------

describe('combined document actions', () => {
  it('can have open + close + print + save actions simultaneously', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);

    addDocumentOpenAction(doc, 'openScript()');
    addDocumentCloseAction(doc, 'closeScript()');
    addDocumentPrintAction(doc, {
      beforePrint: 'beforePrint()',
      afterPrint: 'afterPrint()',
    });
    addDocumentSaveAction(doc, {
      beforeSave: 'beforeSave()',
      afterSave: 'afterSave()',
    });

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    // Catalog-level entries
    expect(text).toContain('/OpenAction');
    expect(text).toContain('/AA');
    expect(text).toContain('/WC');
    expect(text).toContain('/WP');
    expect(text).toContain('/DP');
    expect(text).toContain('/WS');
    expect(text).toContain('/DS');
  });

  it('produces a valid PDF structure with named scripts and actions', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    doc.addJavaScript('userInit', 'var initialized = true;');
    addDocumentOpenAction(doc, 'app.alert("Welcome!");');

    const bytes = await doc.save();
    const text = new TextDecoder().decode(bytes);

    // Both /Names and /OpenAction should be present
    expect(text).toContain('/Names');
    expect(text).toContain('/JavaScript');
    expect(text).toContain('/OpenAction');
  });
});
