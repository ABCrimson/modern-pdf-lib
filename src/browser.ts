/**
 * Browser-optimized entry point for modern-pdf-lib.
 *
 * Includes all functionality from the main entry plus browser-specific
 * utilities for downloading, blob creation, and data URL generation.
 *
 * @module modern-pdf-lib/browser
 * @packageDocumentation
 */

// Re-export everything from the main entry
export * from './index.js';

// Browser-specific utilities (will be added in v0.16.9)
// export { saveAsDownload, saveAsBlob, saveAsDataUrl } from './browser/download.js';
