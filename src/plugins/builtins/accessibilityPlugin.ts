/**
 * @module plugins/builtins/accessibilityPlugin
 *
 * Built-in plugin that automatically adds accessibility features:
 * - Document language tag
 * - Mark the catalog for tagged PDF (via onBuildCatalog)
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { accessibilityPlugin } from 'modern-pdf-lib/plugins';
 *
 * const doc = createPdf();
 * doc.use(accessibilityPlugin({ language: 'en-US' }));
 * ```
 */

import { PdfName, PdfBool, PdfDict } from '../../core/pdfObjects.js';
import type { PdfPlugin, PluginDocument } from '../pluginSystem.js';

/** Options for the accessibility plugin. */
export interface AccessibilityPluginOptions {
  /**
   * BCP 47 language tag for the document (e.g. `'en-US'`, `'de-DE'`).
   * Default: `'en'`.
   */
  language?: string | undefined;

  /**
   * When `true`, add a `/MarkInfo` dictionary with `/Marked true`
   * to the catalog, signaling tagged PDF.
   * Default: `true`.
   */
  markAsTagged?: boolean | undefined;
}

/**
 * Create an accessibility plugin instance.
 *
 * @param options  Optional configuration.
 * @returns        A {@link PdfPlugin} that adds accessibility features.
 */
export function accessibilityPlugin(options?: AccessibilityPluginOptions): PdfPlugin {
  const language = options?.language ?? 'en';
  const markAsTagged = options?.markAsTagged ?? true;

  return {
    name: 'accessibility',
    version: '1.0.0',

    onRegister(doc: PluginDocument): void {
      doc.setLanguage(language);
    },

    onBuildCatalog(catalog: PdfDict): void {
      if (markAsTagged && !catalog.has('/MarkInfo')) {
        const markInfoDict = new PdfDict();
        markInfoDict.set('/Marked', PdfBool.of(true));
        catalog.set('/MarkInfo', markInfoDict);
      }

      // Add /ViewerPreferences with /DisplayDocTitle true for
      // screen reader friendliness.
      if (!catalog.has('/ViewerPreferences')) {
        const vpDict = new PdfDict();
        vpDict.set('/DisplayDocTitle', PdfBool.of(true));
        catalog.set('/ViewerPreferences', vpDict);
      }
    },
  };
}
