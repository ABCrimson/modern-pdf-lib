import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.30.x PDF 2.0 core symbol must be reachable from the package root. */
const PDF2_SYMBOLS = [
  // 0.30.1/.2 — Associated Files attachment
  'attachAssociatedFiles',
  'registerEmbeddedFile',
  // 0.30.3 — per-page output intents
  'attachOutputIntents',
  'buildPageOutputIntent',
  // 0.30.6 — encrypted payload
  'buildEncryptedPayload',
  'buildUnencryptedWrapper',
  // 0.30.7 — soft-mask groups
  'buildSoftMaskGroupExtGState',
  'buildSoftMaskNone',
  // 0.30.8 — image masks + black-point
  'buildStencilMask',
  'buildColorKeyMask',
  'buildImageSoftMask',
  'buildBlackPointCompensationExtGState',
  // already shipped in 0.28.0 — confirm the whole minor is reachable
  'buildDPartRoot',
  'buildNamespace',
  'buildRequirements',
  'buildPieceInfo',
] as const;

test.each(PDF2_SYMBOLS)("package root re-exports PDF 2.0 symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});
