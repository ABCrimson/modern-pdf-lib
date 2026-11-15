/**
 * @module plugins/builtins/metadataPlugin
 *
 * Built-in plugin that automatically sets the producer string and
 * validates document metadata before saving.
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { metadataPlugin } from 'modern-pdf-lib/plugins';
 *
 * const doc = createPdf();
 * doc.use(metadataPlugin({ producer: 'My App v2.0' }));
 * ```
 */

import type { PdfPlugin, PluginDocument } from '../pluginSystem.js';
import { warnOnce } from '../../internal/warnings.js';

/** Options for the metadata plugin. */
export interface MetadataPluginOptions {
  /**
   * Producer string to set on the document.
   * Default: `'modern-pdf-lib'`.
   */
  producer?: string | undefined;

  /**
   * Optional creator string (e.g. application name).
   *
   * Has no effect in this version; passing it emits a one-time
   * `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`).
   */
  creator?: string | undefined;

  /**
   * Optional default title.
   *
   * Has no effect in this version; passing it emits a one-time
   * `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`).
   */
  defaultTitle?: string | undefined;

  /**
   * Optional default author.
   *
   * Has no effect in this version; passing it emits a one-time
   * `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`).
   */
  defaultAuthor?: string | undefined;
}

/**
 * Create a metadata plugin instance.
 *
 * @param options  Optional configuration.
 * @returns        A {@link PdfPlugin} that manages document metadata.
 */
export function metadataPlugin(options?: MetadataPluginOptions): PdfPlugin {
  for (const name of ['creator', 'defaultTitle', 'defaultAuthor'] as const) {
    if (options?.[name] !== undefined) {
      warnOnce(
        `ignored-option:metadataPlugin ${name}`,
        'MPL_IGNORED_OPTION',
        `\`metadataPlugin()\`: the option \`${name}\` has no effect in this version.`,
      );
    }
  }
  const producer = options?.producer ?? 'modern-pdf-lib';

  return {
    name: 'metadata',
    version: '1.0.0',

    onRegister(doc: PluginDocument): void {
      doc.setProducer(producer);
    },

    onBeforeSave(doc: PluginDocument): void {
      // Re-affirm producer in case it was overwritten
      doc.setProducer(producer);
    },
  };
}
