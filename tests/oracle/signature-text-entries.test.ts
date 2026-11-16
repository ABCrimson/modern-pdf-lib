/**
 * The text entries of the signature dictionary that `signPdf()` writes, against qpdf.
 *
 * ISO 32000-2 12.8.1 (the signature dictionary): /Reason, /Location and /ContactInfo are text
 * strings. A one-page document is signed with the three options; qpdf 12 `--json=2` reads each
 * entry of the /Type /Sig dictionary back as the text it was given ("u:" marks a text string),
 * `qpdf --check` is clean, and verifySignatures() reports the byte range intact: the entries sit
 * inside the signed range. qpdf comes from `QPDF`, then `PATH`; the tests skip with a reason
 * where qpdf is absent locally and fail when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createPdf } from '../../src/index.js';
import { getSignatures, signPdf } from '../../src/signature/pades/signatureHandler.js';
import { verifySignatures } from '../../src/signature/pades/signatureVerifier.js';
import { expectQpdfClean, QPDF_BIN, QpdfError, requireQpdf } from '../helpers/oracle/qpdf.js';
import { generateTestCert } from '../helpers/signature-trust-fixtures.js';

/** The keys of the signature dictionary this file checks. */
const KEYS = ['/Reason', '/Location', '/ContactInfo'] as const;

/** Each /Type /Sig dictionary of `bytes` as qpdf `--json=2` reads it, restricted to {@link KEYS}. */
function qpdfSignatureEntries(bytes: Uint8Array): Record<string, unknown>[] {
  const dir = mkdtempSync(join(tmpdir(), 'signature-text-entries-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(QPDF_BIN, ['--json=2', '--json-key=qpdf', input], {
      encoding: 'utf8',
      maxBuffer: 1 << 30,
    });
    if (result.status !== 0) {
      throw new QpdfError(`qpdf --json=2 exit ${result.status}: ${result.stderr}`);
    }
    const [, objects] = (
      JSON.parse(result.stdout) as {
        qpdf: [unknown, Record<string, { value?: Record<string, unknown> }>];
      }
    ).qpdf;
    return Object.values(objects).flatMap(({ value }) =>
      value?.['/Type'] === '/Sig'
        ? [Object.fromEntries(KEYS.filter((k) => k in value).map((k) => [k, value[k]]))]
        : [],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A one-page document from the library writer, checked by qpdf. */
async function plainDocument(): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage();
  const plain = await doc.save({ compress: false });
  expectQpdfClean(plain);
  return plain;
}

const CASES: readonly {
  readonly about: string;
  readonly reason: string;
  readonly location: string;
  readonly contactInfo: string;
}[] = [
  {
    about: 'ASCII, PDFDocEncoding and UTF-16BE text',
    reason: 'Approved',
    location: 'München',
    contactInfo: 'Иван Петров, 日本 +81',
  },
  {
    about: 'string delimiters and a backslash',
    reason: 'a) /F 0 (b',
    location: 'back\\slash (open',
    contactInfo: '<not hex> %comment',
  },
];

describe('signPdf() writes /Reason, /Location and /ContactInfo as text strings', () => {
  for (const { about, reason, location, contactInfo } of CASES) {
    test(`${about}: qpdf reads the texts back, the byte range is intact`, async (ctx) => {
      requireQpdf(ctx);
      const cert = await generateTestCert('Text Entry Signer');
      const signed = await signPdf(await plainDocument(), 'Signature1', {
        certificate: cert.certificate,
        privateKey: cert.privateKey,
        reason,
        location,
        contactInfo,
      });
      expectQpdfClean(signed);
      expect(qpdfSignatureEntries(signed)).toEqual([
        {
          '/Reason': `u:${reason}`,
          '/Location': `u:${location}`,
          '/ContactInfo': `u:${contactInfo}`,
        },
      ]);

      const [result, ...rest] = await verifySignatures(signed);
      expect(rest).toEqual([]);
      expect(result?.integrityValid).toBe(true);
      expect(result?.coversWholeDocument).toBe(true);
      expect(result?.reason).toBe(reason);
      expect(getSignatures(signed)).toMatchObject([{ reason, location, contactInfo }]);
    });
  }

  test('an absent option writes no entry', async (ctx) => {
    requireQpdf(ctx);
    const cert = await generateTestCert('Text Entry Signer');
    const signed = await signPdf(await plainDocument(), 'Signature1', {
      certificate: cert.certificate,
      privateKey: cert.privateKey,
      reason: 'Approved',
    });
    expectQpdfClean(signed);
    expect(qpdfSignatureEntries(signed)).toEqual([{ '/Reason': 'u:Approved' }]);
  });
});
