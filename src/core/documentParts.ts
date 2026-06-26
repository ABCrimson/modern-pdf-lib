/**
 * @module core/documentParts
 *
 * PDF 2.0 Document Part hierarchy (ISO 32000-2 §14.12).
 *
 * A PDF 2.0 document may declare a *Document Part* (DPart) hierarchy that
 * partitions the page tree into logical sections (for example, the
 * individual statements inside a batch-printed document).  The hierarchy is
 * rooted at a `/DPartRoot` dictionary referenced from the document catalog.
 * Its `/DPartRootNode` is the top `/DPart` node whose `/DParts` array holds
 * the child `/DPart` nodes — each spanning a contiguous range of pages and
 * optionally carrying *Document Part Metadata* (`/DPM`).
 *
 * This module builds a spec-shaped, self-contained `/DPartRoot` dictionary
 * from a flat list of page ranges.  Page positions are recorded as numeric
 * `/Start` and `/End` page indices (zero-based, inclusive); resolving them to
 * concrete page references is the writer's concern and is intentionally out of
 * scope here.
 *
 * Reference: ISO 32000-2:2020, §14.12 (Document parts).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
} from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single document part: a contiguous, inclusive range of page indices plus
 * optional Document Part Metadata.
 */
export interface DocumentPart {
  /** Zero-based index of the first page in this part (inclusive). */
  readonly startPage: number;
  /** Zero-based index of the last page in this part (inclusive). */
  readonly endPage: number;
  /**
   * Optional Document Part Metadata.  Each key/value pair is emitted as a
   * PDF name → literal-string entry inside the part's `/DPM` dictionary.
   */
  readonly metadata?: Readonly<Record<string, string>> | undefined;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build the `/DPM` (Document Part Metadata) dictionary for a single part.
 * Keys become PDF names; values become PDF literal strings.
 */
function buildDpm(metadata: Readonly<Record<string, string>>): PdfDict {
  const dpm = new PdfDict();
  for (const [key, value] of Object.entries(metadata)) {
    dpm.set(PdfName.of(key).value, PdfString.literal(value));
  }
  return dpm;
}

/**
 * Build a single child `/DPart` node from a {@link DocumentPart}.
 *
 * The node carries `/Type /DPart`, numeric `/Start` and `/End` page indices,
 * and — when metadata is present — a `/DPM` dictionary.
 *
 * Note: the spec's `/Parent` back-link is intentionally omitted here.  In a
 * real document `/Parent` must be an *indirect* reference to the owning node;
 * embedding it inline would create a serialization cycle.  This self-contained
 * unit therefore leaves `/Parent` to be wired up by the writer when the nodes
 * are assigned object numbers.
 */
function buildDPartChild(part: DocumentPart): PdfDict {
  const node = new PdfDict();
  node.set('/Type', PdfName.of('DPart'));
  node.set('/Start', PdfNumber.of(part.startPage));
  node.set('/End', PdfNumber.of(part.endPage));
  if (part.metadata !== undefined && Object.keys(part.metadata).length > 0) {
    node.set('/DPM', buildDpm(part.metadata));
  }
  return node;
}

/**
 * Build a PDF 2.0 `/DPartRoot` dictionary from a flat list of document parts.
 *
 * The returned dictionary has:
 *  - `/Type /DPartRoot`
 *  - `/DPartRootNode` → a top `/DPart` node whose `/DParts` array holds one
 *    child `/DPart` node per supplied {@link DocumentPart}.
 *
 * Each child node records its `/Start` and `/End` page indices and, when
 * present, its `/DPM` metadata dictionary.  The structure is self-contained:
 * page positions are stored as plain numbers rather than resolved page
 * references.
 *
 * @param parts - The document parts, in page order.
 * @returns A spec-shaped `/DPartRoot` {@link PdfDict}.
 */
export function buildDPartRoot(parts: readonly DocumentPart[]): PdfDict {
  const root = new PdfDict();
  root.set('/Type', PdfName.of('DPartRoot'));

  // Top-level /DPart node that owns the per-part children.
  const rootNode = new PdfDict();
  rootNode.set('/Type', PdfName.of('DPart'));

  const childArray = new PdfArray();
  for (const part of parts) {
    childArray.push(buildDPartChild(part));
  }
  rootNode.set('/DParts', childArray);

  root.set('/DPartRootNode', rootNode);
  return root;
}
