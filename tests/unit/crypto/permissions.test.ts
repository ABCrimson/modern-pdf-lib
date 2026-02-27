/**
 * Tests for PDF permission flag encoding/decoding.
 */

import { describe, it, expect } from 'vitest';
import {
  encodePermissions,
  decodePermissions,
} from '../../../src/crypto/permissions.js';
import type { PdfPermissionFlags } from '../../../src/crypto/permissions.js';

describe('encodePermissions', () => {
  it('should encode no permissions (all restricted)', () => {
    const flags: PdfPermissionFlags = {
      printing: false,
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    };

    const p = encodePermissions(flags);

    // Reserved bits 7-8 (0xC0) should always be set
    // The upper bits 13-32 are set by convention
    expect(p & 0xc0).toBe(0xc0); // bits 7-8 set
    expect(p & 0x04).toBe(0);    // bit 3 (print) off
    expect(p & 0x08).toBe(0);    // bit 4 (modify) off
    expect(p & 0x10).toBe(0);    // bit 5 (copy) off
    expect(p & 0x20).toBe(0);    // bit 6 (annotate) off
    expect(p & 0x100).toBe(0);   // bit 9 (fill forms) off
    expect(p & 0x200).toBe(0);   // bit 10 (accessibility) off
    expect(p & 0x400).toBe(0);   // bit 11 (assembly) off
    expect(p & 0x800).toBe(0);   // bit 12 (HQ print) off
  });

  it('should encode all permissions granted', () => {
    const flags: PdfPermissionFlags = {
      printing: true,
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    };

    const p = encodePermissions(flags);

    expect(p & 0x04).toBe(0x04);   // print
    expect(p & 0x08).toBe(0x08);   // modify
    expect(p & 0x10).toBe(0x10);   // copy
    expect(p & 0x20).toBe(0x20);   // annotate
    expect(p & 0x100).toBe(0x100); // fill forms
    expect(p & 0x200).toBe(0x200); // accessibility
    expect(p & 0x400).toBe(0x400); // assembly
    expect(p & 0x800).toBe(0x800); // HQ print (set because printing=true)
  });

  it('should encode low-resolution printing', () => {
    const flags: PdfPermissionFlags = {
      printing: 'lowResolution',
    };

    const p = encodePermissions(flags);

    expect(p & 0x04).toBe(0x04); // print allowed
    expect(p & 0x800).toBe(0);   // HQ print NOT set
  });

  it('should handle empty flags object', () => {
    const p = encodePermissions({});
    // Only reserved bits should be set
    expect(p & 0x04).toBe(0); // no print
    expect(p & 0xc0).toBe(0xc0); // reserved bits set
  });

  it('should return a negative 32-bit integer', () => {
    // The upper bits 13-32 are set, making it negative in two's complement
    const p = encodePermissions({});
    expect(p).toBeLessThan(0);
  });
});

describe('decodePermissions', () => {
  it('should decode all permissions', () => {
    // Set bits 3-6, 9-12
    const value = 0xfffff0c0 | 0x04 | 0x08 | 0x10 | 0x20 | 0x100 | 0x200 | 0x400 | 0x800;
    const flags = decodePermissions(value);

    expect(flags.printing).toBe(true);
    expect(flags.modifying).toBe(true);
    expect(flags.copying).toBe(true);
    expect(flags.annotating).toBe(true);
    expect(flags.fillingForms).toBe(true);
    expect(flags.contentAccessibility).toBe(true);
    expect(flags.documentAssembly).toBe(true);
  });

  it('should decode no permissions', () => {
    const value = 0xfffff0c0; // Only reserved bits
    const flags = decodePermissions(value);

    expect(flags.printing).toBe(false);
    expect(flags.modifying).toBe(false);
    expect(flags.copying).toBe(false);
    expect(flags.annotating).toBe(false);
    expect(flags.fillingForms).toBe(false);
    expect(flags.contentAccessibility).toBe(false);
    expect(flags.documentAssembly).toBe(false);
  });

  it('should decode low-resolution printing', () => {
    // Print bit set (0x04) but HQ print bit (0x800) not set
    const value = 0xfffff0c0 | 0x04;
    const flags = decodePermissions(value);

    expect(flags.printing).toBe('lowResolution');
  });

  it('should decode full-quality printing', () => {
    // Both print (0x04) and HQ print (0x800) set
    const value = 0xfffff0c0 | 0x04 | 0x800;
    const flags = decodePermissions(value);

    expect(flags.printing).toBe(true);
  });
});

describe('encode/decode round-trip', () => {
  it('should round-trip all permissions', () => {
    const original: PdfPermissionFlags = {
      printing: true,
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    };

    const encoded = encodePermissions(original);
    const decoded = decodePermissions(encoded);

    expect(decoded.printing).toBe(true);
    expect(decoded.modifying).toBe(true);
    expect(decoded.copying).toBe(true);
    expect(decoded.annotating).toBe(true);
    expect(decoded.fillingForms).toBe(true);
    expect(decoded.contentAccessibility).toBe(true);
    expect(decoded.documentAssembly).toBe(true);
  });

  it('should round-trip no permissions', () => {
    const original: PdfPermissionFlags = {
      printing: false,
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    };

    const encoded = encodePermissions(original);
    const decoded = decodePermissions(encoded);

    expect(decoded.printing).toBe(false);
    expect(decoded.modifying).toBe(false);
    expect(decoded.copying).toBe(false);
    expect(decoded.annotating).toBe(false);
    expect(decoded.fillingForms).toBe(false);
    expect(decoded.contentAccessibility).toBe(false);
    expect(decoded.documentAssembly).toBe(false);
  });

  it('should round-trip low-resolution printing', () => {
    const original: PdfPermissionFlags = {
      printing: 'lowResolution',
      copying: true,
    };

    const encoded = encodePermissions(original);
    const decoded = decodePermissions(encoded);

    expect(decoded.printing).toBe('lowResolution');
    expect(decoded.copying).toBe(true);
    expect(decoded.modifying).toBe(false);
  });

  it('should round-trip partial permissions', () => {
    const original: PdfPermissionFlags = {
      printing: true,
      copying: false,
      fillingForms: true,
      contentAccessibility: true,
    };

    const encoded = encodePermissions(original);
    const decoded = decodePermissions(encoded);

    expect(decoded.printing).toBe(true);
    expect(decoded.copying).toBe(false);
    expect(decoded.fillingForms).toBe(true);
    expect(decoded.contentAccessibility).toBe(true);
    expect(decoded.modifying).toBe(false);
    expect(decoded.annotating).toBe(false);
    expect(decoded.documentAssembly).toBe(false);
  });
});
