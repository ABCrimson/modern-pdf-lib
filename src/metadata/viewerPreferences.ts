/**
 * @module metadata/viewerPreferences
 *
 * PDF Viewer Preferences dictionary builder and parser.
 *
 * The `/ViewerPreferences` dictionary in the PDF catalog controls how
 * the document is displayed when opened in a viewer application.
 *
 * Reference: PDF 1.7 spec SS 12.2 (Viewer Preferences).
 *
 * Supported preferences:
 * - **HideToolbar** — hide the viewer toolbar
 * - **HideMenubar** — hide the viewer menu bar
 * - **HideWindowUI** — hide the viewer window controls
 * - **FitWindow** — resize window to fit the first page
 * - **CenterWindow** — center the window on screen
 * - **DisplayDocTitle** — show the document title in the title bar
 * - **NonFullScreenPageMode** — page mode when exiting full screen
 * - **Direction** — reading direction (L2R or R2L)
 * - **PrintScaling** — print scaling preference
 * - **Duplex** — paper handling for duplex printing
 * - **PrintPageRange** — page ranges to print
 * - **NumCopies** — default number of copies
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfBool,
  PdfArray,
} from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// ViewerPreferences interface
// ---------------------------------------------------------------------------

/**
 * Viewer preference settings for a PDF document.
 *
 * All properties are optional.  Omitted properties use the viewer's
 * default behaviour.
 */
export interface ViewerPreferences {
  /** Hide the viewer's toolbar when the document is active. */
  hideToolbar?: boolean | undefined;
  /** Hide the viewer's menu bar when the document is active. */
  hideMenubar?: boolean | undefined;
  /** Hide the viewer's window UI elements (scrollbars, etc.). */
  hideWindowUI?: boolean | undefined;
  /** Resize the document's window to fit the first page. */
  fitWindow?: boolean | undefined;
  /** Center the document's window on the screen. */
  centerWindow?: boolean | undefined;
  /** Display the document title (from /Info /Title) in the title bar. */
  displayDocTitle?: boolean | undefined;
  /** Page mode to use when exiting full-screen mode. */
  nonFullScreenPageMode?: 'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC' | undefined;
  /** Predominant reading order for text. */
  direction?: 'L2R' | 'R2L' | undefined;
  /** Page scaling preference for the print dialog. */
  printScaling?: 'None' | 'AppDefault' | undefined;
  /** Paper handling option for duplex printing. */
  duplex?: 'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge' | undefined;
  /** Page ranges to print, as [start, end] pairs (1-based). */
  printPageRange?: [number, number][] | undefined;
  /** Default number of copies to print. */
  numCopies?: number | undefined;
  /** Whether to pick the paper tray based on the PDF page size. */
  pickTrayByPDFSize?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build a `/ViewerPreferences` dictionary from preferences.
 *
 * Only includes entries for properties that are explicitly set
 * (non-undefined).  Boolean values of `false` are included to
 * explicitly override viewer defaults.
 *
 * @param prefs  Viewer preferences to serialize.
 * @returns      A PdfDict representing the `/ViewerPreferences` entry.
 */
export function buildViewerPreferencesDict(prefs: ViewerPreferences): PdfDict {
  const dict = new PdfDict();

  if (prefs.hideToolbar !== undefined) {
    dict.set('/HideToolbar', PdfBool.of(prefs.hideToolbar));
  }
  if (prefs.hideMenubar !== undefined) {
    dict.set('/HideMenubar', PdfBool.of(prefs.hideMenubar));
  }
  if (prefs.hideWindowUI !== undefined) {
    dict.set('/HideWindowUI', PdfBool.of(prefs.hideWindowUI));
  }
  if (prefs.fitWindow !== undefined) {
    dict.set('/FitWindow', PdfBool.of(prefs.fitWindow));
  }
  if (prefs.centerWindow !== undefined) {
    dict.set('/CenterWindow', PdfBool.of(prefs.centerWindow));
  }
  if (prefs.displayDocTitle !== undefined) {
    dict.set('/DisplayDocTitle', PdfBool.of(prefs.displayDocTitle));
  }
  if (prefs.nonFullScreenPageMode !== undefined) {
    dict.set('/NonFullScreenPageMode', PdfName.of(prefs.nonFullScreenPageMode));
  }
  if (prefs.direction !== undefined) {
    dict.set('/Direction', PdfName.of(prefs.direction));
  }
  if (prefs.printScaling !== undefined) {
    dict.set('/PrintScaling', PdfName.of(prefs.printScaling));
  }
  if (prefs.duplex !== undefined) {
    dict.set('/Duplex', PdfName.of(prefs.duplex));
  }
  if (prefs.printPageRange !== undefined && prefs.printPageRange.length > 0) {
    const numbers: PdfNumber[] = [];
    for (const [start, end] of prefs.printPageRange) {
      numbers.push(PdfNumber.of(start));
      numbers.push(PdfNumber.of(end));
    }
    dict.set('/PrintPageRange', PdfArray.of(numbers));
  }
  if (prefs.numCopies !== undefined) {
    dict.set('/NumCopies', PdfNumber.of(prefs.numCopies));
  }
  if (prefs.pickTrayByPDFSize !== undefined) {
    dict.set('/PickTrayByPDFSize', PdfBool.of(prefs.pickTrayByPDFSize));
  }

  return dict;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a `/ViewerPreferences` dictionary into a ViewerPreferences object.
 *
 * @param dict  The PDF dictionary to parse.
 * @returns     The parsed viewer preferences.
 */
export function parseViewerPreferences(dict: PdfDict): ViewerPreferences {
  const prefs: ViewerPreferences = {};

  const hideToolbar = extractBool(dict.get('/HideToolbar'));
  if (hideToolbar !== undefined) {
    prefs.hideToolbar = hideToolbar;
  }

  const hideMenubar = extractBool(dict.get('/HideMenubar'));
  if (hideMenubar !== undefined) {
    prefs.hideMenubar = hideMenubar;
  }

  const hideWindowUI = extractBool(dict.get('/HideWindowUI'));
  if (hideWindowUI !== undefined) {
    prefs.hideWindowUI = hideWindowUI;
  }

  const fitWindow = extractBool(dict.get('/FitWindow'));
  if (fitWindow !== undefined) {
    prefs.fitWindow = fitWindow;
  }

  const centerWindow = extractBool(dict.get('/CenterWindow'));
  if (centerWindow !== undefined) {
    prefs.centerWindow = centerWindow;
  }

  const displayDocTitle = extractBool(dict.get('/DisplayDocTitle'));
  if (displayDocTitle !== undefined) {
    prefs.displayDocTitle = displayDocTitle;
  }

  const nonFullScreen = extractName(dict.get('/NonFullScreenPageMode'));
  if (
    nonFullScreen === 'UseNone' ||
    nonFullScreen === 'UseOutlines' ||
    nonFullScreen === 'UseThumbs' ||
    nonFullScreen === 'UseOC'
  ) {
    prefs.nonFullScreenPageMode = nonFullScreen;
  }

  const direction = extractName(dict.get('/Direction'));
  if (direction === 'L2R' || direction === 'R2L') {
    prefs.direction = direction;
  }

  const printScaling = extractName(dict.get('/PrintScaling'));
  if (printScaling === 'None' || printScaling === 'AppDefault') {
    prefs.printScaling = printScaling;
  }

  const duplex = extractName(dict.get('/Duplex'));
  if (
    duplex === 'Simplex' ||
    duplex === 'DuplexFlipShortEdge' ||
    duplex === 'DuplexFlipLongEdge'
  ) {
    prefs.duplex = duplex;
  }

  const pageRangeObj = dict.get('/PrintPageRange');
  if (pageRangeObj instanceof PdfArray && pageRangeObj.length >= 2) {
    const ranges: [number, number][] = [];
    for (let i = 0; i + 1 < pageRangeObj.length; i += 2) {
      const start = extractNumber(pageRangeObj.items[i]);
      const end = extractNumber(pageRangeObj.items[i + 1]);
      if (start !== undefined && end !== undefined) {
        ranges.push([start, end]);
      }
    }
    if (ranges.length > 0) {
      prefs.printPageRange = ranges;
    }
  }

  const numCopies = extractNumber(dict.get('/NumCopies'));
  if (numCopies !== undefined) {
    prefs.numCopies = numCopies;
  }

  const pickTrayByPDFSize = extractBool(dict.get('/PickTrayByPDFSize'));
  if (pickTrayByPDFSize !== undefined) {
    prefs.pickTrayByPDFSize = pickTrayByPDFSize;
  }

  return prefs;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract a boolean value from a PdfObject.
 * @internal
 */
function extractBool(obj: PdfObject | undefined): boolean | undefined {
  if (!obj) return undefined;
  if (obj instanceof PdfBool) return obj.value;
  return undefined;
}

/**
 * Extract a name value from a PdfObject (without leading `/`).
 * @internal
 */
function extractName(obj: PdfObject | undefined): string | undefined {
  if (!obj) return undefined;
  if (obj instanceof PdfName) {
    return obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
  }
  return undefined;
}

/**
 * Extract a numeric value from a PdfObject.
 * @internal
 */
function extractNumber(obj: PdfObject | undefined): number | undefined {
  if (!obj) return undefined;
  if (obj instanceof PdfNumber) return obj.value;
  return undefined;
}
