/**
 * qpdf cross-check of repeated encrypted saves (moved from
 * tests/unit/core/encryption-guard.test.ts so the unit project never runs qpdf).
 *
 * Two saves of one encrypted document must decrypt to the same file: each save passes
 * `qpdf --check` with the user password, and `qpdf --decrypt --qdf` of both saves gives
 * identical output that holds the attachment and its description in plaintext. qpdf comes
 * from `QPDF`, then `PATH`; each test skips with a reason where qpdf is absent locally and
 * fails when `CI` is set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../src/index.js';
import type { EncryptOptions, PdfDocument } from '../../src/index.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import {
  expectQpdfClean,
  qpdfDecryptQdf,
  qpdfVersion,
  requireQpdf,
} from '../helpers/oracle/qpdf.js';

type Algorithm = NonNullable<EncryptOptions['algorithm']>;

const SAMPLE_PNG = join(import.meta.dirname, '../fixtures/images/sample.png');
const latin1 = new TextDecoder('latin1');

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A page with text and an image, an attachment with a description, optionally encrypted. */
async function buildRichDoc(algorithm: Algorithm): Promise<PdfDocument> {
  const doc = createPdf();
  doc.setTitle('SecretTitle');
  const page = doc.addPage();
  page.drawText('HelloSecret', { x: 50, y: 700, size: 12 });
  const image = await doc.embedPng(new Uint8Array(readFileSync(SAMPLE_PNG)));
  page.drawImage(image, { x: 50, y: 500, width: 50, height: 50 });
  doc.attachFile('note.txt', new TextEncoder().encode('AttachmentSecret'), 'text/plain', {
    description: 'DescSecret',
  });
  await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm });
  return doc;
}

async function twoSavesDecryptIdentically(algorithm: Algorithm): Promise<void> {
  const doc = await buildRichDoc(algorithm);
  const s1 = await doc.save({ compress: false });
  const s2 = await doc.save({ compress: false });
  expectQpdfClean(s1, { password: 'u' });
  expectQpdfClean(s2, { password: 'u' });
  const q1 = qpdfDecryptQdf(s1, 'u');
  const q2 = qpdfDecryptQdf(s2, 'u');
  expect(q2).toEqual(q1);
  for (const qdf of [q1, q2]) {
    const text = latin1.decode(qdf);
    expect(text).toContain('AttachmentSecret');
    expect(text).toContain('DescSecret');
  }
}

describe('qpdf cross-check', () => {
  test('qpdf is available', () => {
    expect(qpdfVersion()).toMatch(/^qpdf version 12\./);
  });

  test.for(['aes-128', 'rc4-128'] as const)(
    '%s: two saves give identical qpdf --decrypt --qdf output',
    async (algorithm) => {
      await twoSavesDecryptIdentically(algorithm);
    },
  );

  test('two saves of one AES-256 (R6) document give identical qpdf --decrypt --qdf output', async () => {
    await twoSavesDecryptIdentically('aes-256');
  });

  knownDefect(
    defectKey('core-document-08', '0.41.2'),
    'two doc.save() calls of one RC4 (R3) document give identical bytes',
    {
      failsWith:
        /^AssertionError: second save\(\) bytes: expected Uint8Array\[.*\] to deeply equal Uint8Array\[/,
    },
    async () => {
      const doc = await buildRichDoc('rc4-128');
      const s1 = await doc.save({ compress: false });
      const s2 = await doc.save({ compress: false });
      expect(s2, 'second save() bytes').toEqual(s1);
    },
  );
});
