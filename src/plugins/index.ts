/**
 * @module plugins
 *
 * Plugin system for the modern-pdf-lib PDF creation pipeline.
 *
 * Re-exports the core plugin types and built-in plugins.
 */

// Core plugin system
export { PdfPluginManager } from './pluginSystem.js';
export type { PdfPlugin, PluginDocument, PluginPage } from './pluginSystem.js';

// Built-in plugins
export { timestampPlugin } from './builtins/timestampPlugin.js';
export type { TimestampPluginOptions } from './builtins/timestampPlugin.js';

export { metadataPlugin } from './builtins/metadataPlugin.js';
export type { MetadataPluginOptions } from './builtins/metadataPlugin.js';

export { accessibilityPlugin } from './builtins/accessibilityPlugin.js';
export type { AccessibilityPluginOptions } from './builtins/accessibilityPlugin.js';
