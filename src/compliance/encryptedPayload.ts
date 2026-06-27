/**
 * @module compliance/encryptedPayload
 *
 * Unencrypted wrapper documents and encrypted payloads
 * (ISO 32000-2:2020 §7.6.7).
 *
 * A PDF 2.0 *unencrypted wrapper document* is an ordinary, viewable PDF that
 * carries an *encrypted payload* as an embedded file.  The wrapper itself is
 * not encrypted (so any conforming reader can open it and show a cover page),
 * while the sensitive content lives in the embedded payload, which is
 * protected by an external/handler-specific crypto filter.
 *
 * The payload is declared through an *Encrypted Payload* dictionary
 * (`/Type /EncryptedPayload`).  Its `/Subtype` names the crypto filter used to
 * protect the payload (for example `/AESV3`), and an optional `/Version`
 * records the version of that filter.  The Encrypted Payload dictionary is
 * attached to the embedded file's *file specification* dictionary via the
 * `/EP` key, and that file specification is also marked with
 * `/AFRelationship /EncryptedPayload`.
 *
 * This module provides two pure builders:
 *
 *  - {@link buildEncryptedPayload} — build the `/EncryptedPayload` dictionary.
 *  - {@link buildUnencryptedWrapper} — embed the payload bytes as an
 *    associated file and attach the `/EP` dictionary to its file
 *    specification, returning the file-spec reference.
 *
 * The caller attaches the returned file-spec reference to the catalog `/AF`
 * array and to the `/Names /EmbeddedFiles` name tree (for example via
 * `afAttach`).
 *
 * Reference: ISO 32000-2:2020, §7.6.7 (Unencrypted wrapper document).
 */

import { PdfDict, PdfName } from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';
import { createAssociatedFile } from './associatedFiles.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for building an `/EncryptedPayload` dictionary. */
export interface EncryptedPayloadOptions {
  /**
   * Name of the crypto filter that protects the payload, without the leading
   * slash (for example `'AESV3'`).  Emitted as the `/Subtype` name.
   */
  readonly subtype: string;
  /**
   * Optional version of the crypto filter, without the leading slash.
   * Emitted as the `/Version` name when present.
   */
  readonly version?: string | undefined;
}

/** Options for embedding an encrypted payload as an unencrypted wrapper. */
export interface WrapperPayloadOptions {
  /** The (already encrypted) payload bytes to embed. */
  readonly data: Uint8Array;
  /** The filename to record on the embedded file specification. */
  readonly filename: string;
  /**
   * Name of the crypto filter that protects the payload, without the leading
   * slash (for example `'AESV3'`).
   */
  readonly subtype: string;
  /** Optional version of the crypto filter, without the leading slash. */
  readonly version?: string | undefined;
  /** Optional human-readable description of the embedded payload. */
  readonly description?: string | undefined;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build an `/EncryptedPayload` dictionary (ISO 32000-2 §7.6.7).
 *
 * The returned dictionary has:
 *  - `/Type /EncryptedPayload`
 *  - `/Subtype /<subtype>` — the crypto filter name
 *  - `/Version /<version>` — only when {@link EncryptedPayloadOptions.version}
 *    is supplied
 *
 * @param options - The crypto-filter subtype and optional version.
 * @returns A spec-shaped `/EncryptedPayload` {@link PdfDict}.
 */
export function buildEncryptedPayload(
  options: EncryptedPayloadOptions,
): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('EncryptedPayload'));
  dict.set('/Subtype', PdfName.of(options.subtype));
  if (options.version !== undefined) {
    dict.set('/Version', PdfName.of(options.version));
  }
  return dict;
}

/**
 * Build the embedded encrypted-payload file for an unencrypted wrapper
 * document and return its file-specification reference.
 *
 * The payload bytes are embedded via {@link createAssociatedFile} with an
 * `/AFRelationship` of `/EncryptedPayload` and an `application/octet-stream`
 * MIME type.  The resolved file-specification dictionary then receives an
 * `/EP` entry holding the {@link buildEncryptedPayload} dictionary.
 *
 * The caller is responsible for attaching the returned file-spec reference to
 * the catalog `/AF` array and the `/Names /EmbeddedFiles` name tree.
 *
 * @param registry - The PDF object registry to register objects into.
 * @param options  - The payload bytes, filename, crypto subtype/version, and
 *                   optional description.
 * @returns An indirect reference to the file-specification dictionary.
 */
export function buildUnencryptedWrapper(
  registry: PdfObjectRegistry,
  options: WrapperPayloadOptions,
): PdfRef {
  const { fileSpecRef } = createAssociatedFile(registry, {
    data: options.data,
    filename: options.filename,
    mimeType: 'application/octet-stream',
    relationship: 'EncryptedPayload',
    description: options.description,
  });

  const fileSpec = registry.resolve(fileSpecRef);
  if (fileSpec instanceof PdfDict) {
    const ep = buildEncryptedPayload({
      subtype: options.subtype,
      version: options.version,
    });
    fileSpec.set('/EP', ep);
  }

  return fileSpecRef;
}
