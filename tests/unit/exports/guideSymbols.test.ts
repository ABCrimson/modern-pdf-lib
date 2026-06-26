import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/**
 * Every symbol the published guides import from the package root
 * (`docs/guide/form-scripts.md`, `verification.md`, `jpeg2000.md`, `pdfx.md`)
 * must actually be re-exported from `src/index.ts`, otherwise those
 * documented `import { ... } from 'modern-pdf-lib'` examples fail to resolve.
 *
 * The Acrobat date formatter is re-exported as `formatAcrobatDate` (it pairs
 * with `parseAcrobatDate`) to disambiguate it from the header/footer engine's
 * `formatDate`, which already owns the bare `formatDate` name.
 */
const GUIDE_ROOT_SYMBOLS = [
  // form-scripts.md — Acrobat JS form scripting
  'AFNumber_Format',
  'formatNumber',
  'AFDate_FormatEx',
  'parseAcrobatDate',
  'formatAcrobatDate',
  'AFSpecial_Format',
  'validateFieldValue',
  'resolveFieldReference',
  'getFieldValue',
  'setFieldValue',
  'setFieldVisibility',
  'addVisibilityAction',
  'createSandbox',
  // verification.md — signature verification, revocation, trust
  'checkCertificateStatus',
  'extractOcspUrl',
  'downloadCrl',
  'isCertificateRevoked',
  'extractCrlUrls',
  'TrustStore',
  'verifySignatureDetailed',
  // jpeg2000.md — JPEG 2000 decoding internals
  'decodeJpeg2000',
  'parseTileInfo',
  'decodeTile',
  'decodeTileRegion',
  'assembleTiles',
  'getComponentDepths',
  'summarizeBitDepth',
  'normalizeComponentDepth',
  'downscale16To8',
  'upscale8To16',
  'offsetSignedToUnsigned',
  // pdfx.md — PDF/X validation & enforcement
  'validatePdfX',
  'enforcePdfX',
  'buildPdfXOutputIntent',
  // text-layout.md — advanced layout primitives
  'layoutParagraph',
  'layoutColumns',
  'layoutTextFlow',
  'findHyphenationPoints',
  // verification.md — certificate chain / policy / offline revocation
  'buildCertificateChain',
  'validateCertificateChain',
  'validateCertificatePolicy',
  'validateKeyUsage',
  'validateExtendedKeyUsage',
  'EKU_OIDS',
  'extractEmbeddedRevocationData',
  'verifyOfflineRevocation',
] as const;

test.each(GUIDE_ROOT_SYMBOLS)(
  "root barrel re-exports '%s' (used in a published guide example)",
  (name) => {
    const value = (lib as Record<string, unknown>)[name];
    expect(value, `${name} must be exported from 'modern-pdf-lib' root`).toBeDefined();
  },
);
