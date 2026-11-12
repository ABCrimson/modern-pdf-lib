/**
 * @module crypto/signatureContents
 *
 * The one rule, shared by the reader and the writer, for the string that
 * encryption leaves alone inside a signature dictionary.
 *
 * ISO 32000-2:2020, 7.6.1 and 12.8.1: the `/Contents` of a signature
 * dictionary is not encrypted, so that the signed byte ranges and the
 * signature value stay as the signer wrote them. The dictionary is
 * recognised by its `/Type` (`/Sig`, or `/DocTimeStamp` for a document
 * timestamp) or, because `/Type` is optional in a signature dictionary, by
 * having no type name together with both `/ByteRange` and `/Contents`.
 * qpdf exempts a narrower set (only `/Type /Sig` with `/ByteRange`).
 *
 * @packageDocumentation
 */

import type { PdfDict } from '../core/pdfObjects.js';

/**
 * True when the `/Contents` of `dict` is left as stored by encryption and
 * decryption: its `/Type` is the name `/Sig` or `/DocTimeStamp`, or it has
 * no `/Type` name (no `/Type` entry, or one whose value is not a name) and
 * has both `/ByteRange` and `/Contents`.
 *
 * @param dict - A dictionary of an encrypted (or to be encrypted) document.
 */
export function contentsLeftAsStored(dict: PdfDict): boolean {
  const type = dict.get('/Type');
  const typeName = type?.kind === 'name' ? type.value : undefined;
  return (
    typeName === '/Sig' ||
    typeName === '/DocTimeStamp' ||
    (typeName === undefined && dict.has('/ByteRange') && dict.has('/Contents'))
  );
}
