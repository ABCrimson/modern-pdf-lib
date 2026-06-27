/**
 * @module security/encryptionInspector
 *
 * Reports a PDF's encryption and permission posture **without** requiring
 * the document to be decrypted.  Given the raw file bytes this module
 * locates the trailer's `/Encrypt` dictionary, decodes the standard
 * security handler parameters (`/V`, `/R`, key length, crypt filters),
 * the `/Filter` (handler) name, and the `/P` permission integer.
 *
 * It is purely a *reader*: it never mutates the input and never writes a
 * new file.  This makes it safe to run against untrusted PDFs to audit
 * their access controls.
 *
 * ## Accuracy notes (verified against ISO 32000)
 *
 * - **Encryption dictionary location**: ISO 32000-1:2008 §7.5.8.1 / §7.5.5
 *   (File trailer) — the optional `/Encrypt` entry in the trailer
 *   dictionary is an indirect reference to the encryption dictionary.
 * - **`/V` and `/R`**: ISO 32000-1:2008 Table 20 (Entries common to all
 *   encryption dictionaries) and Table 21 (Standard security handler).
 *     - V=1: 40-bit RC4/AES algorithm, R=2.
 *     - V=2: RC4/AES with a key length given by `/Length` (in bits), R=3.
 *     - V=4: crypt filters; algorithm given by the `/CFM` of the named
 *       filter (`/V2` = RC4, `/AESV2` = 128-bit AES-CBC), R=4.
 *     - V=5/R=6: 256-bit AES-CBC (`/AESV3`), ISO 32000-2:2020 §7.6.4.3.
 * - **`/Length`**: ISO 32000-1:2008 Table 20 — key length in *bits*,
 *   multiple of 8, default 40.  For V=5 the key is always 256 bits and
 *   `/Length` (if present) is informational.
 * - **`/Filter`**: ISO 32000-1:2008 Table 20 — name of the security
 *   handler.  `/Standard` = the password-based standard handler;
 *   `/Adobe.PubSec` = the public-key (certificate) security handler
 *   (ISO 32000-1:2008 §7.6.5).
 * - **`/P` permission bits**: ISO 32000-1:2008 Table 22 (User access
 *   permissions).  Bits are numbered from 1 = least-significant.  The
 *   value is a 32-bit signed integer.  Bit meanings used here:
 *     - bit 3  — print the document (low resolution if bit 12 is clear).
 *     - bit 4  — modify the contents of the document.
 *     - bit 5  — copy or otherwise extract text and graphics.
 *     - bit 6  — add or modify text annotations, fill in form fields.
 *     - bit 9  — fill in existing interactive form fields (even if bit 6
 *                is clear); R≥3.
 *     - bit 10 — extract text and graphics for accessibility; R≥3.
 *     - bit 11 — assemble the document (insert/rotate/delete pages); R≥3.
 *     - bit 12 — print to a high-resolution representation; R≥3.
 *   These bit numbers match the constants in `crypto/permissions.ts`.
 */

import {
  PdfBool,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  type PdfObject,
} from '../core/pdfObjects.js';
import type { PdfRef } from '../core/pdfObjects.js';
import { PdfObjectRegistry } from '../core/pdfObjects.js';
import { PdfLexer } from '../parser/lexer.js';
import { PdfObjectParser } from '../parser/objectParser.js';
import { XrefParser } from '../parser/xrefParser.js';
import type { XrefEntry } from '../parser/xrefParser.js';
import { verifyUserPassword } from '../crypto/keyDerivation.js';
import type { EncryptDictValues } from '../crypto/keyDerivation.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Decoded `/P` permission flags (ISO 32000-1:2008 Table 22).
 *
 * Each flag is `true` when the corresponding capability is **granted**
 * by the document's permission integer.
 */
export interface PermissionFlags {
  /** Bit 3: print the document (possibly only low resolution). */
  print: boolean;
  /** Bit 4: modify the contents of the document. */
  modify: boolean;
  /** Bit 5: copy or otherwise extract text and graphics. */
  copy: boolean;
  /** Bit 6: add or modify text annotations / fill in form fields. */
  annotate: boolean;
  /** Bit 9: fill in existing interactive form fields. */
  fillForms: boolean;
  /** Bit 5: extract text and graphics (alias of {@link copy}, Table 22). */
  extract: boolean;
  /** Bit 11: assemble the document (insert/rotate/delete pages). */
  assemble: boolean;
  /** Bit 12: print to a high-resolution representation. */
  printHighRes: boolean;
}

/**
 * A report describing a PDF's encryption + permission posture.
 *
 * When `encrypted` is `false` all other fields are absent.
 */
export interface EncryptionReport {
  /** Whether the trailer references an `/Encrypt` dictionary. */
  encrypted: boolean;
  /** The bulk cipher: `'rc4'` or `'aes'` (omitted if undeterminable). */
  method?: 'rc4' | 'aes' | undefined;
  /** Key length in bits (40, 128, or 256). */
  keyBits?: number | undefined;
  /** The `/V` algorithm version. */
  version?: number | undefined;
  /** The `/R` standard-security-handler revision. */
  revision?: number | undefined;
  /** The security handler: `'password'` (/Standard) or `'publicKey'`. */
  handler?: 'password' | 'publicKey' | undefined;
  /**
   * Best-effort: whether the document opens with an **empty** user
   * password (the common "owner-only protection" case).  Only set for
   * the standard password handler; omitted when it cannot be tested.
   */
  emptyUserPassword?: boolean | undefined;
  /** Decoded `/P` permission flags (standard handler only). */
  permissions?: PermissionFlags | undefined;
}

// ---------------------------------------------------------------------------
// Permission bit positions (ISO 32000-1:2008 Table 22, 1-indexed → mask)
// ---------------------------------------------------------------------------

const BIT_PRINT = 1 << 2; // bit 3
const BIT_MODIFY = 1 << 3; // bit 4
const BIT_COPY = 1 << 4; // bit 5
const BIT_ANNOTATE = 1 << 5; // bit 6
const BIT_FILL_FORMS = 1 << 8; // bit 9
const BIT_ASSEMBLE = 1 << 10; // bit 11
const BIT_PRINT_HIGH_RES = 1 << 11; // bit 12

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspect a PDF's encryption + permission posture.
 *
 * @param pdf  The raw PDF file bytes.
 * @returns    A {@link EncryptionReport}.  If the trailer has no
 *             `/Encrypt` entry (or the file is unparseable) the report is
 *             `{ encrypted: false }`.
 */
export async function inspectEncryption(
  pdf: Uint8Array,
): Promise<EncryptionReport> {
  // ---- Locate the trailer and the /Encrypt dictionary --------------------
  const located = await locateEncryptDict(pdf);
  if (located === undefined) {
    return { encrypted: false };
  }
  const { encryptDict, fileId, encryptRef } = located;

  // ---- /Filter → handler -------------------------------------------------
  const filterName = getName(encryptDict, '/Filter');
  let handler: 'password' | 'publicKey' | undefined;
  if (filterName === '/Standard') {
    handler = 'password';
  } else if (filterName === '/Adobe.PubSec') {
    handler = 'publicKey';
  }

  // ---- /V and /R ---------------------------------------------------------
  const version = getNumber(encryptDict, '/V');
  const revision = getNumber(encryptDict, '/R');

  // ---- Algorithm (method) + key length -----------------------------------
  const { method, keyBits } = decodeAlgorithm(encryptDict, version);

  // ---- /P permissions (standard handler) ---------------------------------
  let permissions: PermissionFlags | undefined;
  const pValue = getNumber(encryptDict, '/P');
  if (handler === 'password' && pValue !== undefined) {
    permissions = decodePermissionBits(pValue);
  }

  // ---- Best-effort empty-user-password test ------------------------------
  let emptyUserPassword: boolean | undefined;
  if (handler === 'password') {
    emptyUserPassword = await testEmptyUserPassword(encryptDict, fileId);
  }

  // `encryptRef` is intentionally unused beyond presence detection; the
  // void keeps it available for future per-object inspection without
  // tripping noUnusedLocals.
  void encryptRef;

  const report: EncryptionReport = { encrypted: true };
  if (method !== undefined) report.method = method;
  if (keyBits !== undefined) report.keyBits = keyBits;
  if (version !== undefined) report.version = version;
  if (revision !== undefined) report.revision = revision;
  if (handler !== undefined) report.handler = handler;
  if (emptyUserPassword !== undefined) report.emptyUserPassword = emptyUserPassword;
  if (permissions !== undefined) report.permissions = permissions;
  return report;
}

// ---------------------------------------------------------------------------
// Internal: locate the /Encrypt dictionary from the trailer
// ---------------------------------------------------------------------------

interface LocatedEncrypt {
  encryptDict: PdfDict;
  encryptRef: PdfRef;
  fileId: Uint8Array;
}

/**
 * Parse just enough of the PDF (header + xref + trailer) to resolve the
 * `/Encrypt` dictionary and the first element of the `/ID` array.
 *
 * Returns `undefined` when the file has no `/Encrypt` entry or when it
 * cannot be parsed far enough to find one.
 */
async function locateEncryptDict(
  pdf: Uint8Array,
): Promise<LocatedEncrypt | undefined> {
  // A valid PDF needs at least a header; bail early on obviously-too-short
  // inputs rather than letting the parser throw.
  if (pdf.length < 8) return undefined;

  let encryptRef: PdfRef | undefined;
  let fileIdFirst: Uint8Array;
  let entry: XrefEntry | undefined;
  let objectParser: PdfObjectParser;
  try {
    const lexer = new PdfLexer(pdf);
    const registry = new PdfObjectRegistry();
    objectParser = new PdfObjectParser(lexer, registry);
    const xrefParser = new XrefParser(pdf, objectParser);
    const { entries, trailer } = await xrefParser.parseXref();

    encryptRef = trailer.encryptRef;
    if (encryptRef === undefined) return undefined;

    fileIdFirst = trailer.id?.[0] ?? new Uint8Array(0);
    entry = entries.get(encryptRef.objectNumber);
  } catch {
    return undefined;
  }

  // The /Encrypt dictionary must be a normal in-use (uncompressed) object;
  // ISO 32000-1:2008 §7.5.8.2 forbids storing it in an object stream.
  if (entry === undefined || entry.type !== 'in-use') return undefined;

  let encryptObj: PdfObject;
  try {
    const { object } = objectParser.parseIndirectObjectAt(entry.offset);
    encryptObj = object;
  } catch {
    return undefined;
  }
  if (encryptObj.kind !== 'dict') return undefined;

  return { encryptDict: encryptObj as PdfDict, encryptRef, fileId: fileIdFirst };
}

// ---------------------------------------------------------------------------
// Internal: algorithm decoding (ISO 32000-1 Table 20/21, ISO 32000-2 §7.6)
// ---------------------------------------------------------------------------

/**
 * Decode the bulk cipher and key length from an encryption dictionary.
 *
 * - V=1: 40-bit RC4 (Table 20/21).
 * - V=2: RC4 with `/Length` bits.
 * - V=4: inspect the crypt filter `/CFM` of the filter named by `/StmF`
 *   (falling back to `/StdCF`): `/V2` → RC4, `/AESV2` → 128-bit AES,
 *   `/AESV3` → 256-bit AES, `/Identity`/`/None` → no encryption.
 * - V=5: 256-bit AES (`/AESV3`).
 */
function decodeAlgorithm(
  dict: PdfDict,
  version: number | undefined,
): { method?: 'rc4' | 'aes' | undefined; keyBits?: number | undefined } {
  const lengthBits = getNumber(dict, '/Length');

  if (version === 1) {
    return { method: 'rc4', keyBits: 40 };
  }
  if (version === 2) {
    return { method: 'rc4', keyBits: lengthBits ?? 40 };
  }
  if (version === 5) {
    // V=5/R=6 is always AES-256 (AESV3) per ISO 32000-2 §7.6.4.3.
    return { method: 'aes', keyBits: 256 };
  }
  if (version === 4) {
    const cfm = resolveCryptFilterMethod(dict);
    if (cfm === '/AESV3') return { method: 'aes', keyBits: 256 };
    if (cfm === '/AESV2') return { method: 'aes', keyBits: lengthBits ?? 128 };
    if (cfm === '/V2') return { method: 'rc4', keyBits: lengthBits ?? 128 };
    // /Identity or unknown → cannot determine the bulk cipher.
    return { method: undefined, keyBits: lengthBits ?? undefined };
  }

  // Unknown /V — return what we can (the key length, if stated).
  return { method: undefined, keyBits: lengthBits ?? undefined };
}

/**
 * For V=4 documents, resolve the `/CFM` (crypt filter method) name of the
 * stream crypt filter.  Looks up `/StmF` in `/CF`, then falls back to the
 * conventional `/StdCF` entry.
 */
function resolveCryptFilterMethod(dict: PdfDict): string | undefined {
  const cf = dict.get('/CF');
  if (cf === undefined || cf.kind !== 'dict') return undefined;
  const cfDict = cf as PdfDict;

  // Preferred crypt filter name comes from /StmF (the stream filter).
  let filterName = getName(dict, '/StmF');
  // /Identity is a built-in filter not listed in /CF.
  if (filterName === '/Identity') return '/Identity';

  let stdCf: PdfObject | undefined = filterName !== undefined
    ? cfDict.get(filterName)
    : undefined;
  if (stdCf === undefined || stdCf.kind !== 'dict') {
    // Fall back to the conventional /StdCF entry.
    stdCf = cfDict.get('/StdCF');
    filterName = '/StdCF';
  }
  if (stdCf === undefined || stdCf.kind !== 'dict') return undefined;

  return getName(stdCf as PdfDict, '/CFM');
}

// ---------------------------------------------------------------------------
// Internal: /P permission decoding (ISO 32000-1:2008 Table 22)
// ---------------------------------------------------------------------------

/**
 * Decode the 32-bit `/P` integer into individual permission flags.
 *
 * The `/P` value is a *signed* 32-bit integer; bitwise AND in JavaScript
 * operates on the 32-bit two's-complement representation, so masks apply
 * correctly even when `/P` is negative (the usual case, since reserved
 * high bits are set to 1).
 */
function decodePermissionBits(p: number): PermissionFlags {
  const has = (mask: number): boolean => (p & mask) !== 0;
  const copy = has(BIT_COPY);
  return {
    print: has(BIT_PRINT),
    modify: has(BIT_MODIFY),
    copy,
    annotate: has(BIT_ANNOTATE),
    fillForms: has(BIT_FILL_FORMS),
    extract: copy, // bit 5 governs both copy and extract per Table 22
    assemble: has(BIT_ASSEMBLE),
    printHighRes: has(BIT_PRINT_HIGH_RES),
  };
}

// ---------------------------------------------------------------------------
// Internal: best-effort empty-user-password test
// ---------------------------------------------------------------------------

/**
 * Test whether the empty **user** password (`""`) authenticates against the
 * standard security handler.
 *
 * This must verify specifically against the `/U` (user) value using the
 * standard /U validation algorithm — **not** simply check whether the empty
 * password opens the document.  The general file-key derivation
 * (`PdfEncryptionHandler.fromEncryptDict` / `computeFileEncryptionKey`)
 * accepts a password that matches **either** the user **or** the owner
 * password, so a document whose *owner* password is empty (while the user
 * password is non-empty) would otherwise be mis-reported as having an empty
 * user password.  To avoid asserting a possibly-false `true`, we run the
 * user-password-specific check ({@link verifyUserPassword}) against `/U`.
 *
 * Returns `undefined` when the test cannot be performed (e.g. the `/O` / `/U`
 * values are missing, or the maths throws for an unsupported /V/R).
 */
async function testEmptyUserPassword(
  dict: PdfDict,
  fileId: Uint8Array,
): Promise<boolean | undefined> {
  // Build the subset of encryption-dict values the /U validation needs.
  const ownerKey = getStringBytes(dict, '/O');
  const userKey = getStringBytes(dict, '/U');
  // Without /O and /U we cannot run the standard /U validation algorithm.
  if (ownerKey === undefined || userKey === undefined) return undefined;

  const dictValues: EncryptDictValues = {
    version: getNumber(dict, '/V') ?? 0,
    revision: getNumber(dict, '/R') ?? 0,
    keyLength: getNumber(dict, '/Length') ?? 40,
    ownerKey,
    userKey,
    permissions: getNumber(dict, '/P') ?? 0,
    ownerEncryptionKey: getStringBytes(dict, '/OE'),
    userEncryptionKey: getStringBytes(dict, '/UE'),
    perms: getStringBytes(dict, '/Perms'),
    encryptMetadata: getBool(dict, '/EncryptMetadata') ?? true,
  };

  try {
    // verifyUserPassword checks the empty password against /U *only* (it does
    // not fall back to the owner password), so a `true` result genuinely means
    // the empty string is the user password.
    return await verifyUserPassword('', dictValues, fileId);
  } catch {
    // Any thrown error (e.g. unsupported /V/R, SASLprep failure) means we
    // could not run the check → report conservatively as undefined.
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Internal: typed dictionary accessors
// ---------------------------------------------------------------------------

/** Read a `/Name` value (including the leading `/`) from a dict. */
function getName(dict: PdfDict, key: string): string | undefined {
  const obj = dict.get(key);
  if (obj !== undefined && obj.kind === 'name') {
    return (obj as PdfName).value;
  }
  return undefined;
}

/** Read a numeric value from a dict. */
function getNumber(dict: PdfDict, key: string): number | undefined {
  const obj = dict.get(key);
  if (obj !== undefined && obj.kind === 'number') {
    return (obj as PdfNumber).value;
  }
  return undefined;
}

/** Read a boolean value from a dict. */
function getBool(dict: PdfDict, key: string): boolean | undefined {
  const obj = dict.get(key);
  if (obj !== undefined && obj.kind === 'bool') {
    return (obj as PdfBool).value;
  }
  return undefined;
}

/**
 * Read raw bytes from a `/String` entry.
 *
 * Hex strings whose value is still raw hex digits (e.g. produced by
 * `PdfString.hexFromBytes`) are decoded from hex pairs; otherwise the
 * character codes are treated as raw Latin-1 bytes.  Mirrors the decoding
 * used by `crypto/encryptionHandler.fromEncryptDict` so the /U validation
 * sees the same /O, /U, /OE, /UE, /Perms bytes.
 */
function getStringBytes(dict: PdfDict, key: string): Uint8Array | undefined {
  const obj = dict.get(key);
  if (obj === undefined || obj.kind !== 'string') return undefined;

  const str = obj as PdfString;
  if (str.hex && /^[\da-fA-F\s]*$/.test(str.value)) {
    const clean = str.value.replace(/\s/g, '');
    return Uint8Array.fromHex(clean.length % 2 === 0 ? clean : clean + '0');
  }

  const bytes = new Uint8Array(str.value.length);
  for (let i = 0; i < str.value.length; i++) {
    bytes[i] = str.value.charCodeAt(i) & 0xff;
  }
  return bytes;
}
