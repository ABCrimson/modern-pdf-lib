/**
 * @module core/pdfEmbed
 *
 * Embed pages from one PDF into another as Form XObjects.
 *
 * A Form XObject is a self-contained content stream that can be painted
 * onto a page with the `Do` operator, just like an image XObject.  This
 * module takes a parsed page's content stream(s) and resources, wraps
 * them into a Form XObject (Type /XObject, Subtype /Form), and registers
 * it in the target document's registry.
 *
 * Reference: PDF 1.7 spec, SS8.10 (Form XObjects).
 *
 * @packageDocumentation
 */

import type { PdfObject } from './pdfObjects.js';
import {
  PdfDict,
  PdfArray,
  PdfStream,
  PdfRef,
  PdfName,
  PdfNumber,
  PdfString,
  PdfBool,
  PdfNull,
} from './pdfObjects.js';
import type { PdfObjectRegistry } from './pdfObjects.js';
import type { PdfPage } from './pdfPage.js';
import { decodeStream, getStreamFilters } from '../parser/streamDecode.js';

// ---------------------------------------------------------------------------
// EmbeddedPdfPage interface
// ---------------------------------------------------------------------------

/**
 * Handle for a page that has been embedded as a Form XObject.
 *
 * Returned by `PdfDocument.embedPdf()` and `PdfDocument.embedPage()`.
 * Pass it to `PdfPage.drawPage()` to paint the embedded page.
 */
export interface EmbeddedPdfPage {
  /** XObject resource name (e.g. `'XF1'`). */
  readonly name: string;
  /** Indirect reference to the Form XObject in the target registry. */
  readonly ref: PdfRef;
  /** Original page width in points. */
  readonly width: number;
  /** Original page height in points. */
  readonly height: number;

  /**
   * Return the dimensions after applying a uniform scale factor.
   *
   * @param factor  Scale factor (e.g. `0.5` for half size).
   */
  scale(factor: number): { width: number; height: number };

  /**
   * Compute dimensions that fit within the given maximum size while
   * preserving the original aspect ratio.
   *
   * @param maxW  Maximum width.
   * @param maxH  Maximum height.
   */
  scaleToFit(maxW: number, maxH: number): { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Options for drawPage
// ---------------------------------------------------------------------------

/**
 * Options for {@link PdfPage.drawPage}.
 */
export interface DrawPageOptions {
  /** X coordinate of the lower-left corner. */
  x?: number | undefined;
  /** Y coordinate of the lower-left corner. */
  y?: number | undefined;
  /** Rendered width (defaults to the embedded page's original width). */
  width?: number | undefined;
  /** Rendered height (defaults to the embedded page's original height). */
  height?: number | undefined;
  /** Rotation angle. */
  rotate?: { type: 'degrees' | 'radians'; value: number } | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: import('./enums.js').BlendMode | undefined;
}

// ---------------------------------------------------------------------------
// Deep-clone helper (reference remapping)
// ---------------------------------------------------------------------------

/**
 * Context for deep-cloning objects from a source registry into a target
 * registry, remapping all PdfRef values to new object numbers.
 */
class CloneContext {
  readonly refMap = new Map<number, PdfRef>();

  constructor(
    readonly sourceRegistry: PdfObjectRegistry,
    readonly targetRegistry: PdfObjectRegistry,
  ) {}
}

/**
 * Deep-clone a PdfObject, remapping all PdfRef references from the source
 * to the target registry.
 */
function deepClone(obj: PdfObject, ctx: CloneContext): PdfObject {
  switch (obj.kind) {
    case 'null':
      return PdfNull.instance;

    case 'bool':
      return PdfBool.of((obj as PdfBool).value);

    case 'number':
      return PdfNumber.of((obj as PdfNumber).value);

    case 'string': {
      const s = obj as PdfString;
      return s.hex ? PdfString.hex(s.value) : PdfString.literal(s.value);
    }

    case 'name':
      return PdfName.of((obj as PdfName).value);

    case 'array': {
      const arr = obj as PdfArray;
      const items: PdfObject[] = [];
      for (const item of arr.items) {
        items.push(deepClone(item, ctx));
      }
      return new PdfArray(items);
    }

    case 'dict': {
      const dict = obj as PdfDict;
      const cloned = new PdfDict();
      for (const [key, value] of dict) {
        cloned.set(key, deepClone(value, ctx));
      }
      return cloned;
    }

    case 'stream': {
      const stream = obj as PdfStream;
      const clonedDict = new PdfDict();
      for (const [key, value] of stream.dict) {
        clonedDict.set(key, deepClone(value, ctx));
      }
      const clonedData = new Uint8Array(stream.data);
      const clonedStream = new PdfStream(clonedDict, clonedData);
      clonedStream.syncLength();
      return clonedStream;
    }

    case 'ref': {
      return remapRef(obj as PdfRef, ctx);
    }

    default:
      return obj;
  }
}

/**
 * Remap a PdfRef from source to target, deep-cloning the referenced
 * object on first encounter.
 */
function remapRef(sourceRef: PdfRef, ctx: CloneContext): PdfRef {
  const existing = ctx.refMap.get(sourceRef.objectNumber);
  if (existing) return existing;

  const sourceObj = ctx.sourceRegistry.resolve(sourceRef);
  if (!sourceObj) {
    const placeholderRef = ctx.targetRegistry.register(PdfNull.instance);
    ctx.refMap.set(sourceRef.objectNumber, placeholderRef);
    return placeholderRef;
  }

  // Allocate first to handle circular references
  const targetRef = ctx.targetRegistry.allocate();
  ctx.refMap.set(sourceRef.objectNumber, targetRef);

  const clonedObj = deepClone(sourceObj, ctx);
  ctx.targetRegistry.assign(targetRef, clonedObj);

  return targetRef;
}

// ---------------------------------------------------------------------------
// Decode a PdfStream's data
// ---------------------------------------------------------------------------

/**
 * Decode a PdfStream's raw data by applying its filters.
 *
 * @param stream  The PdfStream to decode.
 * @returns       The decoded (uncompressed) bytes.
 */
function decodeStreamData(stream: PdfStream): Uint8Array {
  const { filters, decodeParms } = getStreamFilters(stream.dict);
  if (filters.length === 0) {
    return stream.data;
  }
  return decodeStream(stream.data, filters, decodeParms as PdfDict[]);
}

// ---------------------------------------------------------------------------
// Core embedding logic
// ---------------------------------------------------------------------------

/**
 * Embed a single page as a Form XObject in the target registry.
 *
 * The page's content stream(s) are decoded and concatenated.  The
 * page's resources are deep-cloned into the target registry.  The
 * result is a PdfStream of Subtype /Form registered in the target.
 *
 * @param page             The source PdfPage to embed.
 * @param sourceRegistry   The source document's object registry.
 * @param targetRegistry   The target document's object registry.
 * @param xObjectName      The resource name to assign (e.g. `'XF1'`).
 * @returns                An EmbeddedPdfPage handle.
 */
export function embedPageAsFormXObject(
  page: PdfPage,
  sourceRegistry: PdfObjectRegistry,
  targetRegistry: PdfObjectRegistry,
  xObjectName: string,
): EmbeddedPdfPage {
  const pageWidth = page.width;
  const pageHeight = page.height;

  // --- 1. Collect and decode content streams ---
  const contentChunks: Uint8Array[] = [];
  const textDecoder = new TextDecoder();

  // Original content streams from parsed PDF
  const originalRefs = page.getOriginalContentRefs();
  for (const ref of originalRefs) {
    const obj = sourceRegistry.resolve(ref);
    if (obj && obj.kind === 'stream') {
      const decoded = decodeStreamData(obj as PdfStream);
      contentChunks.push(decoded);
    }
  }

  // New operators added via drawText/drawImage/etc.
  const newOps = page.getContentStreamData();
  if (newOps.length > 0) {
    const encoder = new TextEncoder();
    contentChunks.push(encoder.encode(newOps));
  }

  // Concatenate all content with newline separators
  let totalLen = 0;
  for (const chunk of contentChunks) {
    totalLen += chunk.length + 1; // +1 for newline separator
  }
  const concatenated = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of contentChunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
    concatenated[offset] = 0x0a; // newline
    offset += 1;
  }

  // --- 2. Deep-clone resources ---
  const ctx = new CloneContext(sourceRegistry, targetRegistry);
  let clonedResources: PdfDict;

  const originalResources = page.getOriginalResources();
  if (originalResources) {
    clonedResources = deepClone(originalResources, ctx) as PdfDict;
  } else {
    // Page has no original resources — build from the page's current resources
    const builtResources = page.buildResources();
    // If source and target are the same registry, no need to remap
    if (sourceRegistry === targetRegistry) {
      clonedResources = builtResources;
    } else {
      clonedResources = deepClone(builtResources, ctx) as PdfDict;
    }
  }

  // --- 3. Build the Form XObject ---
  const formDict = new PdfDict();
  formDict.set('/Type', PdfName.of('XObject'));
  formDict.set('/Subtype', PdfName.of('Form'));
  formDict.set('/BBox', PdfArray.fromNumbers([0, 0, pageWidth, pageHeight]));
  formDict.set('/Resources', clonedResources);
  formDict.set('/Matrix', PdfArray.fromNumbers([1, 0, 0, 1, 0, 0]));

  const formStream = PdfStream.fromBytes(concatenated, formDict);
  const formRef = targetRegistry.register(formStream);

  // --- 4. Return the handle ---
  return {
    name: xObjectName,
    ref: formRef,
    width: pageWidth,
    height: pageHeight,
    scale(factor: number) {
      return { width: pageWidth * factor, height: pageHeight * factor };
    },
    scaleToFit(maxW: number, maxH: number) {
      const scaleW = maxW / pageWidth;
      const scaleH = maxH / pageHeight;
      const factor = Math.min(scaleW, scaleH);
      return { width: pageWidth * factor, height: pageHeight * factor };
    },
  };
}
