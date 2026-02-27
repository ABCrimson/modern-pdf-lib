/**
 * @module accessibility/markedContent
 *
 * Marked content operators for tagged PDF.
 *
 * In a tagged PDF, the content stream uses marked-content operators
 * (`BMC`, `BDC`, `EMC`) to associate regions of page content with
 * structure elements in the logical structure tree.  The link is
 * established through a marked-content identifier (MCID) that appears
 * in both the content stream and the structure tree.
 *
 * This module provides functions to generate the correct PDF operator
 * strings for:
 * - Beginning a marked-content sequence (`BMC` or `BDC`)
 * - Ending a marked-content sequence (`EMC`)
 * - Wrapping existing operators in a marked-content sequence
 *
 * Reference: PDF 1.7 spec, SS14.6 (Marked Content).
 */

import type { StructureType } from './structureTree.js';

// ---------------------------------------------------------------------------
// MarkedContentScope
// ---------------------------------------------------------------------------

/**
 * Represents a marked-content scope — provides the operator strings
 * needed to open and close the scope in a content stream.
 */
export interface MarkedContentScope {
  /** The marked-content ID linking to the structure tree. */
  readonly mcid: number;
  /** The structure type tag. */
  readonly tag: string;
  /**
   * Return the PDF operator string that begins this marked-content
   * sequence.  For tagged content with an MCID, this produces a
   * `BDC` (begin marked-content with properties) operator.
   */
  begin(): string;
  /**
   * Return the PDF operator string that ends this marked-content
   * sequence (`EMC`).
   */
  end(): string;
}

// ---------------------------------------------------------------------------
// Operator generation functions
// ---------------------------------------------------------------------------

/**
 * Generate a `BMC` (begin marked content) operator with just a tag.
 *
 * This is the simplest form of marked content — no properties dict.
 * Produces: `/<tag> BMC\n`
 *
 * @param tag  The marked-content tag (e.g. `"Span"`, `"Artifact"`).
 * @returns    The PDF operator string.
 */
export function beginMarkedContent(tag: string): string {
  return `/${tag} BMC\n`;
}

/**
 * Generate a `BDC` (begin marked-content with properties) operator.
 *
 * The properties dictionary is serialized inline.  This is used when
 * you need to associate additional data (like MCID) with the marked
 * content.
 *
 * Produces: `/<tag> <</MCID n /key1 value1 ...>> BDC\n`
 *
 * @param tag         The marked-content tag.
 * @param properties  Key-value pairs for the properties dictionary.
 * @returns           The PDF operator string.
 */
export function beginMarkedContentWithProperties(
  tag: string,
  properties: Record<string, unknown>,
): string {
  const propsStr = serializeInlineDict(properties);
  return `/${tag} ${propsStr} BDC\n`;
}

/**
 * Generate an `EMC` (end marked content) operator.
 *
 * @returns  The PDF operator string.
 */
export function endMarkedContent(): string {
  return 'EMC\n';
}

/**
 * Generate a `BDC` operator for a structure-tagged marked-content
 * sequence with an MCID.
 *
 * This is the most common form used in tagged PDF: it begins a
 * content region associated with a specific structure element via
 * the MCID.
 *
 * Produces: `/<tag> <</MCID n>> BDC\n`
 *
 * @param tag   The structure type (e.g. `"P"`, `"H1"`, `"Span"`).
 * @param mcid  The marked-content identifier.
 * @returns     The PDF operator string.
 */
export function beginMarkedContentSequence(
  tag: StructureType,
  mcid: number,
): string {
  return `/${tag} <</MCID ${mcid}>> BDC\n`;
}

/**
 * Wrap existing content-stream operators in a marked-content sequence.
 *
 * This is a convenience function that prepends a `BDC` operator and
 * appends an `EMC` operator around the given operator string.
 *
 * @param operators  The existing PDF operator string(s) to wrap.
 * @param tag        The structure type tag.
 * @param mcid       The marked-content identifier.
 * @returns          The wrapped operator string.
 */
export function wrapInMarkedContent(
  operators: string,
  tag: StructureType,
  mcid: number,
): string {
  return beginMarkedContentSequence(tag, mcid) + operators + endMarkedContent();
}

/**
 * Create a {@link MarkedContentScope} object for a given tag and MCID.
 *
 * The scope provides `begin()` and `end()` methods to generate the
 * matching operator strings.  This is useful when you want to
 * incrementally build content between the markers.
 *
 * @param tag   The structure type tag.
 * @param mcid  The marked-content identifier.
 * @returns     A {@link MarkedContentScope} object.
 */
export function createMarkedContentScope(
  tag: StructureType,
  mcid: number,
): MarkedContentScope {
  return {
    mcid,
    tag,
    begin(): string {
      return beginMarkedContentSequence(tag, mcid);
    },
    end(): string {
      return endMarkedContent();
    },
  };
}

/**
 * Generate an `Artifact` marked-content operator for content that is
 * not part of the document's logical structure (e.g. page numbers,
 * headers, footers, decorative borders).
 *
 * Produces: `/Artifact BMC\n`
 *
 * @returns  The PDF operator string.
 */
export function beginArtifact(): string {
  return '/Artifact BMC\n';
}

/**
 * Generate an `Artifact` BDC operator with properties specifying the
 * artifact type and other attributes.
 *
 * @param artifactType  The type of artifact: `"Pagination"`,
 *                      `"Layout"`, or `"Background"`.
 * @param subtype       Optional subtype (e.g. `"Header"`, `"Footer"`,
 *                      `"Watermark"`).
 * @returns             The PDF operator string.
 */
export function beginArtifactWithType(
  artifactType: 'Pagination' | 'Layout' | 'Background',
  subtype?: string,
): string {
  const props: Record<string, unknown> = {
    Type: `/${artifactType}`,
  };
  if (subtype !== undefined) {
    props['Subtype'] = `/${subtype}`;
  }
  return beginMarkedContentWithProperties('Artifact', props);
}

/**
 * End an artifact (alias for {@link endMarkedContent}).
 *
 * @returns  The PDF operator string (`EMC\n`).
 */
export function endArtifact(): string {
  return endMarkedContent();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a simple property dictionary for inline use in a BDC
 * operator.  Values can be numbers, strings prefixed with `/` (names),
 * or plain strings.
 *
 * @internal
 */
function serializeInlineDict(properties: Record<string, unknown>): string {
  const parts: string[] = ['<<'];
  for (const [key, value] of Object.entries(properties)) {
    const pdfKey = key.startsWith('/') ? key : `/${key}`;
    parts.push(pdfKey);
    if (typeof value === 'number') {
      parts.push(String(value));
    } else if (typeof value === 'string') {
      if (value.startsWith('/')) {
        // Name
        parts.push(value);
      } else {
        // String
        parts.push(`(${value})`);
      }
    } else if (typeof value === 'boolean') {
      parts.push(value ? 'true' : 'false');
    }
  }
  parts.push('>>');
  return parts.join(' ');
}
