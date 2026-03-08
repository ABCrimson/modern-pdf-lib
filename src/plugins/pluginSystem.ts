/**
 * @module plugins/pluginSystem
 *
 * Extensible plugin system for the PDF creation pipeline.
 *
 * Plugins can intercept and modify behavior at various lifecycle
 * points: page creation, font/image embedding, serialization,
 * and catalog/page-dict construction.
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { timestampPlugin } from 'modern-pdf-lib/plugins';
 *
 * const doc = createPdf();
 * doc.use(timestampPlugin());
 * ```
 */

import type { PdfDict } from '../core/pdfObjects.js';
import type { PageSize } from '../core/pdfPage.js';
import type { EmbedFontOptions } from '../core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Forward-reference types to avoid circular imports.
// The actual PdfDocument and PdfPage classes are imported only by
// consumers — the plugin interface uses them as opaque type params.
// ---------------------------------------------------------------------------

/** Minimal document shape visible to plugins. */
export interface PluginDocument {
  getPageCount(): number;
  getPages(): readonly PluginPage[];
  setTitle(title: string): void;
  setAuthor(author: string): void;
  setSubject(subject: string): void;
  setKeywords(keywords: string | string[]): void;
  setProducer(producer: string): void;
  setCreator(creator: string): void;
  setCreationDate(date: Date): void;
  setModDate(date: Date): void;
  setLanguage(lang: string): void;
}

/** Minimal page shape visible to plugins. */
export interface PluginPage {
  getWidth(): number;
  getHeight(): number;
}

// ---------------------------------------------------------------------------
// PdfPlugin interface
// ---------------------------------------------------------------------------

/**
 * Plugin lifecycle hooks -- plugins can intercept and modify behavior
 * at various points in the PDF creation pipeline.
 */
export interface PdfPlugin {
  /** Unique plugin name. */
  readonly name: string;

  /** Plugin version string. */
  readonly version?: string | undefined;

  // -- Lifecycle hooks (all optional) --

  /** Called when the plugin is registered on a document. */
  onRegister?(doc: PluginDocument): void;

  /** Called before a page is added. Can modify page options. */
  onBeforeAddPage?(size: PageSize): PageSize;

  /** Called after a page is added. Can add content to the page. */
  onAfterAddPage?(page: PluginPage, doc: PluginDocument): void;

  /**
   * Called before font embedding. Can transform font data and options.
   * Return the (possibly modified) data and options.
   */
  onBeforeEmbedFont?(
    data: Uint8Array,
    options: EmbedFontOptions,
  ): { data: Uint8Array; options: EmbedFontOptions };

  /** Called before image embedding. Can transform image data. */
  onBeforeEmbedImage?(data: Uint8Array): Uint8Array;

  /**
   * Called before serialization. Can modify document structure.
   * May be async (e.g. for network-dependent plugins).
   */
  onBeforeSave?(doc: PluginDocument): void | Promise<void>;

  /**
   * Called after serialization. Can post-process the final PDF bytes.
   * May be async.
   */
  onAfterSave?(bytes: Uint8Array): Uint8Array | Promise<Uint8Array>;

  /** Called to add custom entries to the document catalog dict. */
  onBuildCatalog?(catalog: PdfDict): void;

  /** Called to add custom entries to page dictionaries. */
  onBuildPageDict?(pageDict: PdfDict, pageIndex: number): void;
}

// ---------------------------------------------------------------------------
// PdfPluginManager
// ---------------------------------------------------------------------------

/**
 * Manages plugin registration, ordering, and hook execution.
 *
 * Plugins execute in registration order for every hook.
 */
export class PdfPluginManager {
  private readonly plugins: PdfPlugin[] = [];

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a plugin. Plugins execute in registration order.
   *
   * @throws {Error} If a plugin with the same name is already registered.
   */
  register(plugin: PdfPlugin): void {
    if (!plugin.name) {
      throw new Error('Plugin must have a non-empty name');
    }
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.push(plugin);
  }

  /**
   * Unregister a plugin by name.
   *
   * @returns `true` if the plugin was found and removed, `false` otherwise.
   */
  unregister(name: string): boolean {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) return false;
    this.plugins.splice(idx, 1);
    return true;
  }

  /** Get a registered plugin by name. */
  get(name: string): PdfPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /** List all registered plugins in registration order. */
  list(): readonly PdfPlugin[] {
    return this.plugins;
  }

  /** Check whether any plugins are registered. */
  get hasPlugins(): boolean {
    return this.plugins.length > 0;
  }

  // -----------------------------------------------------------------------
  // Hook execution
  // -----------------------------------------------------------------------

  /**
   * Execute the `onRegister` hook on a single plugin.
   * Called internally when `.use()` is called on a document.
   */
  executeOnRegister(plugin: PdfPlugin, doc: PluginDocument): void {
    if (plugin.onRegister) {
      plugin.onRegister(doc);
    }
  }

  /**
   * Execute `onBeforeAddPage` across all plugins in order.
   * Each plugin may modify the page size; the final result is returned.
   */
  executeOnBeforeAddPage(size: PageSize): PageSize {
    let current = size;
    for (const plugin of this.plugins) {
      if (plugin.onBeforeAddPage) {
        current = plugin.onBeforeAddPage(current);
      }
    }
    return current;
  }

  /**
   * Execute `onAfterAddPage` across all plugins in order.
   */
  executeOnAfterAddPage(page: PluginPage, doc: PluginDocument): void {
    for (const plugin of this.plugins) {
      if (plugin.onAfterAddPage) {
        plugin.onAfterAddPage(page, doc);
      }
    }
  }

  /**
   * Execute `onBeforeEmbedFont` across all plugins in order.
   * Each plugin may modify the data/options; the final result is returned.
   */
  executeOnBeforeEmbedFont(
    data: Uint8Array,
    options: EmbedFontOptions,
  ): { data: Uint8Array; options: EmbedFontOptions } {
    let current = { data, options };
    for (const plugin of this.plugins) {
      if (plugin.onBeforeEmbedFont) {
        current = plugin.onBeforeEmbedFont(current.data, current.options);
      }
    }
    return current;
  }

  /**
   * Execute `onBeforeEmbedImage` across all plugins in order.
   * Each plugin may transform the image data; the final result is returned.
   */
  executeOnBeforeEmbedImage(data: Uint8Array): Uint8Array {
    let current = data;
    for (const plugin of this.plugins) {
      if (plugin.onBeforeEmbedImage) {
        current = plugin.onBeforeEmbedImage(current);
      }
    }
    return current;
  }

  /**
   * Execute `onBeforeSave` across all plugins in order.
   * Awaits each plugin sequentially to maintain ordering guarantees.
   */
  async executeOnBeforeSave(doc: PluginDocument): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onBeforeSave) {
        await plugin.onBeforeSave(doc);
      }
    }
  }

  /**
   * Execute `onAfterSave` across all plugins in order.
   * Each plugin may transform the output bytes; the final result is returned.
   */
  async executeOnAfterSave(bytes: Uint8Array): Promise<Uint8Array> {
    let current = bytes;
    for (const plugin of this.plugins) {
      if (plugin.onAfterSave) {
        current = await plugin.onAfterSave(current);
      }
    }
    return current;
  }

  /**
   * Execute `onBuildCatalog` across all plugins in order.
   */
  executeOnBuildCatalog(catalog: PdfDict): void {
    for (const plugin of this.plugins) {
      if (plugin.onBuildCatalog) {
        plugin.onBuildCatalog(catalog);
      }
    }
  }

  /**
   * Execute `onBuildPageDict` across all plugins in order.
   */
  executeOnBuildPageDict(pageDict: PdfDict, pageIndex: number): void {
    for (const plugin of this.plugins) {
      if (plugin.onBuildPageDict) {
        plugin.onBuildPageDict(pageDict, pageIndex);
      }
    }
  }
}
