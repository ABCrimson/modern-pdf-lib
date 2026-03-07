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

// Service Worker helpers for offline PDF generation
export { handlePdfRequest, createPdfResponse, isCacheAvailable } from './browser/serviceWorker.js';

// Browser-specific utilities
export { saveAsDownload, saveAsBlob, saveAsDataUrl, openInNewTab } from './browser/download.js';
