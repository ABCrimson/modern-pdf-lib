/**
 * Tests for ByteRange calculation, hash computation, and signature embedding.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createPdf } from '../../../../src/core/pdfDocument.js';
import { UnencodableTextError } from '../../../../src/errors.js';
import {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  findSignatures,
  readStringEntry,
  stringEntryPattern,
  stringEntryText,
} from '../../../../src/signature/pades/byteRange.js';
import { diffSignedContent } from '../../../../src/signature/pades/documentDiff.js';
import { validateSignatureChain } from '../../../../src/signature/pades/multiSignatureValidator.js';
import {
  signPdf,
  type VisibleSignatureOptions,
} from '../../../../src/signature/pades/signatureHandler.js';
import { verifySignatures } from '../../../../src/signature/pades/signatureVerifier.js';
import { expectQpdfClean, QPDF_BIN, QpdfError, requireQpdf } from '../../../helpers/oracle/qpdf.js';
import { generateTestCert } from '../../../helpers/signature-trust-fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid PDF for testing.
 */
function createMinimalPdf(): Uint8Array {
  const encoder = new TextEncoder();
  const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< /Producer (modern-pdf) /CreationDate (D:20260225120000Z) >>
endobj
xref
0 5
0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000198 00000 n \ntrailer
<< /Size 5 /Root 1 0 R /Info 4 0 R >>
startxref
283
%%EOF
`;
  return encoder.encode(pdf);
}

// ---------------------------------------------------------------------------
// Tests: prepareForSigning
// ---------------------------------------------------------------------------

describe('prepareForSigning', () => {
  it('should prepare a PDF with signature placeholder', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Signature1');

    // The prepared PDF should be larger than the original
    expect(preparedPdf.length).toBeGreaterThan(pdfBytes.length);

    // ByteRange should have valid values
    expect(byteRange.byteRange).toHaveLength(4);
    const [off1, len1, off2, len2] = byteRange.byteRange;
    expect(off1).toBe(0);
    expect(len1).toBeGreaterThan(0);
    expect(off2).toBeGreaterThan(off1 + len1);
    expect(len1 + len2 + byteRange.contentsLength).toBe(preparedPdf.length);

    // Contents offset should be valid
    expect(byteRange.contentsOffset).toBeGreaterThan(0);
    expect(byteRange.contentsLength).toBeGreaterThan(0);
  });

  it('should respect custom placeholder size', () => {
    const pdfBytes = createMinimalPdf();
    const { byteRange: br1 } = prepareForSigning(pdfBytes, 'Sig1', 4096);
    const { byteRange: br2 } = prepareForSigning(pdfBytes, 'Sig1', 16384);

    // Larger placeholder should result in larger contents length
    expect(br2.contentsLength).toBeGreaterThan(br1.contentsLength);
  });

  it('should include /ByteRange in the prepared PDF', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Signature1');

    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(preparedPdf);
    expect(text).toContain('/ByteRange');
    expect(text).toContain('/Contents');
    expect(text).toContain('/SubFilter /adbe.pkcs7.detached');
  });

  it('should include the signature field name as a hex text string', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'MySignature');

    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(preparedPdf);
    // "MySignature" in PDFDocEncoding; qpdf reads the hex form back below.
    expect(text).toContain('/T <4d795369676e6174757265>');
  });

  it('should throw for invalid PDF (no startxref)', () => {
    const encoder = new TextEncoder();
    const badPdf = encoder.encode('%PDF-1.7\nsome garbage\n');

    expect(() => prepareForSigning(badPdf, 'Sig1')).toThrow(
      expect.objectContaining({
        name: 'MalformedInputError',
        format: 'pdf',
        message: expect.stringContaining('Cannot find startxref in PDF'),
      }),
    );
  });

  it('should produce valid xref in the incremental update', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Signature1');

    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(preparedPdf);

    // Should have a new xref section
    expect(text).toContain('/Prev ');
    expect(text.lastIndexOf('%%EOF')).toBeGreaterThan(text.indexOf('%%EOF'));
  });
});

// ---------------------------------------------------------------------------
// Tests: the strings prepareForSigning writes, read back by qpdf and verifySignatures
// ---------------------------------------------------------------------------

/** The /T of every /FT /Sig dictionary as qpdf `--json=2` reads it ("u:" marks a text string). */
function qpdfSignatureFieldNames(bytes: Uint8Array): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'signature-field-names-'));
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
      value?.['/FT'] === '/Sig' && typeof value['/T'] === 'string' ? [value['/T']] : [],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A one-page document from the library writer, signed as `fieldName`. */
async function signedDocument(
  fieldName: string,
  appearance?: VisibleSignatureOptions,
): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage();
  const cert = await generateTestCert('Field Name Signer');
  return signPdf(await doc.save({ compress: false }), fieldName, {
    certificate: cert.certificate,
    privateKey: cert.privateKey,
    appearance,
  });
}

describe('the strings prepareForSigning writes', () => {
  // signature-cms-M02: the name was written into a literal string without escaping.
  for (const fieldName of ['a) /F 0 (b', 'back\\slash (open', 'Unterschrift Müller 日本']) {
    it(`signs the field name ${JSON.stringify(fieldName)}: qpdf --check is clean, /T reads back, the ByteRange is intact`, async (ctx) => {
      requireQpdf(ctx);
      const signed = await signedDocument(fieldName);
      expectQpdfClean(signed);
      expect(qpdfSignatureFieldNames(signed)).toEqual([`u:${fieldName}`]);
      const results = await verifySignatures(signed);
      expect(results).toHaveLength(1);
      expect(results[0]?.integrityValid).toBe(true);
      expect(results[0]?.coversWholeDocument).toBe(true);
    });
  }

  it('reads a string entry in literal or hex form', () => {
    expect(readStringEntry('<< /FT /Sig /T (Signature1) >>', 'T')).toBe('Signature1');
    expect(readStringEntry('<< /FT /Sig /T <5369 67> >>', 'T')).toBe('Sig');
    expect(readStringEntry('<< /T <feff65e5672c> >>', 'T')).toBe('日本');
    expect(readStringEntry('<< /Type /Annot /TU (tip) >>', 'T')).toBeUndefined();
    const names = [...'/T (a) /T <62> /T (c)'.matchAll(stringEntryPattern('T', 'g'))];
    expect(names.map(stringEntryText)).toEqual(['a', 'b', 'c']);
  });

  it('skips a hex /T holding a character that is not PDF white space', async () => {
    const vt = String.fromCharCode(0x0b);
    const nbsp = String.fromCharCode(0xa0);
    expect(readStringEntry(`<< /T <41${vt}42> >>`, 'T')).toBeUndefined();
    expect(readStringEntry(`<< /T <41${nbsp}42> >>`, 'T')).toBeUndefined();
    expect(readStringEntry(`<< /T <41${String.fromCharCode(0)}42> >>`, 'T')).toBe('AB');
    const signed = await signedDocument('AB');
    const at = new TextDecoder('latin1').decode(signed).lastIndexOf('/T <4142>');
    const damaged = signed.slice();
    damaged[at + 5] = 0x0b; // the widget's /T becomes <VT 142>
    expect((await validateSignatureChain(damaged)).signatures).toHaveLength(1);
    await expect(diffSignedContent(damaged)).resolves.toBeDefined();
  });

  it('writes the appearance text as WinAnsiEncoding codes of /F1 Helvetica', async (ctx) => {
    requireQpdf(ctx);
    const signed = await signedDocument('Signature1', {
      rect: [50, 50, 200, 40],
      text: ['Signé par José €'],
    });
    expectQpdfClean(signed);
    const text = new TextDecoder('latin1').decode(signed);
    expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    // Table D.2 WinAnsiEncoding: é is 0xE9, € is 0x80.
    expect(text).toContain('<5369676ee920706172204a6f73e92080> Tj');
    const results = await verifySignatures(signed);
    expect(results[0]?.integrityValid).toBe(true);
    expect(results[0]?.coversWholeDocument).toBe(true);
  });

  it('refuses appearance text that WinAnsiEncoding cannot encode', () => {
    const prepare = (): unknown =>
      prepareForSigning(createMinimalPdf(), 'Signature1', 8192, {
        rect: [0, 0, 100, 40],
        textLines: ['Signed 日本'],
      });
    expect(prepare).toThrow(UnencodableTextError);
    expect(prepare).toThrow(
      expect.objectContaining({
        character: '日',
        index: 7,
        fontName: 'Helvetica',
        encoding: 'WinAnsiEncoding',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: computeSignatureHash
// ---------------------------------------------------------------------------

describe('computeSignatureHash', () => {
  it('should compute SHA-256 hash of ByteRange regions', async () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const hash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-256');

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32); // SHA-256 = 32 bytes
  });

  it('should compute SHA-384 hash', async () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const hash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-384');

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(48); // SHA-384 = 48 bytes
  });

  it('should compute SHA-512 hash', async () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const hash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-512');

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(64); // SHA-512 = 64 bytes
  });

  it('should default to SHA-256', async () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const hash = await computeSignatureHash(preparedPdf, byteRange.byteRange);

    expect(hash.length).toBe(32);
  });

  it('should produce consistent hashes', async () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const hash1 = await computeSignatureHash(preparedPdf, byteRange.byteRange);
    const hash2 = await computeSignatureHash(preparedPdf, byteRange.byteRange);

    expect(hash1).toEqual(hash2);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedSignature
// ---------------------------------------------------------------------------

describe('embedSignature', () => {
  it('should embed signature bytes at the placeholder', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    // Create fake signature bytes
    const fakeSig = new Uint8Array(256);
    globalThis.crypto.getRandomValues(fakeSig);

    const signed = embedSignature(preparedPdf, fakeSig, byteRange);

    // The result should be the same length as the prepared PDF
    expect(signed.length).toBe(preparedPdf.length);

    // The signature hex should be embedded
    const decoder = new TextDecoder('latin1');
    const signedText = decoder.decode(signed);
    const hexSig = Array.from(fakeSig)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(signedText).toContain(hexSig);
  });

  it('should throw if signature is too large for placeholder', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1', 64);

    // Create a signature larger than the placeholder
    const largeSig = new Uint8Array(128);

    expect(() => embedSignature(preparedPdf, largeSig, byteRange)).toThrow(
      expect.objectContaining({
        name: 'InvalidArgumentError',
        argument: 'signatureBytes',
        message: expect.stringContaining('exceeds placeholder capacity'),
      }),
    );
  });

  it('should pad remaining space with zeroes', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1');

    const smallSig = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const signed = embedSignature(preparedPdf, smallSig, byteRange);

    // Read the hex string from the signed PDF
    const contentsStr = new TextDecoder('latin1').decode(
      signed.subarray(
        byteRange.contentsOffset,
        byteRange.contentsOffset + byteRange.contentsLength,
      ),
    );

    // Should start with `<deadbeef` and be padded with `0`s
    expect(contentsStr).toMatch(/^<deadbeef0+>$/);
  });
});

// ---------------------------------------------------------------------------
// Tests: findSignatures
// ---------------------------------------------------------------------------

describe('findSignatures', () => {
  it('should find no signatures in an unsigned PDF', () => {
    const pdfBytes = createMinimalPdf();
    const sigs = findSignatures(pdfBytes);
    expect(sigs).toHaveLength(0);
  });

  it('should find a signature in a prepared PDF', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Signature1');

    const sigs = findSignatures(preparedPdf);
    expect(sigs.length).toBeGreaterThanOrEqual(1);

    const sig = sigs[0]!;
    expect(sig.byteRange).toHaveLength(4);
    expect(sig.contentsHex).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Visible signature appearance
  // -------------------------------------------------------------------------

  it('should create visible signature with non-zero rect and appearance stream', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Signature1', 8192, {
      rect: [50, 50, 200, 80],
      textLines: ['Signed by: Test User', 'Date: 2026-02-28'],
      fontSize: 12,
      borderColor: [0, 0, 0],
      borderWidth: 1,
    });

    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(preparedPdf);

    // Should have non-zero Rect
    expect(text).toContain('/Rect [50 50 250 130]');

    // Should have an appearance dictionary referencing a Form XObject
    expect(text).toContain('/AP <<');

    // Should have the Form XObject with BBox
    expect(text).toContain('/BBox [0 0 200 80]');

    // Should have the text content in the appearance stream: ASCII lines, so their
    // WinAnsiEncoding codes are their ASCII bytes, shown as hex strings.
    for (const line of ['Signed by: Test User', 'Date: 2026-02-28']) {
      expect(text).toContain(`<${new TextEncoder().encode(line).toHex()}> Tj`);
    }
  });

  it('should create invisible signature when no appearance is provided', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Signature1');

    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(preparedPdf);

    // Should have zero Rect (invisible)
    expect(text).toContain('/Rect [0 0 0 0]');

    // Should NOT have appearance dictionary
    expect(text).not.toContain('/AP <<');
  });

  it('should render background color when specified', () => {
    const pdfBytes = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdfBytes, 'Sig1', 8192, {
      rect: [100, 100, 150, 60],
      textLines: ['Test'],
      backgroundColor: [0.95, 0.95, 0.95],
    });

    const text = new TextDecoder('latin1').decode(preparedPdf);
    expect(text).toContain('0.95 0.95 0.95 rg');
  });
});

describe('typed errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws EnvironmentError when Web Crypto is missing', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(computeSignatureHash(new Uint8Array(8), [0, 4, 4, 4])).rejects.toThrow(
      expect.objectContaining({
        name: 'EnvironmentError',
        code: 'environment-unavailable',
        reason: 'web-crypto',
      }),
    );
  });
});
