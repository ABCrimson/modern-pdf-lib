/**
 * @module metadata/pdfViewerPreferences
 *
 * Class-based API for PDF viewer preferences with individual getter/setter
 * pairs.  Provides the same functionality as the plain {@link ViewerPreferences}
 * interface but with a more discoverable, pdf-lib-compatible API.
 */

import type { ViewerPreferences } from './viewerPreferences.js';
import { buildViewerPreferencesDict } from './viewerPreferences.js';
import type { PdfDict } from '../core/pdfObjects.js';

/**
 * Class-based API for PDF viewer preferences with individual getter/setter pairs.
 *
 * Provides the same functionality as the plain `ViewerPreferences` interface
 * but with a more discoverable, pdf-lib-compatible API.
 *
 * ```ts
 * const prefs = doc.getViewerPreferences();
 * prefs.setHideToolbar(true);
 * prefs.setDisplayDocTitle(true);
 * prefs.setPrintScaling('None');
 * ```
 */
export class PdfViewerPreferences {
  private data: ViewerPreferences;

  constructor(data: ViewerPreferences = {}) {
    this.data = { ...data };
  }

  // --- Boolean properties (7 total) ---

  /** Whether the viewer's toolbar should be hidden. */
  getHideToolbar(): boolean { return this.data.hideToolbar ?? false; }
  /** Set whether the viewer's toolbar should be hidden. */
  setHideToolbar(value: boolean): void { this.data.hideToolbar = value; }

  /** Whether the viewer's menu bar should be hidden. */
  getHideMenubar(): boolean { return this.data.hideMenubar ?? false; }
  /** Set whether the viewer's menu bar should be hidden. */
  setHideMenubar(value: boolean): void { this.data.hideMenubar = value; }

  /** Whether the viewer's window UI elements should be hidden. */
  getHideWindowUI(): boolean { return this.data.hideWindowUI ?? false; }
  /** Set whether the viewer's window UI elements should be hidden. */
  setHideWindowUI(value: boolean): void { this.data.hideWindowUI = value; }

  /** Whether the document window should be resized to fit the first page. */
  getFitWindow(): boolean { return this.data.fitWindow ?? false; }
  /** Set whether the document window should be resized to fit the first page. */
  setFitWindow(value: boolean): void { this.data.fitWindow = value; }

  /** Whether the document window should be centered on the screen. */
  getCenterWindow(): boolean { return this.data.centerWindow ?? false; }
  /** Set whether the document window should be centered on the screen. */
  setCenterWindow(value: boolean): void { this.data.centerWindow = value; }

  /** Whether the title bar should display the document title from metadata. */
  getDisplayDocTitle(): boolean { return this.data.displayDocTitle ?? false; }
  /** Set whether the title bar should display the document title. */
  setDisplayDocTitle(value: boolean): void { this.data.displayDocTitle = value; }

  /** Whether the paper tray should be selected based on the PDF page size. */
  getPickTrayByPDFSize(): boolean { return this.data.pickTrayByPDFSize ?? false; }
  /** Set whether the paper tray should be selected based on the PDF page size. */
  setPickTrayByPDFSize(value: boolean): void { this.data.pickTrayByPDFSize = value; }

  // --- Enum properties (4 total) ---

  /** Page mode to use when exiting full-screen mode. */
  getNonFullScreenPageMode(): 'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC' {
    return this.data.nonFullScreenPageMode ?? 'UseNone';
  }
  /** Set the page mode to use when exiting full-screen mode. */
  setNonFullScreenPageMode(value: 'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC'): void {
    this.data.nonFullScreenPageMode = value;
  }

  /** Predominant reading order for text. */
  getDirection(): 'L2R' | 'R2L' {
    return this.data.direction ?? 'L2R';
  }
  /** Set the predominant reading order for text. */
  setDirection(value: 'L2R' | 'R2L'): void {
    this.data.direction = value;
  }

  /** Page scaling preference for the print dialog. */
  getPrintScaling(): 'None' | 'AppDefault' {
    return this.data.printScaling ?? 'AppDefault';
  }
  /** Set the page scaling preference for the print dialog. */
  setPrintScaling(value: 'None' | 'AppDefault'): void {
    this.data.printScaling = value;
  }

  /** Paper handling option for duplex printing, or undefined if not set. */
  getDuplex(): 'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge' | undefined {
    return this.data.duplex;
  }
  /** Set the paper handling option for duplex printing. */
  setDuplex(value: 'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge'): void {
    this.data.duplex = value;
  }

  // --- Numeric / complex properties (2 total) ---

  /** Default number of copies to print. */
  getNumCopies(): number { return this.data.numCopies ?? 1; }
  /** Set the default number of copies to print. */
  setNumCopies(value: number): void { this.data.numCopies = value; }

  /** Page ranges to print, as [start, end] pairs, or undefined if not set. */
  getPrintPageRange(): [number, number][] | undefined { return this.data.printPageRange; }
  /** Set the page ranges to print, as [start, end] pairs. */
  setPrintPageRange(value: [number, number][]): void { this.data.printPageRange = value; }

  // --- Serialization ---

  /** Convert to a PdfDict for embedding in the PDF catalog. */
  toDict(): PdfDict { return buildViewerPreferencesDict(this.data); }

  /** Convert to a plain ViewerPreferences object. */
  toObject(): ViewerPreferences { return { ...this.data }; }
}
