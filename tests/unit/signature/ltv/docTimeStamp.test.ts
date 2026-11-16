/**
 * Unit tests for the standalone Document Timestamp dictionary builder
 * (ISO 32000-2 §12.8.5, subtype ETSI.RFC3161).
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildDocTimeStampDict,
  DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE,
  type DocTimeStampOptions,
} from '../../../../src/signature/ltv/docTimeStamp.js';

import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
  PdfString,
  type ByteWriter,
} from '../../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A trivial ByteWriter that accumulates serialized output into a string. */
class StringWriter implements ByteWriter {
  private readonly parts: string[] = [];
  private readonly decoder = new TextDecoder('latin1');

  write(data: Uint8Array): void {
    this.parts.push(this.decoder.decode(data));
  }

  writeString(str: string): void {
    this.parts.push(str);
  }

  toString(): string {
    return this.parts.join('');
  }
}

function serialize(dict: PdfDict): string {
  const writer = new StringWriter();
  dict.serialize(writer);
  return writer.toString();
}

function getName(dict: PdfDict, key: string): PdfName {
  const value = dict.get(key);
  expect(value).toBeInstanceOf(PdfName);
  return value as PdfName;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildDocTimeStampDict', () => {
  it('produces a PdfDict', () => {
    const dict = buildDocTimeStampDict();
    expect(dict).toBeInstanceOf(PdfDict);
  });

  it('sets /Type to /DocTimeStamp', () => {
    const dict = buildDocTimeStampDict();
    expect(getName(dict, '/Type').value).toBe('/DocTimeStamp');
  });

  it('sets /Filter to /Adobe.PPKLite', () => {
    const dict = buildDocTimeStampDict();
    expect(getName(dict, '/Filter').value).toBe('/Adobe.PPKLite');
  });

  it('sets /SubFilter to /ETSI.RFC3161', () => {
    const dict = buildDocTimeStampDict();
    expect(getName(dict, '/SubFilter').value).toBe('/ETSI.RFC3161');
  });

  it('sets /ByteRange to a 4-number array of zeros', () => {
    const dict = buildDocTimeStampDict();
    const byteRange = dict.get('/ByteRange');
    expect(byteRange).toBeInstanceOf(PdfArray);
    const arr = byteRange as PdfArray;
    expect(arr.length).toBe(4);
    for (const item of arr.items) {
      expect(item).toBeInstanceOf(PdfNumber);
      expect((item as PdfNumber).value).toBe(0);
    }
  });

  it('sets /Contents to a hex PdfString', () => {
    const dict = buildDocTimeStampDict();
    const contents = dict.get('/Contents');
    expect(contents).toBeInstanceOf(PdfString);
    expect((contents as PdfString).hex).toBe(true);
  });

  it('builds /Contents from hex digits without the deprecated hex factory', () => {
    const hex = vi.spyOn(PdfString, 'hex');
    try {
      const contents = buildDocTimeStampDict({ contentsSize: 16 }).get('/Contents') as PdfString;
      expect(hex).not.toHaveBeenCalled();
      expect(contents.hex).toBe(true);
      expect(contents.equals(PdfString.fromBytes(new Uint8Array(16)))).toBe(true);
    } finally {
      hex.mockRestore();
    }
  });

  it('defaults the /Contents placeholder to the documented size', () => {
    const dict = buildDocTimeStampDict();
    const contents = dict.get('/Contents') as PdfString;
    // 2 hex digits per byte.
    expect(contents.toBytes().toHex().length).toBe(DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE * 2);
    expect(DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE).toBe(8192);
  });

  it('honors a custom contentsSize', () => {
    const dict = buildDocTimeStampDict({ contentsSize: 4096 });
    const contents = dict.get('/Contents') as PdfString;
    expect(contents.toBytes().toHex().length).toBe(4096 * 2);
    // Placeholder is all-zero hex digits.
    expect(/^0+$/.test(contents.toBytes().toHex())).toBe(true);
  });

  it('does not add /Reason by default', () => {
    const dict = buildDocTimeStampDict();
    expect(dict.get('/Reason')).toBeUndefined();
    expect(dict.has('/Reason')).toBe(false);
  });

  it('adds /Reason as a literal string when provided', () => {
    const dict = buildDocTimeStampDict({ reason: 'LTV timestamp' });
    const reason = dict.get('/Reason');
    expect(reason).toBeInstanceOf(PdfString);
    const str = reason as PdfString;
    expect(str.hex).toBe(false);
    expect(str.toText()).toBe('LTV timestamp');
  });

  it('writes /Reason as a PDF text string', () => {
    const latin = buildDocTimeStampDict({ reason: 'Prüfung' }).get('/Reason') as PdfString;
    expect(latin.textEncoding).toBe('pdfdoc');
    expect(latin.toText()).toBe('Prüfung');
    const wide = buildDocTimeStampDict({ reason: 'Zeitstempel € 日本' }).get(
      '/Reason',
    ) as PdfString;
    expect(wide.textEncoding).toBe('utf-16be');
    expect(wide.toText()).toBe('Zeitstempel € 日本');
  });

  it('adds /Reason even when it is an empty string', () => {
    const dict = buildDocTimeStampDict({ reason: '' });
    expect(dict.has('/Reason')).toBe(true);
    expect((dict.get('/Reason') as PdfString).toText()).toBe('');
  });

  it('treats undefined options like no options', () => {
    const a = buildDocTimeStampDict(undefined);
    const b = buildDocTimeStampDict();
    expect(serialize(a)).toBe(serialize(b));
  });

  it('serializes to valid PDF dictionary syntax', () => {
    const dict = buildDocTimeStampDict({ contentsSize: 8 });
    const out = serialize(dict);
    expect(out.startsWith('<<')).toBe(true);
    expect(out.endsWith('>>')).toBe(true);
    expect(out).toContain('/Type /DocTimeStamp');
    expect(out).toContain('/Filter /Adobe.PPKLite');
    expect(out).toContain('/SubFilter /ETSI.RFC3161');
    expect(out).toContain('/ByteRange [0 0 0 0]');
    // 8 bytes ⇒ 16 hex zeros between angle brackets.
    expect(out).toContain(`/Contents <${'0'.repeat(16)}>`);
  });

  it('produces an independent dict on each call', () => {
    const a = buildDocTimeStampDict();
    const b = buildDocTimeStampDict();
    expect(a).not.toBe(b);
    a.set('/Reason', PdfString.fromText('mutated'));
    expect(b.has('/Reason')).toBe(false);
  });

  it('rejects a non-positive contentsSize', () => {
    expect(() => buildDocTimeStampDict({ contentsSize: 0 })).toThrow(
      expect.objectContaining({
        name: 'InvalidArgumentError',
        argument: 'options.contentsSize',
        message: 'contentsSize must be a positive integer, got 0',
      }),
    );
    expect(() => buildDocTimeStampDict({ contentsSize: -1 })).toThrow(
      expect.objectContaining({
        name: 'InvalidArgumentError',
        argument: 'options.contentsSize',
        message: 'contentsSize must be a positive integer, got -1',
      }),
    );
  });

  it('rejects a non-integer contentsSize', () => {
    expect(() => buildDocTimeStampDict({ contentsSize: 1024.5 })).toThrow(
      expect.objectContaining({
        name: 'InvalidArgumentError',
        argument: 'options.contentsSize',
        message: 'contentsSize must be a positive integer, got 1024.5',
      }),
    );
  });

  it('accepts an explicit options object typed as DocTimeStampOptions', () => {
    const options: DocTimeStampOptions = {
      contentsSize: 2048,
      reason: 'archival',
    };
    const dict = buildDocTimeStampDict(options);
    expect((dict.get('/Contents') as PdfString).toBytes().toHex().length).toBe(2048 * 2);
    expect((dict.get('/Reason') as PdfString).toText()).toBe('archival');
  });
});
