/**
 * Tests for the unencrypted wrapper / encrypted payload builders
 * (ISO 32000-2:2020 §7.6.7).
 *
 * Covers:
 * - buildEncryptedPayload: /Type, /Subtype, and optional /Version
 * - buildUnencryptedWrapper: resolved /Filespec carries /AFRelationship
 *   /EncryptedPayload and an /EP dict whose /Type is /EncryptedPayload.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEncryptedPayload,
  buildUnencryptedWrapper,
} from '../../../src/compliance/encryptedPayload.js';
import type {
  EncryptedPayloadOptions,
  WrapperPayloadOptions,
} from '../../../src/compliance/encryptedPayload.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfString,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// buildEncryptedPayload
// ---------------------------------------------------------------------------

describe('buildEncryptedPayload', () => {
  it('builds an /EncryptedPayload dict with /Subtype and /Version', () => {
    const options: EncryptedPayloadOptions = { subtype: 'AESV3', version: '1' };
    const ep = buildEncryptedPayload(options);

    expect(ep).toBeInstanceOf(PdfDict);

    const type = ep.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/EncryptedPayload');

    const subtype = ep.get('/Subtype');
    expect(subtype).toBeInstanceOf(PdfName);
    expect((subtype as PdfName).value).toBe('/AESV3');

    const version = ep.get('/Version');
    expect(version).toBeInstanceOf(PdfName);
    expect((version as PdfName).value).toBe('/1');
  });

  it('omits /Version when not provided', () => {
    const ep = buildEncryptedPayload({ subtype: 'AESV3' });

    expect((ep.get('/Type') as PdfName).value).toBe('/EncryptedPayload');
    expect((ep.get('/Subtype') as PdfName).value).toBe('/AESV3');
    expect(ep.has('/Version')).toBe(false);
    expect(ep.get('/Version')).toBeUndefined();
  });

  it('supports other crypto-filter subtypes', () => {
    const ep = buildEncryptedPayload({ subtype: 'StandardV2' });
    expect((ep.get('/Subtype') as PdfName).value).toBe('/StandardV2');
  });
});

// ---------------------------------------------------------------------------
// buildUnencryptedWrapper
// ---------------------------------------------------------------------------

describe('buildUnencryptedWrapper', () => {
  it('builds a /Filespec with /EncryptedPayload relationship and an /EP dict', () => {
    const registry = new PdfObjectRegistry();
    const options: WrapperPayloadOptions = {
      data: new Uint8Array([1, 2, 3]),
      filename: 'secret.pdf',
      subtype: 'AESV3',
    };

    const ref = buildUnencryptedWrapper(registry, options);

    const fileSpec = registry.resolve(ref);
    expect(fileSpec).toBeInstanceOf(PdfDict);
    const spec = fileSpec as PdfDict;

    // It is a file specification dictionary.
    expect((spec.get('/Type') as PdfName).value).toBe('/Filespec');

    // The relationship is /EncryptedPayload.
    const rel = spec.get('/AFRelationship');
    expect(rel).toBeInstanceOf(PdfName);
    expect((rel as PdfName).value).toBe('/EncryptedPayload');

    // The filename round-trips.
    expect((spec.get('/F') as PdfString).value).toBe('secret.pdf');

    // The /EP entry is an /EncryptedPayload dict carrying the subtype.
    const ep = spec.get('/EP');
    expect(ep).toBeInstanceOf(PdfDict);
    const epDict = ep as PdfDict;
    expect((epDict.get('/Type') as PdfName).value).toBe('/EncryptedPayload');
    expect((epDict.get('/Subtype') as PdfName).value).toBe('/AESV3');
  });

  it('forwards /Version and /Desc into the wrapper', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildUnencryptedWrapper(registry, {
      data: new Uint8Array([9, 9]),
      filename: 'payload.bin',
      subtype: 'AESV3',
      version: '2',
      description: 'Encrypted attachment',
    });

    const spec = registry.resolve(ref) as PdfDict;
    expect((spec.get('/Desc') as PdfString).value).toBe('Encrypted attachment');

    const epDict = spec.get('/EP') as PdfDict;
    expect((epDict.get('/Version') as PdfName).value).toBe('/2');
  });

  it('embeds the payload bytes via an /EF stream reference', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildUnencryptedWrapper(registry, {
      data: new Uint8Array([1, 2, 3]),
      filename: 'secret.pdf',
      subtype: 'AESV3',
    });

    const spec = registry.resolve(ref) as PdfDict;
    const ef = spec.get('/EF');
    expect(ef).toBeInstanceOf(PdfDict);
  });
});
