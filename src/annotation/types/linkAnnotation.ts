/**
 * @module annotation/types/linkAnnotation
 *
 * Link annotation — a clickable region that navigates to a destination
 * within the document or opens an external URL.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.5 (Link Annotations).
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
} from '../../core/pdfObjects.js';
import type { PdfObject, PdfRef } from '../../core/pdfObjects.js';
import { PdfAnnotation, buildAnnotationDict } from '../pdfAnnotation.js';
import type { AnnotationOptions } from '../pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Highlight mode
// ---------------------------------------------------------------------------

/** Visual effect when clicking the link. */
export type LinkHighlightMode = 'None' | 'Invert' | 'Outline' | 'Push';

// ---------------------------------------------------------------------------
// PdfLinkAnnotation
// ---------------------------------------------------------------------------

/**
 * A link annotation (subtype /Link).
 *
 * Provides navigation to a destination within the document or to an
 * external URI.
 */
export class PdfLinkAnnotation extends PdfAnnotation {
  constructor(dict: PdfDict) {
    super('Link', dict);
  }

  /**
   * Create a new link annotation.
   */
  static create(
    options: AnnotationOptions & {
      url?: string | undefined;
      pageIndex?: number | undefined;
      fit?: string | undefined;
      highlightMode?: LinkHighlightMode | undefined;
    },
  ): PdfLinkAnnotation {
    const dict = buildAnnotationDict('Link', options);
    const annot = new PdfLinkAnnotation(dict);
    if (options.url !== undefined) {
      annot.setUrl(options.url);
    }
    if (options.pageIndex !== undefined) {
      annot.setDestination(options.pageIndex, options.fit);
    }
    if (options.highlightMode !== undefined) {
      annot.setHighlightMode(options.highlightMode);
    }
    return annot;
  }

  /**
   * Create from an existing dictionary.
   */
  static fromDict(
    dict: PdfDict,
    resolver?: (ref: PdfRef) => PdfObject | undefined,
  ): PdfLinkAnnotation {
    return new PdfLinkAnnotation(dict);
  }

  // -----------------------------------------------------------------------
  // Destination
  // -----------------------------------------------------------------------

  /**
   * Get the destination (named dest string or explicit dest array).
   *
   * Returns:
   * - A string for named destinations.
   * - An array `[pageIndex, fitMode, ...params]` for explicit destinations.
   * - `undefined` if no destination is set.
   */
  getDestination(): string | [number, string, ...number[]] | undefined {
    const obj = this.dict.get('/Dest');
    if (!obj) return undefined;
    if (obj.kind === 'string') {
      return obj.value;
    }
    if (obj.kind === 'array' && obj.items.length >= 2) {
      const fitObj = obj.items[1];
      const fitName = fitObj && fitObj.kind === 'name'
        ? (fitObj.value.startsWith('/') ? fitObj.value.slice(1) : fitObj.value)
        : 'Fit';
      const pageNum = obj.items[0] && obj.items[0].kind === 'number'
        ? obj.items[0].value
        : 0;
      const extra: number[] = [];
      for (let i = 2; i < obj.items.length; i++) {
        const item = obj.items[i];
        if (item && item.kind === 'number') {
          extra.push(item.value);
        }
      }
      return [pageNum, fitName, ...extra];
    }
    return undefined;
  }

  /**
   * Set an explicit destination (page index + fit mode).
   *
   * @param pageIndex  Zero-based page index.
   * @param fit        Fit mode (defaults to 'Fit').
   */
  setDestination(pageIndex: number, fit?: string | undefined): void {
    const fitName = fit ?? 'Fit';
    this.dict.set(
      '/Dest',
      PdfArray.of([PdfNumber.of(pageIndex), PdfName.of(fitName)]),
    );
  }

  // -----------------------------------------------------------------------
  // URL (URI action)
  // -----------------------------------------------------------------------

  /** Get the URL if this is a URI link. */
  getUrl(): string | undefined {
    const action = this.dict.get('/A');
    if (action && action.kind === 'dict') {
      const uri = action.get('/URI');
      if (uri && uri.kind === 'string') {
        return uri.value;
      }
    }
    return undefined;
  }

  /** Set the URL (creates a /URI action). */
  setUrl(url: string): void {
    const action = new PdfDict();
    action.set('/S', PdfName.of('URI'));
    action.set('/URI', PdfString.literal(url));
    this.dict.set('/A', action);
  }

  // -----------------------------------------------------------------------
  // Highlight mode
  // -----------------------------------------------------------------------

  /** Get the highlight mode. Defaults to 'Invert'. */
  getHighlightMode(): LinkHighlightMode {
    const obj = this.dict.get('/H');
    if (obj && obj.kind === 'name') {
      const val = obj.value.startsWith('/') ? obj.value.slice(1) : obj.value;
      const modeMap: Record<string, LinkHighlightMode> = {
        N: 'None',
        I: 'Invert',
        O: 'Outline',
        P: 'Push',
        None: 'None',
        Invert: 'Invert',
        Outline: 'Outline',
        Push: 'Push',
      };
      return modeMap[val] ?? 'Invert';
    }
    return 'Invert';
  }

  /** Set the highlight mode. */
  setHighlightMode(mode: LinkHighlightMode): void {
    const shortMap: Record<LinkHighlightMode, string> = {
      None: 'N',
      Invert: 'I',
      Outline: 'O',
      Push: 'P',
    };
    this.dict.set('/H', PdfName.of(shortMap[mode]));
  }
}
