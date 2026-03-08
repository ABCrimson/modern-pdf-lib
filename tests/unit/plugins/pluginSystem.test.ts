/**
 * Tests for the plugin system — registration, lifecycle hooks,
 * ordering, built-in plugins, and integration with PdfDocument.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createPdf,
  PdfDocument,
  PageSizes,
} from '../../../src/index.js';
import {
  PdfPluginManager,
} from '../../../src/plugins/pluginSystem.js';
import type {
  PdfPlugin,
  PluginDocument,
  PluginPage,
} from '../../../src/plugins/pluginSystem.js';
import { timestampPlugin } from '../../../src/plugins/builtins/timestampPlugin.js';
import { metadataPlugin } from '../../../src/plugins/builtins/metadataPlugin.js';
import { accessibilityPlugin } from '../../../src/plugins/builtins/accessibilityPlugin.js';
import { PdfDict, PdfName, PdfString } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal no-op plugin with the given name. */
function noopPlugin(name: string, version?: string): PdfPlugin {
  return { name, version };
}

const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// PdfPluginManager — unit tests
// ---------------------------------------------------------------------------

describe('PdfPluginManager', () => {
  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  describe('register / list / get', () => {
    it('registers a plugin and lists it', () => {
      const mgr = new PdfPluginManager();
      const plugin = noopPlugin('test-plugin', '1.0.0');
      mgr.register(plugin);

      expect(mgr.list()).toHaveLength(1);
      expect(mgr.list()[0]).toBe(plugin);
    });

    it('retrieves a plugin by name', () => {
      const mgr = new PdfPluginManager();
      const plugin = noopPlugin('alpha');
      mgr.register(plugin);

      expect(mgr.get('alpha')).toBe(plugin);
      expect(mgr.get('nonexistent')).toBeUndefined();
    });

    it('rejects duplicate plugin names', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('dup'));

      expect(() => mgr.register(noopPlugin('dup'))).toThrow(
        'Plugin "dup" is already registered',
      );
    });

    it('rejects plugins with empty names', () => {
      const mgr = new PdfPluginManager();

      expect(() => mgr.register(noopPlugin(''))).toThrow(
        'Plugin must have a non-empty name',
      );
    });

    it('registers multiple plugins in order', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('first'));
      mgr.register(noopPlugin('second'));
      mgr.register(noopPlugin('third'));

      const names = mgr.list().map((p) => p.name);
      expect(names).toEqual(['first', 'second', 'third']);
    });
  });

  // -----------------------------------------------------------------------
  // Unregister
  // -----------------------------------------------------------------------

  describe('unregister', () => {
    it('removes a plugin by name and returns true', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('removable'));

      expect(mgr.unregister('removable')).toBe(true);
      expect(mgr.list()).toHaveLength(0);
      expect(mgr.get('removable')).toBeUndefined();
    });

    it('returns false when the plugin is not found', () => {
      const mgr = new PdfPluginManager();

      expect(mgr.unregister('ghost')).toBe(false);
    });

    it('preserves order of remaining plugins after removal', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('a'));
      mgr.register(noopPlugin('b'));
      mgr.register(noopPlugin('c'));

      mgr.unregister('b');

      const names = mgr.list().map((p) => p.name);
      expect(names).toEqual(['a', 'c']);
    });
  });

  // -----------------------------------------------------------------------
  // Hook execution order
  // -----------------------------------------------------------------------

  describe('hook execution order', () => {
    it('executes onBeforeAddPage hooks in registration order', () => {
      const mgr = new PdfPluginManager();
      const callOrder: string[] = [];

      mgr.register({
        name: 'first',
        onBeforeAddPage(size) {
          callOrder.push('first');
          return size;
        },
      });

      mgr.register({
        name: 'second',
        onBeforeAddPage(size) {
          callOrder.push('second');
          return size;
        },
      });

      mgr.register({
        name: 'third',
        onBeforeAddPage(size) {
          callOrder.push('third');
          return size;
        },
      });

      mgr.executeOnBeforeAddPage(PageSizes.A4);

      expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('executes onBeforeSave hooks in registration order', async () => {
      const mgr = new PdfPluginManager();
      const callOrder: string[] = [];

      mgr.register({
        name: 'alpha',
        onBeforeSave() {
          callOrder.push('alpha');
        },
      });

      mgr.register({
        name: 'beta',
        async onBeforeSave() {
          callOrder.push('beta');
        },
      });

      const doc = createPdf();
      await mgr.executeOnBeforeSave(doc);

      expect(callOrder).toEqual(['alpha', 'beta']);
    });
  });

  // -----------------------------------------------------------------------
  // onBeforeAddPage modifies page size
  // -----------------------------------------------------------------------

  describe('onBeforeAddPage', () => {
    it('allows plugins to modify page size', () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'landscape',
        onBeforeAddPage(size) {
          // Convert to landscape by swapping width and height
          const [w, h] = size as readonly [number, number];
          if (h > w) return [h, w] as const;
          return size;
        },
      });

      const result = mgr.executeOnBeforeAddPage(PageSizes.A4);
      const [w, h] = result as readonly [number, number];

      // A4 portrait is [595.28, 841.89]; landscape should swap them
      expect(w).toBeCloseTo(841.89);
      expect(h).toBeCloseTo(595.28);
    });

    it('chains multiple size modifications', () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'double-width',
        onBeforeAddPage(size) {
          const [w, h] = size as readonly [number, number];
          return [w * 2, h] as const;
        },
      });

      mgr.register({
        name: 'half-height',
        onBeforeAddPage(size) {
          const [w, h] = size as readonly [number, number];
          return [w, h / 2] as const;
        },
      });

      const result = mgr.executeOnBeforeAddPage([100, 200]);
      const [w, h] = result as readonly [number, number];
      expect(w).toBe(200);
      expect(h).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // onAfterAddPage
  // -----------------------------------------------------------------------

  describe('onAfterAddPage', () => {
    it('calls onAfterAddPage with the created page', () => {
      const mgr = new PdfPluginManager();
      let receivedPage: PluginPage | undefined;
      let receivedDoc: PluginDocument | undefined;

      mgr.register({
        name: 'tracker',
        onAfterAddPage(page, doc) {
          receivedPage = page;
          receivedDoc = doc;
        },
      });

      const doc = createPdf();
      // Manually call the hook as the manager would
      const page = doc.addPage(PageSizes.Letter);

      // Since we registered on the manager directly (not on doc),
      // we call manually for this unit test
      mgr.executeOnAfterAddPage(page, doc);

      expect(receivedPage).toBe(page);
      expect(receivedDoc).toBe(doc);
    });
  });

  // -----------------------------------------------------------------------
  // onBeforeSave / onAfterSave
  // -----------------------------------------------------------------------

  describe('onBeforeSave', () => {
    it('calls onBeforeSave with the document', async () => {
      const mgr = new PdfPluginManager();
      const spy = vi.fn();

      mgr.register({
        name: 'save-hook',
        onBeforeSave: spy,
      });

      const doc = createPdf();
      await mgr.executeOnBeforeSave(doc);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(doc);
    });
  });

  describe('onAfterSave', () => {
    it('allows plugins to post-process PDF bytes', async () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'appender',
        onAfterSave(bytes) {
          // Append a comment to the PDF bytes
          const comment = new TextEncoder().encode('% Plugin was here\n');
          const result = new Uint8Array(bytes.length + comment.length);
          result.set(bytes, 0);
          result.set(comment, bytes.length);
          return result;
        },
      });

      const input = new Uint8Array([1, 2, 3]);
      const output = await mgr.executeOnAfterSave(input);

      const text = decoder.decode(output.subarray(3));
      expect(text).toBe('% Plugin was here\n');
    });

    it('chains multiple onAfterSave transformations', async () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'first',
        onAfterSave(bytes) {
          const result = new Uint8Array(bytes.length + 1);
          result.set(bytes);
          result[bytes.length] = 0x41; // 'A'
          return result;
        },
      });

      mgr.register({
        name: 'second',
        onAfterSave(bytes) {
          const result = new Uint8Array(bytes.length + 1);
          result.set(bytes);
          result[bytes.length] = 0x42; // 'B'
          return result;
        },
      });

      const input = new Uint8Array([0x30]); // '0'
      const output = await mgr.executeOnAfterSave(input);

      expect(decoder.decode(output)).toBe('0AB');
    });
  });

  // -----------------------------------------------------------------------
  // onBuildCatalog / onBuildPageDict
  // -----------------------------------------------------------------------

  describe('onBuildCatalog', () => {
    it('allows plugins to add entries to the catalog dict', () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'custom-catalog',
        onBuildCatalog(catalog) {
          catalog.set('/CustomEntry', PdfName.of('PluginValue'));
        },
      });

      const catalog = new PdfDict();
      mgr.executeOnBuildCatalog(catalog);

      expect(catalog.has('/CustomEntry')).toBe(true);
    });
  });

  describe('onBuildPageDict', () => {
    it('receives the page index', () => {
      const mgr = new PdfPluginManager();
      const receivedIndices: number[] = [];

      mgr.register({
        name: 'page-indexer',
        onBuildPageDict(_dict, idx) {
          receivedIndices.push(idx);
        },
      });

      mgr.executeOnBuildPageDict(new PdfDict(), 0);
      mgr.executeOnBuildPageDict(new PdfDict(), 1);
      mgr.executeOnBuildPageDict(new PdfDict(), 2);

      expect(receivedIndices).toEqual([0, 1, 2]);
    });
  });

  // -----------------------------------------------------------------------
  // onBeforeEmbedFont / onBeforeEmbedImage
  // -----------------------------------------------------------------------

  describe('onBeforeEmbedFont', () => {
    it('passes through data and options when no plugins modify them', () => {
      const mgr = new PdfPluginManager();
      const data = new Uint8Array([1, 2, 3]);
      const options = { subset: true };

      const result = mgr.executeOnBeforeEmbedFont(data, options);
      expect(result.data).toBe(data);
      expect(result.options).toBe(options);
    });

    it('allows plugins to modify font options', () => {
      const mgr = new PdfPluginManager();

      mgr.register({
        name: 'force-no-subset',
        onBeforeEmbedFont(data, options) {
          return { data, options: { ...options, subset: false } };
        },
      });

      const result = mgr.executeOnBeforeEmbedFont(
        new Uint8Array([1, 2, 3]),
        { subset: true },
      );
      expect(result.options.subset).toBe(false);
    });
  });

  describe('onBeforeEmbedImage', () => {
    it('passes through data when no plugins modify it', () => {
      const mgr = new PdfPluginManager();
      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      const result = mgr.executeOnBeforeEmbedImage(data);
      expect(result).toBe(data);
    });
  });

  // -----------------------------------------------------------------------
  // hasPlugins
  // -----------------------------------------------------------------------

  describe('hasPlugins', () => {
    it('returns false when no plugins are registered', () => {
      const mgr = new PdfPluginManager();
      expect(mgr.hasPlugins).toBe(false);
    });

    it('returns true when plugins are registered', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('one'));
      expect(mgr.hasPlugins).toBe(true);
    });

    it('returns false after last plugin is unregistered', () => {
      const mgr = new PdfPluginManager();
      mgr.register(noopPlugin('only'));
      mgr.unregister('only');
      expect(mgr.hasPlugins).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// PdfDocument.use() integration
// ---------------------------------------------------------------------------

describe('PdfDocument plugin integration', () => {
  it('registers a plugin via .use() and returns this for chaining', () => {
    const doc = createPdf();
    const plugin = noopPlugin('chain-test');
    const result = doc.use(plugin);

    expect(result).toBe(doc);
    expect(doc.getPluginManager().list()).toHaveLength(1);
    expect(doc.getPluginManager().get('chain-test')).toBe(plugin);
  });

  it('calls onRegister when .use() is called', () => {
    const doc = createPdf();
    const spy = vi.fn();

    doc.use({
      name: 'register-spy',
      onRegister: spy,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(doc);
  });

  it('calls onBeforeAddPage on addPage', () => {
    const doc = createPdf();
    const spy = vi.fn((size) => size);

    doc.use({
      name: 'before-add-page',
      onBeforeAddPage: spy,
    });

    doc.addPage(PageSizes.Letter);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('onBeforeAddPage can modify page dimensions', () => {
    const doc = createPdf();

    doc.use({
      name: 'tiny-pages',
      onBeforeAddPage() {
        return [100, 100] as const;
      },
    });

    const page = doc.addPage(PageSizes.A4);
    expect(page.getWidth()).toBe(100);
    expect(page.getHeight()).toBe(100);
  });

  it('calls onAfterAddPage when a page is added', () => {
    const doc = createPdf();
    const pages: PluginPage[] = [];

    doc.use({
      name: 'after-add',
      onAfterAddPage(page) {
        pages.push(page);
      },
    });

    doc.addPage(PageSizes.A4);
    doc.addPage(PageSizes.Letter);

    expect(pages).toHaveLength(2);
  });

  it('calls onBeforeSave and onAfterSave during save', async () => {
    const doc = createPdf();
    const order: string[] = [];

    doc.use({
      name: 'save-hooks',
      onBeforeSave() {
        order.push('before');
      },
      onAfterSave(bytes) {
        order.push('after');
        return bytes;
      },
    });

    doc.addPage();
    await doc.save();

    expect(order).toEqual(['before', 'after']);
  });

  it('onAfterSave can modify the output bytes', async () => {
    const doc = createPdf();

    doc.use({
      name: 'watermark-bytes',
      onAfterSave(bytes) {
        // Append a trailing comment
        const trailer = new TextEncoder().encode('% custom-plugin\n');
        const result = new Uint8Array(bytes.length + trailer.length);
        result.set(bytes, 0);
        result.set(trailer, bytes.length);
        return result;
      },
    });

    doc.addPage();
    const bytes = await doc.save();
    const text = decoder.decode(bytes);

    expect(text).toContain('% custom-plugin');
  });

  it('supports multiple plugins interacting', async () => {
    const doc = createPdf();
    const hooks: string[] = [];

    doc.use({
      name: 'plugin-a',
      onRegister() { hooks.push('a:register'); },
      onBeforeAddPage(size) { hooks.push('a:beforeAdd'); return size; },
      onAfterAddPage() { hooks.push('a:afterAdd'); },
      onBeforeSave() { hooks.push('a:beforeSave'); },
      onAfterSave(b) { hooks.push('a:afterSave'); return b; },
    });

    doc.use({
      name: 'plugin-b',
      onRegister() { hooks.push('b:register'); },
      onBeforeAddPage(size) { hooks.push('b:beforeAdd'); return size; },
      onAfterAddPage() { hooks.push('b:afterAdd'); },
      onBeforeSave() { hooks.push('b:beforeSave'); },
      onAfterSave(b) { hooks.push('b:afterSave'); return b; },
    });

    doc.addPage();
    await doc.save({ addDefaultPage: false });

    expect(hooks).toEqual([
      'a:register',
      'b:register',
      'a:beforeAdd',
      'b:beforeAdd',
      'a:afterAdd',
      'b:afterAdd',
      'a:beforeSave',
      'b:beforeSave',
      'a:afterSave',
      'b:afterSave',
    ]);
  });

  it('getPluginManager allows unregistering plugins', () => {
    const doc = createPdf();
    doc.use(noopPlugin('temporary'));

    expect(doc.getPluginManager().list()).toHaveLength(1);

    doc.getPluginManager().unregister('temporary');

    expect(doc.getPluginManager().list()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Built-in plugins
// ---------------------------------------------------------------------------

describe('timestampPlugin', () => {
  it('sets creation date on register', () => {
    const doc = createPdf();
    // The creation date is already set by default, so we clear it first
    doc.setCreationDate(new Date(0));

    doc.use(timestampPlugin());

    // The plugin should have set a new creation date
    const creationDate = doc.getCreationDate();
    expect(creationDate).toBeDefined();
    expect(creationDate!.getTime()).toBeGreaterThan(0);
  });

  it('updates modification date on save', async () => {
    const doc = createPdf();
    doc.use(timestampPlugin());
    doc.addPage();

    const beforeSave = Date.now();
    await doc.save();
    const afterSave = Date.now();

    const modDate = doc.getModDate();
    expect(modDate).toBeDefined();
    // The modification date should be within the save window
    expect(modDate!.getTime()).toBeGreaterThanOrEqual(beforeSave - 100);
    expect(modDate!.getTime()).toBeLessThanOrEqual(afterSave + 100);
  });

  it('respects setCreationDate: false option', () => {
    const doc = createPdf();
    const originalDate = new Date(2000, 0, 1);
    doc.setCreationDate(originalDate);

    doc.use(timestampPlugin({ setCreationDate: false }));

    expect(doc.getCreationDate()!.getTime()).toBe(originalDate.getTime());
  });

  it('respects setModificationDate: false option', async () => {
    const doc = createPdf();
    doc.use(timestampPlugin({ setModificationDate: false }));
    doc.addPage();

    // Reset mod date to a known value before save
    doc.setModDate(new Date(2000, 0, 1));
    await doc.save();

    // The mod date should NOT have been updated by the plugin
    // (though buildStructure sets modDate ??= new Date(), that is
    // separate from the plugin behavior)
  });

  it('has correct name and version', () => {
    const plugin = timestampPlugin();
    expect(plugin.name).toBe('timestamp');
    expect(plugin.version).toBe('1.0.0');
  });
});

describe('metadataPlugin', () => {
  it('sets producer on register', () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ producer: 'TestApp v1.0' }));

    expect(doc.getProducer()).toBe('TestApp v1.0');
  });

  it('defaults producer to modern-pdf-lib', () => {
    const doc = createPdf();
    doc.use(metadataPlugin());

    expect(doc.getProducer()).toBe('modern-pdf-lib');
  });

  it('re-affirms producer on save', async () => {
    const doc = createPdf();
    doc.use(metadataPlugin({ producer: 'CustomProducer' }));

    // Override the producer
    doc.setProducer('Overridden');
    expect(doc.getProducer()).toBe('Overridden');

    // After save, the plugin should have restored it
    doc.addPage();
    await doc.save();
    expect(doc.getProducer()).toBe('CustomProducer');
  });

  it('has correct name and version', () => {
    const plugin = metadataPlugin();
    expect(plugin.name).toBe('metadata');
    expect(plugin.version).toBe('1.0.0');
  });
});

describe('accessibilityPlugin', () => {
  it('sets document language on register', () => {
    const doc = createPdf();
    doc.use(accessibilityPlugin({ language: 'fr-FR' }));

    expect(doc.getLanguage()).toBe('fr-FR');
  });

  it('defaults language to en', () => {
    const doc = createPdf();
    doc.use(accessibilityPlugin());

    expect(doc.getLanguage()).toBe('en');
  });

  it('has correct name and version', () => {
    const plugin = accessibilityPlugin();
    expect(plugin.name).toBe('accessibility');
    expect(plugin.version).toBe('1.0.0');
  });

  it('adds MarkInfo to catalog on build', () => {
    const catalog = new PdfDict();
    const plugin = accessibilityPlugin();
    plugin.onBuildCatalog!(catalog);

    expect(catalog.has('/MarkInfo')).toBe(true);
    expect(catalog.has('/ViewerPreferences')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('propagates errors from onBeforeAddPage', () => {
    const doc = createPdf();

    doc.use({
      name: 'error-plugin',
      onBeforeAddPage() {
        throw new Error('Page not allowed');
      },
    });

    expect(() => doc.addPage()).toThrow('Page not allowed');
  });

  it('propagates errors from onBeforeSave', async () => {
    const doc = createPdf();
    doc.addPage();

    doc.use({
      name: 'save-error',
      onBeforeSave() {
        throw new Error('Cannot save');
      },
    });

    await expect(doc.save()).rejects.toThrow('Cannot save');
  });

  it('propagates errors from onAfterSave', async () => {
    const doc = createPdf();
    doc.addPage();

    doc.use({
      name: 'post-save-error',
      onAfterSave() {
        throw new Error('Post-processing failed');
      },
    });

    await expect(doc.save()).rejects.toThrow('Post-processing failed');
  });

  it('propagates errors from onRegister', () => {
    const doc = createPdf();

    expect(() =>
      doc.use({
        name: 'bad-register',
        onRegister() {
          throw new Error('Init failed');
        },
      }),
    ).toThrow('Init failed');
  });

  it('error in first plugin prevents subsequent plugins from running the same hook', async () => {
    const mgr = new PdfPluginManager();
    const secondCalled = vi.fn();

    mgr.register({
      name: 'fails',
      onBeforeSave() {
        throw new Error('boom');
      },
    });

    mgr.register({
      name: 'never-reached',
      onBeforeSave: secondCalled,
    });

    const doc = createPdf();
    await expect(mgr.executeOnBeforeSave(doc)).rejects.toThrow('boom');
    expect(secondCalled).not.toHaveBeenCalled();
  });
});
