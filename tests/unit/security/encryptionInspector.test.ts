/**
 * Tests for the encryption inspector (Module 0.35).
 *
 * Verifies that {@link inspectEncryption} correctly reports a PDF's
 * encryption + permission posture:
 *  - a non-encrypted document → { encrypted: false }
 *  - an AES-256 (V=5/R=6) document → method 'aes', keyBits 256,
 *    handler 'password', and the /P permission bits decoded per
 *    ISO 32000 Table 22.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import {
  inspectEncryption,
  type EncryptionReport,
} from '../../../src/security/encryptionInspector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an unencrypted single-page PDF and return its bytes. */
async function makePlainPdf(): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage();
  return doc.save();
}

/**
 * Build an encrypted single-page PDF and return its bytes.
 *
 * Uses the public `doc.encrypt()` + `doc.save()` path so that a real
 * /Encrypt dictionary + /ID array are produced in the trailer.
 */
async function makeEncryptedPdf(
  algorithm: 'rc4-40' | 'rc4-128' | 'aes-128' | 'aes-256',
  perms: Parameters<ReturnType<typeof createPdf>['encrypt']>[0]['permissions'],
  userPassword = '',
  ownerPassword = 'owner-secret',
): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage();
  await doc.encrypt({
    userPassword,
    ownerPassword,
    algorithm,
    permissions: perms,
  });
  return doc.save();
}

// ---------------------------------------------------------------------------
// Tests: non-encrypted document
// ---------------------------------------------------------------------------

describe('inspectEncryption — non-encrypted', () => {
  it('reports encrypted:false for a plain PDF', async () => {
    const pdf = await makePlainPdf();
    const report: EncryptionReport = await inspectEncryption(pdf);
    expect(report.encrypted).toBe(false);
    expect(report.method).toBeUndefined();
    expect(report.permissions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: AES-256 (V=5 / R=6)
// ---------------------------------------------------------------------------

describe('inspectEncryption — AES-256', () => {
  it('reports method/keyBits/version/revision/handler for AES-256', async () => {
    const pdf = await makeEncryptedPdf('aes-256', { printing: true, copying: true });
    const report = await inspectEncryption(pdf);

    expect(report.encrypted).toBe(true);
    expect(report.method).toBe('aes');
    expect(report.keyBits).toBe(256);
    expect(report.version).toBe(5);
    expect(report.revision).toBe(6);
    expect(report.handler).toBe('password');
  });

  it('decodes the /P permission bits correctly (printing+copying)', async () => {
    const pdf = await makeEncryptedPdf('aes-256', {
      printing: true, // bit 3 + bit 12 (high-res)
      copying: true, // bit 5
      modifying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    });
    const report = await inspectEncryption(pdf);

    expect(report.permissions).toBeDefined();
    const p = report.permissions!;
    expect(p.print).toBe(true);
    expect(p.printHighRes).toBe(true);
    expect(p.copy).toBe(true);
    expect(p.extract).toBe(true); // bit 5 maps to copy/extract per Table 22
    expect(p.modify).toBe(false);
    expect(p.annotate).toBe(false);
    expect(p.fillForms).toBe(false);
    expect(p.assemble).toBe(false);
  });

  it('decodes a different /P (modify+assemble, no print)', async () => {
    const pdf = await makeEncryptedPdf('aes-256', {
      printing: false,
      modifying: true, // bit 4
      documentAssembly: true, // bit 11
      annotating: true, // bit 6
      fillingForms: true, // bit 9
      contentAccessibility: true, // bit 10
    });
    const report = await inspectEncryption(pdf);

    const p = report.permissions!;
    expect(p.print).toBe(false);
    expect(p.printHighRes).toBe(false);
    expect(p.modify).toBe(true);
    expect(p.assemble).toBe(true);
    expect(p.annotate).toBe(true);
    expect(p.fillForms).toBe(true);
  });

  it('detects an empty user password (best-effort)', async () => {
    const pdf = await makeEncryptedPdf('aes-256', { printing: true }, '');
    const report = await inspectEncryption(pdf);
    expect(report.emptyUserPassword).toBe(true);
  });

  it('reports a non-empty user password as not empty', async () => {
    const pdf = await makeEncryptedPdf('aes-256', { printing: true }, 'hunter2');
    const report = await inspectEncryption(pdf);
    expect(report.emptyUserPassword).toBe(false);
  });

  it('does NOT report emptyUserPassword:true when only the OWNER password is empty (R=6)', async () => {
    // User password is non-empty; owner password is empty. The empty
    // password DOES open the document (it matches the owner), but it is
    // NOT the user password — so emptyUserPassword must not be asserted true.
    const pdf = await makeEncryptedPdf('aes-256', { printing: true }, 'hunter2', '');
    const report = await inspectEncryption(pdf);
    expect(report.emptyUserPassword).not.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: AES-128 (V=4 / R=4) and RC4
// ---------------------------------------------------------------------------

describe('inspectEncryption — AES-128 & RC4', () => {
  it('reports AES-128 as method aes, 128 bits, V4/R4', async () => {
    const pdf = await makeEncryptedPdf('aes-128', { printing: true });
    const report = await inspectEncryption(pdf);
    expect(report.method).toBe('aes');
    expect(report.keyBits).toBe(128);
    expect(report.version).toBe(4);
    expect(report.revision).toBe(4);
    expect(report.handler).toBe('password');
  });

  it('reports RC4-128 as method rc4, 128 bits, V2/R3', async () => {
    const pdf = await makeEncryptedPdf('rc4-128', { printing: true });
    const report = await inspectEncryption(pdf);
    expect(report.method).toBe('rc4');
    expect(report.keyBits).toBe(128);
    expect(report.version).toBe(2);
    expect(report.revision).toBe(3);
  });

  it('reports RC4-40 as method rc4, 40 bits, V1/R2', async () => {
    const pdf = await makeEncryptedPdf('rc4-40', { printing: true });
    const report = await inspectEncryption(pdf);
    expect(report.method).toBe('rc4');
    expect(report.keyBits).toBe(40);
    expect(report.version).toBe(1);
    expect(report.revision).toBe(2);
  });

  it('does NOT report emptyUserPassword:true when only the OWNER password is empty (R=4)', async () => {
    // R<=4 path: empty password matches the owner but not the (non-empty)
    // user password. emptyUserPassword must not be asserted true.
    const pdf = await makeEncryptedPdf('aes-128', { printing: true }, 'hunter2', '');
    const report = await inspectEncryption(pdf);
    expect(report.emptyUserPassword).not.toBe(true);
  });
});
