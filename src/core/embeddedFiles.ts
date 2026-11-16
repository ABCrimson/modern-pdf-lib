/**
 * @module core/embeddedFiles
 *
 * File attachments (embedded files) in PDF documents.
 *
 * PDF supports embedding arbitrary files within the document.  These
 * are stored as `/EmbeddedFile` streams and organized via a name tree
 * referenced from the catalog's `/Names /EmbeddedFiles` entry.
 *
 * Reference: PDF 1.7 spec, §7.11.4 (Embedded File Streams),
 *            §7.7.4 (Name Trees).
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
  PdfRef,
} from './pdfObjects.js';
import type { PdfObjectRegistry, PdfObject } from './pdfObjects.js';
import { formatPdfDate } from './pdfCatalog.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Describes a file to attach to (or already attached to) a PDF. */
export interface EmbeddedFile {
  /** Filename; written as a PDF text string in `/F`, `/UF` and the name tree key. */
  name: string;
  /** File data. */
  data: Uint8Array;
  /** MIME type (e.g. `"application/pdf"`, `"text/plain"`). */
  mimeType: string;
  /** Optional description, written as a PDF text string. */
  description?: string | undefined;
  /** Optional creation date. */
  creationDate?: Date | undefined;
  /** Optional modification date. */
  modificationDate?: Date | undefined;
  /**
   * Optional PDF 2.0 `/AFRelationship` of this file to the document
   * (`Source`/`Data`/`Alternative`/…). Defaults to `Unspecified`.
   */
  relationship?: string | undefined;
}

// ---------------------------------------------------------------------------
// Attach a file
// ---------------------------------------------------------------------------

/**
 * Create an embedded file stream and filespec dictionary, registering
 * them in the object registry.
 *
 * @param registry  The PDF object registry.
 * @param file      The file to embed.
 * @returns         The indirect reference to the filespec dictionary.
 */
export function attachFile(registry: PdfObjectRegistry, file: EmbeddedFile): PdfRef {
  // 1. Build the embedded file stream
  const efDict = new PdfDict();
  efDict.set('/Type', PdfName.of('EmbeddedFile'));
  if (file.mimeType) {
    efDict.set('/Subtype', PdfName.of(file.mimeType.replace('/', '#2F')));
  }

  // Params sub-dictionary
  const params = new PdfDict();
  params.set('/Size', PdfNumber.of(file.data.length));
  if (file.creationDate !== undefined) {
    params.set('/CreationDate', PdfString.fromAscii(formatPdfDate(file.creationDate)));
  }
  if (file.modificationDate !== undefined) {
    params.set('/ModDate', PdfString.fromAscii(formatPdfDate(file.modificationDate)));
  }
  efDict.set('/Params', params);

  const efStream = PdfStream.fromBytes(new Uint8Array(file.data), efDict);
  const efRef = registry.register(efStream);

  // 2. Build the EF dictionary (holds the embedded file stream reference)
  const efRefDict = new PdfDict();
  efRefDict.set('/F', efRef);
  efRefDict.set('/UF', efRef);

  // 3. Build the filespec dictionary
  const filespec = new PdfDict();
  filespec.set('/Type', PdfName.of('Filespec'));
  const fileName = PdfString.fromText(file.name);
  filespec.set('/F', fileName);
  filespec.set('/UF', fileName);
  filespec.set('/EF', efRefDict);

  if (file.description !== undefined) {
    filespec.set('/Desc', PdfString.fromText(file.description));
  }

  // AFRelationship (PDF 2.0 / PDF/A-3)
  filespec.set('/AFRelationship', PdfName.of(file.relationship ?? 'Unspecified'));

  return registry.register(filespec);
}

// ---------------------------------------------------------------------------
// Retrieve attachments
// ---------------------------------------------------------------------------

/**
 * Extract embedded file attachments from a catalog dictionary.
 *
 * @param catalogDict  The catalog dictionary.
 * @param resolver     A function to resolve indirect references.
 * @returns            An array of embedded file descriptions.
 */
export function getAttachments(
  catalogDict: PdfDict,
  resolver: (ref: PdfRef) => PdfObject,
): EmbeddedFile[] {
  const files: EmbeddedFile[] = [];

  // /Names → /EmbeddedFiles → /Names [name1 ref1 name2 ref2 ...]
  const namesObj = catalogDict.get('/Names');
  if (!namesObj) return files;

  let namesDict: PdfDict;
  if (namesObj.kind === 'ref') {
    const resolved = resolver(namesObj as PdfRef);
    if (!resolved || resolved.kind !== 'dict') return files;
    namesDict = resolved as PdfDict;
  } else if (namesObj.kind === 'dict') {
    namesDict = namesObj as PdfDict;
  } else {
    return files;
  }

  const efObj = namesDict.get('/EmbeddedFiles');
  if (!efObj) return files;

  let efDict: PdfDict;
  if (efObj.kind === 'ref') {
    const resolved = resolver(efObj as PdfRef);
    if (!resolved || resolved.kind !== 'dict') return files;
    efDict = resolved as PdfDict;
  } else if (efObj.kind === 'dict') {
    efDict = efObj as PdfDict;
  } else {
    return files;
  }

  const namesArrayObj = efDict.get('/Names');
  if (!namesArrayObj || namesArrayObj.kind !== 'array') return files;

  const namesArray = namesArrayObj as PdfArray;

  // Names array is [name1 ref1 name2 ref2 ...]
  for (let i = 0; i < namesArray.length - 1; i += 2) {
    const nameItem = namesArray.items[i];
    const specItem = namesArray.items[i + 1];

    if (!nameItem || !specItem) continue;

    let fileName = '';
    if (nameItem.kind === 'string') {
      fileName = (nameItem as PdfString).toText();
    }

    let specDict: PdfDict | undefined;
    if (specItem!.kind === 'ref') {
      const resolved = resolver(specItem as PdfRef);
      if (resolved && resolved.kind === 'dict') {
        specDict = resolved as PdfDict;
      }
    } else if (specItem!.kind === 'dict') {
      specDict = specItem as PdfDict;
    }

    if (!specDict) continue;

    // Get the /EF dictionary
    const efRefObj = specDict.get('/EF');
    if (!efRefObj || efRefObj.kind !== 'dict') continue;
    const efRefD = efRefObj as PdfDict;

    const fRef = efRefD.get('/F') ?? efRefD.get('/UF');
    if (!fRef) continue;

    let streamObj: PdfStream | undefined;
    if (fRef.kind === 'ref') {
      const resolved = resolver(fRef as PdfRef);
      if (resolved && resolved.kind === 'stream') {
        streamObj = resolved as PdfStream;
      }
    } else if (fRef.kind === 'stream') {
      streamObj = fRef as PdfStream;
    }

    if (!streamObj) continue;

    // Get optional description
    const descObj = specDict.get('/Desc');
    let description: string | undefined;
    if (descObj && descObj.kind === 'string') {
      description = (descObj as PdfString).toText();
    }

    // Get MIME type from /Subtype
    const subtypeObj = streamObj.dict.get('/Subtype');
    let mimeType = 'application/octet-stream';
    if (subtypeObj && subtypeObj.kind === 'name') {
      mimeType = (subtypeObj as PdfName).value.slice(1).replace('#2F', '/');
    }

    // Use filename from /UF or /F in the filespec, fall back to name tree key
    const ufObj = specDict.get('/UF') ?? specDict.get('/F');
    if (ufObj && ufObj.kind === 'string') {
      fileName = (ufObj as PdfString).toText();
    }

    files.push({
      name: fileName,
      data: streamObj.data,
      mimeType,
      ...(description !== undefined ? { description } : {}),
    });
  }

  return files;
}

// ---------------------------------------------------------------------------
// Name tree builder
// ---------------------------------------------------------------------------

/** A name of printable ASCII characters only (U+0020 to U+007E). */
const PRINTABLE_ASCII = /^[ -~]*$/;

/**
 * The encoding of the name-tree keys of `names`: PDFDocEncoding when every name is printable ASCII,
 * otherwise UTF-16BE (FE FF) for all of them. Keys sort by their bytes (ISO 32000-2 7.9.6) and qpdf
 * checks the order of the decoded text; one encoding for the whole tree makes the two orders the
 * same, except for a name with a character above U+FFFF against one with a character from U+E000 to
 * U+FFFF. Mixed encodings would not: "Plain" (50) sorts before "Café" (FE FF 00 43) by bytes, and
 * PDFDocEncoding alone would not either: "€" (0xA0) sorts before "Ü" (0xDC).
 */
export function embeddedFileKeyEncoding(names: readonly string[]): 'pdfdoc' | 'utf-16be' {
  return names.every((name) => PRINTABLE_ASCII.test(name)) ? 'pdfdoc' : 'utf-16be';
}

/**
 * Build an `/EmbeddedFiles` name tree dictionary.
 *
 * Each name is written as a PDF text string in the encoding
 * `embeddedFileKeyEncoding(names)` gives and the pairs are sorted by the bytes
 * of those keys (ISO 32000-2 §7.9.6); a file keeps its own name.
 *
 * @param files     Array of indirect references to filespec dictionaries.
 * @param names     Corresponding file names (same order as `files`).
 * @param registry  The PDF object registry.
 * @returns         The name tree dictionary.
 */
export function buildEmbeddedFilesNameTree(
  files: PdfRef[],
  names: string[],
  _registry: PdfObjectRegistry,
): PdfDict {
  // Build the /Names array: [name1 ref1 name2 ref2 ...]
  const encoding = embeddedFileKeyEncoding(names);
  const entries = files
    .map((file, i) => ({ key: PdfString.fromText(names[i]!, encoding), file }))
    .toSorted((a, b) => PdfString.compare(a.key, b.key));
  const namesArray = new PdfArray();
  for (const { key, file } of entries) {
    namesArray.push(key);
    namesArray.push(file);
  }

  const nameTree = new PdfDict();
  nameTree.set('/Names', namesArray);

  return nameTree;
}
