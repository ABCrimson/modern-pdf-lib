/**
 * @module render/fontExtract
 *
 * Extracts the embedded font programs referenced by a page's `/Resources`
 * `/Font` dictionary.  For every font that carries an embedded font file —
 * `/FontFile` (Type 1), `/FontFile2` (TrueType `glyf`), or `/FontFile3`
 * (CFF / OpenType) — the standalone font bytes are decoded and returned
 * alongside the resource name, base font name, detected format, and a
 * subset flag.
 *
 * The embedded program is the complete font: a `/FontFile2` stream *is* a
 * full sfnt, and a `/FontFile3` stream *is* the CFF or OpenType program.
 * The `/Filter` is applied (via {@link decodeStreamData}) so the returned
 * bytes are the raw, decompressed font.
 *
 * Standard-14 fonts (Helvetica, Times-Roman, …) have no `/FontDescriptor`
 * and no embedded file; they are skipped.  Malformed entries are tolerated
 * rather than throwing.
 *
 * @packageDocumentation
 */

import type { PdfPage } from '../core/pdfPage.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfStream,
  type PdfObject,
  type PdfObjectRegistry,
} from '../core/pdfObjects.js';
import { decodeStreamData } from '../parser/streamDecode.js';

/** The on-disk format of an embedded font program. */
export type FontFileFormat = 'truetype' | 'cff' | 'opentype' | 'type1';

/** A single embedded font program extracted from a page. */
export interface ExtractedFont {
  /** Resource name under `/Font` (e.g. `F1`), without the leading slash. */
  resourceName: string;
  /** The `/BaseFont` PostScript name, with any leading slash stripped. */
  baseFont: string;
  /** Detected font-program format. */
  format: FontFileFormat;
  /** The standalone, filter-decoded font bytes. */
  data: Uint8Array;
  /**
   * `true` when {@link baseFont} carries a 6-uppercase-letter `+`-prefixed
   * subset tag (e.g. `ABCDEF+Helvetica`).
   */
  subset: boolean;
}

/**
 * Resolve an object through the registry if it is an indirect reference,
 * otherwise return it unchanged.
 */
function resolve(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfObject | undefined {
  if (obj && obj.kind === 'ref') return registry.resolve(obj);
  return obj;
}

/** Resolve `dict[key]` and return it only if it is a dictionary. */
function resolveDict(
  dict: PdfDict,
  key: string,
  registry: PdfObjectRegistry,
): PdfDict | undefined {
  const v = resolve(dict.get(key), registry);
  return v && v.kind === 'dict' ? (v as PdfDict) : undefined;
}

/** Resolve `dict[key]` and return it only if it is a stream. */
function resolveStream(
  dict: PdfDict,
  key: string,
  registry: PdfObjectRegistry,
): PdfStream | undefined {
  const v = resolve(dict.get(key), registry);
  return v && v.kind === 'stream' ? (v as PdfStream) : undefined;
}

/** Read a `/Name` value with the leading slash stripped, if present. */
function nameValue(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): string | undefined {
  const v = resolve(obj, registry);
  if (v && v.kind === 'name') {
    const raw = (v as PdfName).value;
    return raw.startsWith('/') ? raw.slice(1) : raw;
  }
  return undefined;
}

/**
 * Locate the `/FontDescriptor` for a font dictionary.
 *
 * For simple fonts the descriptor is a direct child.  For composite
 * (Type0) fonts it lives on the first `/DescendantFonts` entry.
 */
function findFontDescriptor(
  fontDict: PdfDict,
  registry: PdfObjectRegistry,
): PdfDict | undefined {
  const direct = resolveDict(fontDict, '/FontDescriptor', registry);
  if (direct) return direct;

  const subtype = nameValue(fontDict.get('/Subtype'), registry);
  if (subtype === 'Type0') {
    const descendants = resolve(fontDict.get('/DescendantFonts'), registry);
    if (descendants && descendants.kind === 'array') {
      const first = (descendants as PdfArray).items[0];
      const cidFont = resolve(first, registry);
      if (cidFont && cidFont.kind === 'dict') {
        return resolveDict(cidFont as PdfDict, '/FontDescriptor', registry);
      }
    }
  }
  return undefined;
}

/**
 * Pull the embedded font program (if any) out of a `/FontDescriptor`.
 *
 * Returns the decoded bytes and the detected format, or `undefined` when
 * the descriptor carries no embedded file (e.g. a standard font).
 */
function extractFromDescriptor(
  descriptor: PdfDict,
  registry: PdfObjectRegistry,
): { format: FontFileFormat; data: Uint8Array } | undefined {
  // /FontFile — Type 1 (PostScript) program.
  const fontFile = resolveStream(descriptor, '/FontFile', registry);
  if (fontFile) {
    return { format: 'type1', data: decodeStreamData(fontFile) };
  }

  // /FontFile2 — TrueType (glyf-based) sfnt program.
  const fontFile2 = resolveStream(descriptor, '/FontFile2', registry);
  if (fontFile2) {
    return { format: 'truetype', data: decodeStreamData(fontFile2) };
  }

  // /FontFile3 — CFF or OpenType (CFF-flavoured sfnt) program.
  const fontFile3 = resolveStream(descriptor, '/FontFile3', registry);
  if (fontFile3) {
    // The stream /Subtype distinguishes a bare CFF from a full OpenType
    // wrapper: /OpenType → 'opentype', otherwise (CIDFontType0C / Type1C)
    // → 'cff'.
    const subtype = nameValue(fontFile3.dict.get('/Subtype'), registry);
    const format: FontFileFormat = subtype === 'OpenType' ? 'opentype' : 'cff';
    return { format, data: decodeStreamData(fontFile3) };
  }

  return undefined;
}

/**
 * Determine whether a base-font name carries a subset tag.
 *
 * A subset tag is exactly six uppercase ASCII letters followed by `+`,
 * e.g. `ABCDEF+Helvetica`.
 */
function hasSubsetTag(baseFont: string): boolean {
  if (baseFont.length < 7 || baseFont[6] !== '+') return false;
  for (let i = 0; i < 6; i++) {
    const code = baseFont.charCodeAt(i);
    if (code < 0x41 || code > 0x5a) return false; // not 'A'..'Z'
  }
  return true;
}

/**
 * Extract every embedded font program referenced by a page.
 *
 * Walks the page's original `/Resources` → `/Font` dictionary.  For each
 * font that carries an embedded file (`/FontFile`, `/FontFile2`, or
 * `/FontFile3`) — directly or via a Type0 descendant — the standalone,
 * filter-decoded font bytes are returned.  Standard-14 fonts with no
 * embedded file are omitted, and malformed entries are skipped silently.
 *
 * @param page  The page to scan (typically from a loaded PDF).
 * @returns     One {@link ExtractedFont} per embedded font program.
 *
 * @example
 * ```ts
 * const loaded = await PdfDocument.load(bytes);
 * const fonts = extractFonts(loaded.getPage(0));
 * for (const f of fonts) {
 *   console.log(f.resourceName, f.baseFont, f.format, f.data.length, f.subset);
 * }
 * ```
 */
export function extractFonts(page: PdfPage): ExtractedFont[] {
  const resources = page.getOriginalResources();
  if (!resources) return [];

  const registry = page.getRegistry();
  const fontDict = resolveDict(resources, '/Font', registry);
  if (!fontDict) return [];

  const result: ExtractedFont[] = [];

  for (const [key, value] of fontDict) {
    const dict = resolve(value, registry);
    if (!dict || dict.kind !== 'dict') continue;

    const descriptor = findFontDescriptor(dict as PdfDict, registry);
    if (!descriptor) continue; // standard-14 / no descriptor → skip

    let extracted: { format: FontFileFormat; data: Uint8Array } | undefined;
    try {
      extracted = extractFromDescriptor(descriptor, registry);
    } catch {
      // Malformed font file / filter — tolerate and skip.
      continue;
    }
    if (!extracted) continue; // descriptor with no embedded file → skip

    const baseFont =
      nameValue((dict as PdfDict).get('/BaseFont'), registry) ?? '';
    const resourceName = key.startsWith('/') ? key.slice(1) : key;

    result.push({
      resourceName,
      baseFont,
      format: extracted.format,
      data: extracted.data,
      subset: hasSubsetTag(baseFont),
    });
  }

  return result;
}
