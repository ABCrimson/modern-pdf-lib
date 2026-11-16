/**
 * @module plugins/builtins/metadataPlugin
 *
 * Built-in plugin that sets the producer and creator strings when it is
 * registered, re-affirms the producer before every save, and fills in a
 * default title and author at save when the document has none. A save is
 * `save()` and the calls built on it (`saveAsBlob()`, `saveAsBase64()`,
 * `copy()`); `saveAsStream()` runs no plugin hook, so it writes the
 * producer and creator set at registration and no default title or author.
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { metadataPlugin } from 'modern-pdf-lib/plugins';
 *
 * const doc = createPdf();
 * doc.use(metadataPlugin({ producer: 'My App v2.0', defaultTitle: 'Invoice' }));
 * ```
 */

import type { PdfPlugin, PluginDocument } from '../pluginSystem.js';

/** Options for the metadata plugin. */
export interface MetadataPluginOptions {
  /**
   * Producer string to set on the document.
   * Default: `'modern-pdf-lib'`.
   */
  producer?: string | undefined;

  /**
   * Creator string (e.g. application name), written to the document's
   * `/Creator` entry when the plugin is registered. Without it the
   * plugin leaves the creator as it is.
   */
  creator?: string | undefined;

  /**
   * Title to use when the document has none (or an empty one) at `save()`
   * (and `saveAsBlob()`, `saveAsBase64()`, `copy()`; `saveAsStream()` runs
   * no plugin hook and writes no default). The title is set on the
   * document, so `getTitle()` returns it after that call. A title the
   * caller set, before or after registering the plugin, is kept. An empty
   * string writes nothing.
   */
  defaultTitle?: string | undefined;

  /**
   * Author to use when the document has none (or an empty one) at `save()`
   * (and `saveAsBlob()`, `saveAsBase64()`, `copy()`; `saveAsStream()` runs
   * no plugin hook and writes no default). The author is set on the
   * document, so `getAuthor()` returns it after that call. An author the
   * caller set, before or after registering the plugin, is kept. An empty
   * string writes nothing.
   */
  defaultAuthor?: string | undefined;
}

/** True when `current` is absent or empty and `fallback` has text to put in its place. */
function needsDefault(
  current: string | undefined,
  fallback: string | undefined,
): fallback is string {
  return (current === undefined || current === '') && fallback !== undefined && fallback !== '';
}

/**
 * Create a metadata plugin instance.
 *
 * @param options  Optional configuration.
 * @returns        A {@link PdfPlugin} that manages document metadata.
 */
export function metadataPlugin(options?: MetadataPluginOptions): PdfPlugin {
  const producer = options?.producer ?? 'modern-pdf-lib';
  const creator = options?.creator;
  const defaultTitle = options?.defaultTitle;
  const defaultAuthor = options?.defaultAuthor;

  return {
    name: 'metadata',
    version: '1.0.0',

    onRegister(doc: PluginDocument): void {
      doc.setProducer(producer);
      if (creator !== undefined) doc.setCreator(creator);
    },

    onBeforeSave(doc: PluginDocument): void {
      // Re-affirm producer in case it was overwritten
      doc.setProducer(producer);
      if (needsDefault(doc.getTitle(), defaultTitle)) doc.setTitle(defaultTitle);
      if (needsDefault(doc.getAuthor(), defaultAuthor)) doc.setAuthor(defaultAuthor);
    },
  };
}
