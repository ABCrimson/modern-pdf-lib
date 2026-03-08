/**
 * @module layout/headerFooter
 *
 * Header and footer engine for automatic page numbering, dates, and
 * running headers/footers.  Applies template-based text content to
 * page edges with optional separator lines.
 *
 * Template variables:
 * - `{page}`       — current page number (Arabic)
 * - `{pages}`      — total page count
 * - `{date}`       — current date (formatted per `dateFormat`)
 * - `{title}`      — document title
 * - `{page:roman}` — page number as Roman numeral
 * - `{page:alpha}` — page number as lowercase letter (a, b, c, ...)
 */

import type { PdfPage, FontRef } from '../core/pdfPage.js';
import type { PdfDocument } from '../core/pdfDocument.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HeaderFooterPosition = 'left' | 'center' | 'right';

export interface HeaderFooterContent {
  /** Static text or template string with variables: {page}, {pages}, {date}, {title} */
  text: string;
  position: HeaderFooterPosition;
  font?: FontRef | string;
  fontSize?: number;
  color?: Color;
  bold?: boolean;
  italic?: boolean;
}

export interface HeaderFooterOptions {
  header?: HeaderFooterContent[];
  footer?: HeaderFooterContent[];
  /** Margins from page edge in points. Default: { top: 36, bottom: 36, left: 50, right: 50 } */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Skip first page (e.g. for title page). Default: false */
  skipFirstPage?: boolean;
  /** Page range to apply to. Default: all pages. */
  pageRange?: { start?: number; end?: number };
  /** Separator line between header/footer and content. */
  separatorLine?: { width?: number; color?: Color; dashPattern?: number[] };
  /** Date format string. Default: 'YYYY-MM-DD' */
  dateFormat?: string;
}

// ---------------------------------------------------------------------------
// Default margins
// ---------------------------------------------------------------------------

const DEFAULT_MARGINS = { top: 36, bottom: 36, left: 50, right: 50 } as const;
const DEFAULT_FONT_SIZE = 10;
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

/** Convert an integer to a lowercase Roman numeral string. */
export function toRoman(num: number): string {
  if (num <= 0) return String(num);
  const lookup: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let result = '';
  let remaining = num;
  for (const [value, symbol] of lookup) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

/** Convert an integer to a lowercase alphabetic string (1=a, 2=b, ..., 27=aa). */
export function toAlpha(num: number): string {
  if (num <= 0) return String(num);
  let result = '';
  let remaining = num;
  while (remaining > 0) {
    remaining--;
    result = String.fromCharCode(97 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
}

/** Format a Date according to a simple format string. */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replaceAll('YYYY', String(year))
    .replaceAll('MM', month)
    .replaceAll('DD', day)
    .replaceAll('HH', hours)
    .replaceAll('mm', minutes)
    .replaceAll('ss', seconds);
}

/** Replace template variables in a text string. */
export function replaceTemplateVariables(
  text: string,
  pageNumber: number,
  totalPages: number,
  date: Date,
  dateFormat: string,
  title: string,
): string {
  return text
    .replaceAll('{page:roman}', toRoman(pageNumber))
    .replaceAll('{page:alpha}', toAlpha(pageNumber))
    .replaceAll('{page}', String(pageNumber))
    .replaceAll('{pages}', String(totalPages))
    .replaceAll('{date}', formatDate(date, dateFormat))
    .replaceAll('{title}', title);
}

// ---------------------------------------------------------------------------
// Text width estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the rendered width of a text string in points.
 * Uses the FontRef's `widthOfTextAtSize()` when available,
 * otherwise falls back to a heuristic (0.5 * fontSize per char).
 */
function estimateWidth(text: string, font: FontRef | string | undefined, fontSize: number): number {
  if (font && typeof font === 'object' && 'widthOfTextAtSize' in font) {
    return font.widthOfTextAtSize(text, fontSize);
  }
  return text.length * fontSize * 0.5;
}

// ---------------------------------------------------------------------------
// Core rendering
// ---------------------------------------------------------------------------

/**
 * Apply header/footer to a single page.
 *
 * @param page        The page to draw on.
 * @param options     Header/footer configuration.
 * @param pageNumber  1-based page number.
 * @param totalPages  Total page count in the document.
 * @param title       Optional document title for `{title}` replacement.
 */
export function applyHeaderFooterToPage(
  page: PdfPage,
  options: HeaderFooterOptions,
  pageNumber: number,
  totalPages: number,
  title?: string,
): void {
  const margins = {
    top: options.margins?.top ?? DEFAULT_MARGINS.top,
    bottom: options.margins?.bottom ?? DEFAULT_MARGINS.bottom,
    left: options.margins?.left ?? DEFAULT_MARGINS.left,
    right: options.margins?.right ?? DEFAULT_MARGINS.right,
  };

  const dateFormat = options.dateFormat ?? DEFAULT_DATE_FORMAT;
  const now = new Date();
  const effectiveTitle = title ?? '';

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;

  // --- Header ---
  if (options.header && options.header.length > 0) {
    const headerY = pageHeight - margins.top;

    for (const item of options.header) {
      const fontSize = item.fontSize ?? DEFAULT_FONT_SIZE;
      const resolvedText = replaceTemplateVariables(
        item.text, pageNumber, totalPages, now, dateFormat, effectiveTitle,
      );
      const textWidth = estimateWidth(resolvedText, item.font, fontSize);

      let x: number;
      if (item.position === 'center') {
        x = margins.left + (contentWidth - textWidth) / 2;
      } else if (item.position === 'right') {
        x = pageWidth - margins.right - textWidth;
      } else {
        x = margins.left;
      }

      page.drawText(resolvedText, {
        x,
        y: headerY,
        font: item.font,
        size: fontSize,
        color: item.color,
      });
    }

    // Header separator line
    if (options.separatorLine) {
      const lineY = headerY - (options.header[0]?.fontSize ?? DEFAULT_FONT_SIZE) - 4;
      page.drawLine({
        start: { x: margins.left, y: lineY },
        end: { x: pageWidth - margins.right, y: lineY },
        thickness: options.separatorLine.width ?? 0.5,
        color: options.separatorLine.color,
        dashArray: options.separatorLine.dashPattern,
      });
    }
  }

  // --- Footer ---
  if (options.footer && options.footer.length > 0) {
    const footerY = margins.bottom;

    for (const item of options.footer) {
      const fontSize = item.fontSize ?? DEFAULT_FONT_SIZE;
      const resolvedText = replaceTemplateVariables(
        item.text, pageNumber, totalPages, now, dateFormat, effectiveTitle,
      );
      const textWidth = estimateWidth(resolvedText, item.font, fontSize);

      let x: number;
      if (item.position === 'center') {
        x = margins.left + (contentWidth - textWidth) / 2;
      } else if (item.position === 'right') {
        x = pageWidth - margins.right - textWidth;
      } else {
        x = margins.left;
      }

      page.drawText(resolvedText, {
        x,
        y: footerY,
        font: item.font,
        size: fontSize,
        color: item.color,
      });
    }

    // Footer separator line (above the footer text)
    if (options.separatorLine) {
      const lineY = footerY + (options.footer[0]?.fontSize ?? DEFAULT_FONT_SIZE) + 4;
      page.drawLine({
        start: { x: margins.left, y: lineY },
        end: { x: pageWidth - margins.right, y: lineY },
        thickness: options.separatorLine.width ?? 0.5,
        color: options.separatorLine.color,
        dashArray: options.separatorLine.dashPattern,
      });
    }
  }
}

/**
 * Apply headers and footers to all pages in a document.
 *
 * Respects `skipFirstPage` and `pageRange` options.
 *
 * @param doc      The PDF document.
 * @param options  Header/footer configuration.
 */
export function applyHeaderFooter(doc: PdfDocument, options: HeaderFooterOptions): void {
  const pages = doc.getPages();
  const totalPages = pages.length;
  const title = doc.getTitle() ?? '';

  const rangeStart = options.pageRange?.start ?? 1;
  const rangeEnd = options.pageRange?.end ?? totalPages;

  for (let i = 0; i < totalPages; i++) {
    const pageNumber = i + 1;

    // Skip first page if requested
    if (options.skipFirstPage && pageNumber === 1) continue;

    // Skip pages outside the range
    if (pageNumber < rangeStart || pageNumber > rangeEnd) continue;

    applyHeaderFooterToPage(pages[i]!, options, pageNumber, totalPages, title);
  }
}
