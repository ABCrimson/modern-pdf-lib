/**
 * Tests for signature field lock dictionary support.
 */

import { describe, it, expect } from 'vitest';
import {
  addFieldLock,
  getFieldLocks,
  buildFieldLockDict,
} from '../../../src/signature/fieldLock.js';
import { prepareForSigning } from '../../../src/signature/byteRange.js';
import type { SignOptions } from '../../../src/signature/signatureHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

function createMinimalPdf(): Uint8Array {
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

function createMockSignOptions(): SignOptions {
  return {
    certificate: new Uint8Array([0x30, 0x82, 0x01, 0x00]),
    privateKey: new Uint8Array([0x30, 0x82, 0x01, 0x00]),
  };
}

// ---------------------------------------------------------------------------
// Tests: addFieldLock
// ---------------------------------------------------------------------------

describe('addFieldLock', () => {
  it('should set field lock with "All" action', () => {
    const options = createMockSignOptions();
    addFieldLock(options, { action: 'All' });

    const extended = options as SignOptions & {
      fieldLock: { action: string };
    };
    expect(extended.fieldLock.action).toBe('All');
  });

  it('should set field lock with "Include" action and fields', () => {
    const options = createMockSignOptions();
    addFieldLock(options, {
      action: 'Include',
      fields: ['Name', 'Address'],
    });

    const extended = options as SignOptions & {
      fieldLock: { action: string; fields: string[] };
    };
    expect(extended.fieldLock.action).toBe('Include');
    expect(extended.fieldLock.fields).toEqual(['Name', 'Address']);
  });

  it('should set field lock with "Exclude" action and fields', () => {
    const options = createMockSignOptions();
    addFieldLock(options, {
      action: 'Exclude',
      fields: ['Notes'],
    });

    const extended = options as SignOptions & {
      fieldLock: { action: string; fields: string[] };
    };
    expect(extended.fieldLock.action).toBe('Exclude');
    expect(extended.fieldLock.fields).toEqual(['Notes']);
  });

  it('should throw for "Include" without fields', () => {
    const options = createMockSignOptions();
    expect(() => addFieldLock(options, { action: 'Include' })).toThrow(
      'at least one field name',
    );
  });

  it('should throw for "Exclude" with empty fields', () => {
    const options = createMockSignOptions();
    expect(() =>
      addFieldLock(options, { action: 'Exclude', fields: [] }),
    ).toThrow('at least one field name');
  });

  it('should not throw for "All" without fields', () => {
    const options = createMockSignOptions();
    expect(() => addFieldLock(options, { action: 'All' })).not.toThrow();
  });

  it('should overwrite previous field lock', () => {
    const options = createMockSignOptions();
    addFieldLock(options, { action: 'All' });
    addFieldLock(options, {
      action: 'Include',
      fields: ['Field1'],
    });

    const extended = options as SignOptions & {
      fieldLock: { action: string };
    };
    expect(extended.fieldLock.action).toBe('Include');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildFieldLockDict
// ---------------------------------------------------------------------------

describe('buildFieldLockDict', () => {
  it('should build lock dict for "All" action', () => {
    const dict = buildFieldLockDict({ action: 'All' });

    expect(dict).toContain('/Type /SigFieldLock');
    expect(dict).toContain('/Action /All');
    expect(dict).not.toContain('/Fields');
  });

  it('should build lock dict for "Include" with fields', () => {
    const dict = buildFieldLockDict({
      action: 'Include',
      fields: ['Name', 'Email'],
    });

    expect(dict).toContain('/Action /Include');
    expect(dict).toContain('/Fields [(Name) (Email)]');
  });

  it('should build lock dict for "Exclude" with fields', () => {
    const dict = buildFieldLockDict({
      action: 'Exclude',
      fields: ['Notes'],
    });

    expect(dict).toContain('/Action /Exclude');
    expect(dict).toContain('/Fields [(Notes)]');
  });

  it('should escape special characters in field names', () => {
    const dict = buildFieldLockDict({
      action: 'Include',
      fields: ['Field (1)', 'Field\\2'],
    });

    expect(dict).toContain('(Field \\(1\\))');
    expect(dict).toContain('(Field\\\\2)');
  });

  it('should produce valid PDF dict syntax', () => {
    const dict = buildFieldLockDict({
      action: 'Include',
      fields: ['A', 'B', 'C'],
    });

    // Should start and end with proper dict markers
    expect(dict).toContain('/Lock <<');
    expect(dict).toContain('>>');
  });
});

// ---------------------------------------------------------------------------
// Tests: getFieldLocks
// ---------------------------------------------------------------------------

describe('getFieldLocks', () => {
  it('should return empty array for PDF without locks', () => {
    const pdf = createMinimalPdf();
    const locks = getFieldLocks(pdf);
    expect(locks).toHaveLength(0);
  });

  it('should find field lock in a prepared PDF with lock', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'ApprovalSig',
      8192,
      undefined,
      undefined,
      { action: 'All' },
    );

    const locks = getFieldLocks(preparedPdf);

    if (locks.length > 0) {
      const lock = locks[0]!;
      expect(lock.signatureFieldName).toBe('ApprovalSig');
      expect(lock.action).toBe('All');
      expect(lock.lockedFields).toHaveLength(0);
    }
  });

  it('should find field lock with "Include" action', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'ReviewSig',
      8192,
      undefined,
      undefined,
      { action: 'Include', fields: ['Amount', 'Date'] },
    );

    const locks = getFieldLocks(preparedPdf);

    if (locks.length > 0) {
      const lock = locks[0]!;
      expect(lock.action).toBe('Include');
      expect(lock.lockedFields).toContain('Amount');
      expect(lock.lockedFields).toContain('Date');
    }
  });

  it('should find field lock with "Exclude" action', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'InitialSig',
      8192,
      undefined,
      undefined,
      { action: 'Exclude', fields: ['Comments'] },
    );

    const locks = getFieldLocks(preparedPdf);

    if (locks.length > 0) {
      const lock = locks[0]!;
      expect(lock.action).toBe('Exclude');
      expect(lock.lockedFields).toContain('Comments');
    }
  });

  it('should return signatureFieldName correctly', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'MySigField',
      8192,
      undefined,
      undefined,
      { action: 'All' },
    );

    const locks = getFieldLocks(preparedPdf);

    if (locks.length > 0) {
      expect(locks[0]!.signatureFieldName).toBe('MySigField');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: prepareForSigning with fieldLock parameter
// ---------------------------------------------------------------------------

describe('prepareForSigning with fieldLock', () => {
  it('should include /Lock dictionary in the signature field', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'LockSig',
      8192,
      undefined,
      undefined,
      { action: 'All' },
    );

    const text = decoder.decode(preparedPdf);
    expect(text).toContain('/Lock');
    expect(text).toContain('/SigFieldLock');
    expect(text).toContain('/Action /All');
  });

  it('should include /Fields in lock dict for Include action', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'LockSig',
      8192,
      undefined,
      undefined,
      { action: 'Include', fields: ['Name', 'Amount'] },
    );

    const text = decoder.decode(preparedPdf);
    expect(text).toContain('/Fields');
    expect(text).toContain('(Name)');
    expect(text).toContain('(Amount)');
  });

  it('should not include /Lock when fieldLock is undefined', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'NoLockSig');

    const text = decoder.decode(preparedPdf);
    expect(text).not.toContain('/SigFieldLock');
  });

  it('should produce valid ByteRange with fieldLock', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(
      pdf,
      'LockSig',
      8192,
      undefined,
      undefined,
      { action: 'Include', fields: ['Field1', 'Field2'] },
    );

    const [off1, len1, off2, len2] = byteRange.byteRange;
    expect(off1).toBe(0);
    expect(len1).toBeGreaterThan(0);
    expect(off2).toBeGreaterThan(off1 + len1);
    expect(len1 + len2 + byteRange.contentsLength).toBe(preparedPdf.length);
  });

  it('should work with both MDP and fieldLock together', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(
      pdf,
      'CertLockSig',
      8192,
      undefined,
      2, // FormFillAndSign
      { action: 'Include', fields: ['Amount'] },
    );

    const text = decoder.decode(preparedPdf);
    expect(text).toContain('/DocMDP');
    expect(text).toContain('/SigFieldLock');
    expect(text).toContain('/Action /Include');

    // ByteRange should still be valid
    const [off1, len1, off2, len2] = byteRange.byteRange;
    expect(len1 + len2 + byteRange.contentsLength).toBe(preparedPdf.length);
  });
});
