/**
 * Fixture builders for tests/unit/signature/trust-anchors.test.ts and the
 * `checkCertificateStatus` cases of tests/unit/signature/ocsp.test.ts.
 *
 * The builders are copied from the signature unit tests (chainValidator,
 * ocsp, offlineRevocation, signatureVerifier and timestamp) and typed
 * strictly. Every input is fixed (names, serials, dates, byte strings);
 * only the RSA-2048 keys come from WebCrypto on each run.
 */

import {
  encodeContextTag,
  encodeGeneralizedTime,
  encodeInteger,
  encodeLength,
  encodeOctetString,
  encodeOID,
  encodeSequence,
  encodeSet,
  encodeUTCTime,
  encodeUtf8String,
  parseDerTlv,
} from '../../src/signature/pkcs7.js';
import type { Asn1Node } from '../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Byte and DER utilities
// ---------------------------------------------------------------------------

const textEncoder = new TextEncoder();

/** Encode an ASCII string as bytes. */
export function ascii(text: string): Uint8Array {
  return textEncoder.encode(text);
}

/** Copy bytes into a fresh, exactly sized ArrayBuffer (for WebCrypto and fetch bodies). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** Concatenate byte arrays. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Index of the first occurrence of `needle` in `haystack`, or -1. */
export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** The child at `index` of a parsed DER node; throws when it is absent. */
export function derChild(node: Asn1Node, index: number): Asn1Node {
  const child = node.children[index];
  if (child === undefined) {
    throw new Error(`DER node (tag 0x${node.tag.toString(16)}) has no child ${index}`);
  }
  return child;
}

/** The full TLV bytes of `child`, a direct child of `parent`. */
function childTlv(parent: Asn1Node, child: Asn1Node): Uint8Array {
  return parent.data.subarray(child.offset, child.offset + child.totalLength);
}

/** Encode a small non-negative integer. */
function encodeSmallInteger(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([0x02, 0x01, value]);
  }
  return new Uint8Array([0x02, 0x02, (value >> 8) & 0xff, value & 0xff]);
}

/** Encode a BIT STRING with zero unused bits. */
export function encodeBitString(data: Uint8Array): Uint8Array {
  const len = encodeLength(data.length + 1);
  const result = new Uint8Array(1 + len.length + 1 + data.length);
  result[0] = 0x03;
  result.set(len, 1);
  result[1 + len.length] = 0x00;
  result.set(data, 1 + len.length + 1);
  return result;
}

/** Encode a BOOLEAN. */
function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, value ? 0xff : 0x00]);
}

/** Encode an ENUMERATED value. */
function encodeEnumerated(value: number): Uint8Array {
  return new Uint8Array([0x0a, 0x01, value]);
}

/** Encode a context-specific implicit primitive tag. */
function encodeImplicitTag(tagNum: number, data: Uint8Array): Uint8Array {
  const len = encodeLength(data.length);
  const result = new Uint8Array(1 + len.length + data.length);
  result[0] = 0x80 | tagNum;
  result.set(len, 1);
  result.set(data, 1 + len.length);
  return result;
}

/** Encode an INTEGER whose content bytes are used exactly as given. */
function encodeRawInteger(content: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(0x02), encodeLength(content.length), content);
}

/** Build a Name (SEQUENCE of SET of AttributeTypeAndValue) holding only a CN. */
export function buildName(commonName: string): Uint8Array {
  const atv = encodeSequence([encodeOID('2.5.4.3'), encodeUtf8String(commonName)]);
  return encodeSequence([encodeSet([atv])]);
}

const NULL_PARAMS = new Uint8Array([0x05, 0x00]);
const SHA256_RSA_ALGO = encodeSequence([encodeOID('1.2.840.113549.1.1.11'), NULL_PARAMS]);
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Keys and certificates
// ---------------------------------------------------------------------------

/** Generate an RSA-2048 RSASSA-PKCS1-v1_5 / SHA-256 key pair. */
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return globalThis.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
}

/** Sign `data` with RSASSA-PKCS1-v1_5 / SHA-256. */
export async function signRsaSha256(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      toArrayBuffer(data),
    ),
  );
}

async function exportSpki(publicKey: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.exportKey('spki', publicKey));
}

async function signCertificate(tbsCert: Uint8Array, issuerKey: CryptoKey): Promise<Uint8Array> {
  const signature = await signRsaSha256(issuerKey, tbsCert);
  return encodeSequence([tbsCert, SHA256_RSA_ALGO, encodeBitString(signature)]);
}

/** The TBSCertificate node of a certificate and the index of its serialNumber. */
function tbsOf(certDer: Uint8Array): { tbs: Asn1Node; base: number } {
  const tbs = derChild(parseDerTlv(certDer, 0), 0);
  const base = derChild(tbs, 0).tag === 0xa0 ? 1 : 0;
  return { tbs, base };
}

/** The subject Name TLV of a certificate. */
export function extractSubjectName(certDer: Uint8Array): Uint8Array {
  const { tbs, base } = tbsOf(certDer);
  return childTlv(tbs, derChild(tbs, base + 4));
}

/** The subject public key bytes (SPKI BIT STRING content without the unused-bits byte). */
export function extractSubjectPublicKeyBytes(certDer: Uint8Array): Uint8Array {
  const { tbs, base } = tbsOf(certDer);
  const spki = derChild(tbs, base + 5);
  return derChild(spki, 1).data.subarray(1);
}

/** Generate a self-signed root CA (basicConstraints cA=TRUE, ten-year validity from now). */
export async function generateRootCA(
  name: string,
): Promise<{ certificate: Uint8Array; keyPair: CryptoKeyPair }> {
  const keyPair = await generateRsaKeyPair();
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 10 * 365 * DAY_MS);
  const bcExt = encodeSequence([
    encodeOID('2.5.29.19'),
    encodeBoolean(true),
    encodeOctetString(encodeSequence([encodeBoolean(true)])),
  ]);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(Uint8Array.of(0x01, 0x00, 0x00, 0x01)),
    SHA256_RSA_ALGO,
    buildName(name),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(name),
    await exportSpki(keyPair.publicKey),
    encodeContextTag(3, encodeSequence([bcExt])),
  ]);
  return { certificate: await signCertificate(tbsCert, keyPair.privateKey), keyPair };
}

/** Generate an end-entity certificate issued by `issuerCert` (one-year validity from now). */
export async function generateLeafCert(
  name: string,
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
): Promise<Uint8Array> {
  const keyPair = await generateRsaKeyPair();
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(Uint8Array.of(0x02, 0x00, 0x00, 0x02)),
    SHA256_RSA_ALGO,
    extractSubjectName(issuerCert),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(name),
    await exportSpki(keyPair.publicKey),
  ]);
  return signCertificate(tbsCert, issuerKeyPair.privateKey);
}

/**
 * Generate a CA certificate (issuer CN "Test CA", subject CN "Test Subject",
 * signed by its own key) whose AIA extension names `ocspUrl`.
 */
export async function generateTestCertWithOcsp(
  ocspUrl: string,
): Promise<{ certificate: Uint8Array; keyPair: CryptoKeyPair }> {
  const keyPair = await generateRsaKeyPair();
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const accessDesc = encodeSequence([
    encodeOID('1.3.6.1.5.5.7.48.1'),
    encodeImplicitTag(6, ascii(ocspUrl)),
  ]);
  const aiaExt = encodeSequence([
    encodeOID('1.3.6.1.5.5.7.1.1'),
    encodeOctetString(encodeSequence([accessDesc])),
  ]);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(Uint8Array.of(0x01, 0x02, 0x03, 0x04)),
    SHA256_RSA_ALGO,
    buildName('Test CA'),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName('Test Subject'),
    await exportSpki(keyPair.publicKey),
    encodeContextTag(3, encodeSequence([aiaExt])),
  ]);
  return { certificate: await signCertificate(tbsCert, keyPair.privateKey), keyPair };
}

/** Generate a certificate with serial `serialBytes` issued by `issuerCert`. */
export async function generateIssuedCert(
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
  subjectName: string,
  serialBytes: Uint8Array,
): Promise<Uint8Array> {
  const keyPair = await generateRsaKeyPair();
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(serialBytes),
    SHA256_RSA_ALGO,
    extractSubjectName(issuerCert),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(subjectName),
    await exportSpki(keyPair.publicKey),
  ]);
  return signCertificate(tbsCert, issuerKeyPair.privateKey);
}

/**
 * Generate an OCSP responder certificate (serial 05000005) issued by
 * `issuerCert`, valid from now for one year. With `ekuOids` it carries an
 * extendedKeyUsage extension listing them; without, it has no extensions.
 */
export async function generateResponderCert(
  name: string,
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
  ekuOids?: readonly string[],
): Promise<{ certificate: Uint8Array; keyPair: CryptoKeyPair }> {
  const keyPair = await generateRsaKeyPair();
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const fields = [
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(Uint8Array.of(0x05, 0x00, 0x00, 0x05)),
    SHA256_RSA_ALGO,
    extractSubjectName(issuerCert),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(name),
    await exportSpki(keyPair.publicKey),
  ];
  if (ekuOids !== undefined) {
    const ekuExt = encodeSequence([
      encodeOID('2.5.29.37'),
      encodeOctetString(encodeSequence(ekuOids.map((oid) => encodeOID(oid)))),
    ]);
    fields.push(encodeContextTag(3, encodeSequence([ekuExt])));
  }
  const tbsCert = encodeSequence(fields);
  return { certificate: await signCertificate(tbsCert, issuerKeyPair.privateKey), keyPair };
}

/** Generate a self-signed signer certificate and its PKCS#8 private key. */
export async function generateTestCert(
  cn: string,
): Promise<{ certificate: Uint8Array; privateKey: Uint8Array; keyPair: CryptoKeyPair }> {
  const keyPair = await generateRsaKeyPair();
  const privateKey = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(Uint8Array.of(0x03, 0x00, 0x00, 0x03)),
    SHA256_RSA_ALGO,
    buildName(cn),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(cn),
    await exportSpki(keyPair.publicKey),
  ]);
  return { certificate: await signCertificate(tbsCert, keyPair.privateKey), privateKey, keyPair };
}

/**
 * Build an unsigned placeholder certificate (zero-filled key and signature),
 * enough for the serial-matching revocation code to read.
 */
export function buildTestCertificate(serial: Uint8Array, cn: string): Uint8Array {
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * DAY_MS);
  const spki = encodeSequence([
    encodeSequence([encodeOID('1.2.840.113549.1.1.1'), NULL_PARAMS]),
    encodeBitString(new Uint8Array(64)),
  ]);
  const tbsCert = encodeSequence([
    encodeContextTag(0, encodeSmallInteger(2)),
    encodeInteger(serial),
    SHA256_RSA_ALGO,
    buildName(cn),
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    buildName(cn),
    spki,
  ]);
  return encodeSequence([tbsCert, SHA256_RSA_ALGO, encodeBitString(new Uint8Array(32))]);
}

// ---------------------------------------------------------------------------
// OCSP and CRL
// ---------------------------------------------------------------------------

/** SHA-1 of `data` (the CertID hash algorithm the library uses). */
export async function sha1(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', toArrayBuffer(data)));
}

/** The CertID issuerNameHash and issuerKeyHash for certificates issued by `issuerCert`. */
export async function computeCertIdHashes(
  issuerCert: Uint8Array,
): Promise<{ issuerNameHash: Uint8Array; issuerKeyHash: Uint8Array }> {
  return {
    issuerNameHash: await sha1(extractSubjectName(issuerCert)),
    issuerKeyHash: await sha1(extractSubjectPublicKeyBytes(issuerCert)),
  };
}

/** Options for {@link buildMockBasicOcspResponse}. */
export interface MockBasicOcspOptions {
  status: 'good' | 'revoked' | 'unknown';
  serialNumber: Uint8Array;
  thisUpdate: Date;
  nextUpdate?: Date | undefined;
  producedAt: Date;
  revokedAt?: Date | undefined;
  /** CertID issuerNameHash; 20 zero bytes when absent. */
  issuerNameHash?: Uint8Array | undefined;
  /** CertID issuerKeyHash; 20 zero bytes when absent. */
  issuerKeyHash?: Uint8Array | undefined;
  /** Signs tbsResponseData (RSASSA-PKCS1-v1_5 / SHA-256); 256 zero bytes when absent. */
  sign?: CryptoKey | undefined;
  /** Certificates for the `certs [0]` field (a delegated responder); omitted when absent. */
  certs?: Uint8Array[] | undefined;
}

/** Build a BasicOCSPResponse with one SingleResponse (responderID byKey, zero hash). */
export async function buildMockBasicOcspResponse(
  options: MockBasicOcspOptions,
): Promise<Uint8Array> {
  const certId = encodeSequence([
    encodeSequence([encodeOID('1.3.14.3.2.26'), NULL_PARAMS]),
    encodeOctetString(options.issuerNameHash ?? new Uint8Array(20)),
    encodeOctetString(options.issuerKeyHash ?? new Uint8Array(20)),
    encodeInteger(options.serialNumber),
  ]);

  let certStatus: Uint8Array;
  if (options.status === 'good') {
    certStatus = new Uint8Array([0x80, 0x00]);
  } else if (options.status === 'revoked') {
    certStatus = encodeContextTag(
      1,
      encodeGeneralizedTime(options.revokedAt ?? options.thisUpdate),
    );
  } else {
    certStatus = new Uint8Array([0x82, 0x00]);
  }

  const single: Uint8Array[] = [certId, certStatus, encodeGeneralizedTime(options.thisUpdate)];
  if (options.nextUpdate !== undefined) {
    single.push(encodeContextTag(0, encodeGeneralizedTime(options.nextUpdate)));
  }

  const responseData = encodeSequence([
    encodeContextTag(2, encodeOctetString(new Uint8Array(20))),
    encodeGeneralizedTime(options.producedAt),
    encodeSequence([encodeSequence(single)]),
  ]);

  const signature =
    options.sign === undefined
      ? new Uint8Array(256)
      : await signRsaSha256(options.sign, responseData);

  const fields = [responseData, SHA256_RSA_ALGO, encodeBitString(signature)];
  if (options.certs !== undefined) {
    fields.push(encodeContextTag(0, encodeSequence(options.certs)));
  }
  return encodeSequence(fields);
}

/** Wrap a BasicOCSPResponse in an OCSPResponse (status `responseStatus`). */
export function buildMockOcspResponse(responseStatus: number, basicResp?: Uint8Array): Uint8Array {
  const statusEnum = encodeEnumerated(responseStatus);
  if (basicResp === undefined || responseStatus !== 0) {
    return encodeSequence([statusEnum]);
  }
  const responseBytes = encodeSequence([
    encodeOID('1.3.6.1.5.5.7.48.1.1'),
    encodeOctetString(basicResp),
  ]);
  return encodeSequence([statusEnum, encodeContextTag(0, responseBytes)]);
}

/**
 * Build an unsigned BasicOCSPResponse (32 zero signature bytes, zero CertID
 * hashes, no nextUpdate) for `serial` with certStatus 0 good, 1 revoked, 2 unknown.
 * The times are fixed (2026-01-01).
 */
export function buildOcspBasicResponse(serial: Uint8Array, status: 0 | 1 | 2): Uint8Array {
  const fixedTime = new Date(Date.UTC(2026, 0, 1));
  const certId = encodeSequence([
    encodeSequence([encodeOID('2.16.840.1.101.3.4.2.1'), NULL_PARAMS]),
    encodeOctetString(new Uint8Array(32)),
    encodeOctetString(new Uint8Array(32)),
    encodeInteger(serial),
  ]);
  let certStatus: Uint8Array;
  if (status === 0) {
    certStatus = new Uint8Array([0x80, 0x00]);
  } else if (status === 1) {
    certStatus = encodeContextTag(1, encodeGeneralizedTime(fixedTime));
  } else {
    certStatus = new Uint8Array([0x82, 0x00]);
  }
  const singleResponse = encodeSequence([certId, certStatus, encodeGeneralizedTime(fixedTime)]);
  const tbsResponseData = encodeSequence([
    buildName('OCSP Responder'),
    encodeGeneralizedTime(fixedTime),
    encodeSequence([singleResponse]),
  ]);
  return encodeSequence([tbsResponseData, SHA256_RSA_ALGO, encodeBitString(new Uint8Array(32))]);
}

/** Wrap a BasicOCSPResponse in a successful OCSPResponse. */
export function buildOcspResponse(basicResponse: Uint8Array): Uint8Array {
  return buildMockOcspResponse(0, basicResponse);
}

/**
 * Build an unsigned v2 CRL (32 zero signature bytes) issued by CN `issuerCn`
 * listing `revokedSerials`. The times are fixed (2026-01-01).
 */
export function buildTestCrl(issuerCn: string, revokedSerials: Uint8Array[]): Uint8Array {
  const fixedTime = new Date(Date.UTC(2026, 0, 1));
  const revokedEntries = revokedSerials.map((serial) =>
    encodeSequence([encodeInteger(serial), encodeUTCTime(fixedTime)]),
  );
  const tbsCertList = encodeSequence([
    encodeSmallInteger(1),
    SHA256_RSA_ALGO,
    buildName(issuerCn),
    encodeUTCTime(fixedTime),
    ...(revokedEntries.length > 0 ? [encodeSequence(revokedEntries)] : []),
  ]);
  return encodeSequence([tbsCertList, SHA256_RSA_ALGO, encodeBitString(new Uint8Array(32))]);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** A four-object, single-page PDF with a classic xref table. */
export function createMinimalPdf(): Uint8Array {
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
  return ascii(pdf);
}

// ---------------------------------------------------------------------------
// RFC 3161 timestamps
// ---------------------------------------------------------------------------

/** Options for {@link buildMockTimestampResponse}. */
export interface MockTimestampOptions {
  /** messageImprint hashedMessage; 32 zero bytes when absent. */
  hashedMessage?: Uint8Array | undefined;
  /** INTEGER content bytes of a nonce placed after genTime; no nonce when absent. */
  nonce?: Uint8Array | undefined;
  /** messageImprint hashAlgorithm OID; SHA-256 (2.16.840.1.101.3.4.2.1) when absent. */
  hashAlgorithmOid?: string | undefined;
}

/**
 * Build a granted TimeStampResp whose token is a SignedData with no signer,
 * carrying a TSTInfo (SHA-256 imprint unless `hashAlgorithmOid` says
 * otherwise, serial 1, genTime `signingTime`).
 */
export function buildMockTimestampResponse(
  signingTime: Date,
  options: MockTimestampOptions = {},
): Uint8Array {
  const msgImprint = encodeSequence([
    encodeSequence([encodeOID(options.hashAlgorithmOid ?? '2.16.840.1.101.3.4.2.1'), NULL_PARAMS]),
    encodeOctetString(options.hashedMessage ?? new Uint8Array(32)),
  ]);
  const tstChildren: Uint8Array[] = [
    new Uint8Array([0x02, 0x01, 0x01]),
    encodeOID('1.2.3.4.5.6.7'),
    msgImprint,
    new Uint8Array([0x02, 0x01, 0x01]),
    encodeGeneralizedTime(signingTime),
  ];
  if (options.nonce !== undefined) {
    tstChildren.push(encodeRawInteger(options.nonce));
  }
  const tstInfo = encodeSequence(tstChildren);

  const encapContentInfo = encodeSequence([
    encodeOID('1.2.840.113549.1.9.16.1.4'),
    encodeContextTag(0, encodeOctetString(tstInfo)),
  ]);
  const signedData = encodeSequence([
    new Uint8Array([0x02, 0x01, 0x01]),
    new Uint8Array([0x31, 0x00]),
    encapContentInfo,
    new Uint8Array([0x31, 0x00]),
  ]);
  const contentInfo = encodeSequence([
    encodeOID('1.2.840.113549.1.7.2'),
    encodeContextTag(0, signedData),
  ]);
  return encodeSequence([encodeSequence([new Uint8Array([0x02, 0x01, 0x00])]), contentInfo]);
}

/**
 * The nonce INTEGER content of a TimeStampReq (the first INTEGER after
 * messageImprint), or undefined when the request carries none.
 */
export function readRequestNonce(tsReq: Uint8Array): Uint8Array | undefined {
  const req = parseDerTlv(tsReq, 0);
  return req.children.slice(2).find((node) => node.tag === 0x02)?.data;
}

/** The bytes of a fetch request body (ArrayBuffer or typed array). */
export function bodyBytes(body: BodyInit | null | undefined): Uint8Array {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body))
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  throw new Error('fetch body is not binary');
}
