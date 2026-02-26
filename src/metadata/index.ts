/**
 * @module metadata
 *
 * Barrel export for the metadata module (XMP and viewer preferences).
 */

export {
  buildXmpMetadata,
  parseXmpMetadata,
  createXmpStream,
} from './xmpMetadata.js';

export {
  buildViewerPreferencesDict,
  parseViewerPreferences,
} from './viewerPreferences.js';

export type { ViewerPreferences } from './viewerPreferences.js';

export { PdfViewerPreferences } from './pdfViewerPreferences.js';
