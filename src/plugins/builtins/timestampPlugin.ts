/**
 * @module plugins/builtins/timestampPlugin
 *
 * Built-in plugin that automatically sets creation and modification
 * dates on the document before saving.
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

import type { PdfPlugin, PluginDocument } from '../pluginSystem.js';

/** Options for the timestamp plugin. */
export interface TimestampPluginOptions {
  /**
   * When `true`, set the creation date on register (if not already set).
   * Default: `true`.
   */
  setCreationDate?: boolean | undefined;

  /**
   * When `true`, update the modification date before each save.
   * Default: `true`.
   */
  setModificationDate?: boolean | undefined;
}

/**
 * Create a timestamp plugin instance.
 *
 * @param options  Optional configuration.
 * @returns        A {@link PdfPlugin} that manages document timestamps.
 */
export function timestampPlugin(options?: TimestampPluginOptions): PdfPlugin {
  const setCreation = options?.setCreationDate ?? true;
  const setModification = options?.setModificationDate ?? true;

  return {
    name: 'timestamp',
    version: '1.0.0',

    onRegister(doc: PluginDocument): void {
      if (setCreation) {
        doc.setCreationDate(new Date());
      }
    },

    onBeforeSave(doc: PluginDocument): void {
      if (setModification) {
        doc.setModDate(new Date());
      }
    },
  };
}
