/**
 * @module core/pieceInfo
 *
 * Builds a `/PieceInfo` dictionary holding private, application-specific
 * page or document data.  PDF processors that do not recognise an
 * application's key must preserve its data dictionary verbatim, which makes
 * `/PieceInfo` the standard place to round-trip proprietary metadata.
 *
 * The structure is:
 *
 * ```
 * /PieceInfo <<
 *   /AppName <<                 % one entry per producing application
 *     /LastModified (D:…)       % required PDF date string
 *     /Private << … >>          % arbitrary application-private data
 *   >>
 * >>
 * ```
 *
 * Reference: ISO 32000-2 §14.5 (Page-piece dictionaries).
 */

import { PdfDict, PdfString } from './pdfObjects.js';
import { formatPdfDate } from './pdfCatalog.js';

/**
 * Build a `/PieceInfo` dictionary containing a single application data
 * dictionary.
 *
 * @param appName       The producing application's name; becomes the key of
 *                      the data dictionary inside `/PieceInfo` (the leading
 *                      `/` is optional and added if missing).
 * @param privateData   The application-private data dictionary stored under
 *                      `/Private`.
 * @param lastModified  Modification timestamp for `/LastModified`; defaults
 *                      to the current time.
 * @returns             A `/PieceInfo` dictionary with one entry keyed by
 *                      `appName`.
 */
export function buildPieceInfo(
  appName: string,
  privateData: PdfDict,
  lastModified?: Date,
): PdfDict {
  const dataDict = new PdfDict();
  dataDict.set('/LastModified', PdfString.literal(formatPdfDate(lastModified ?? new Date())));
  dataDict.set('/Private', privateData);

  const pieceInfo = new PdfDict();
  pieceInfo.set(appName, dataDict);
  return pieceInfo;
}
