import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.34.x advanced-signature symbol must be reachable from the root. */
const SYMBOLS = [
  'buildSigningCertificateV2Attribute', // CAdES ESS signing-certificate-v2
  'extractSigningCertificateV2',
  'buildCertPath', // RFC 5280 §6.1 path building
] as const;

test.each(SYMBOLS)("package root re-exports advanced-signature symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});
