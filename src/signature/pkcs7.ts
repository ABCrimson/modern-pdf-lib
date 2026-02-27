/**
 * @module signature/pkcs7
 *
 * PKCS#7 / CMS SignedData structure builder for PDF digital signatures.
 *
 * Builds a minimal but valid PKCS#7 SignedData structure using pure
 * TypeScript ASN.1 DER encoding.  Uses the Web Crypto API for
 * RSASSA-PKCS1-v1_5 or ECDSA signing.
 *
 * Structure overview:
 * ```
 * ContentInfo {
 *   contentType: signedData (1.2.840.113549.1.7.2)
 *   content: SignedData {
 *     version: 1
 *     digestAlgorithms: { SHA-256 }
 *     encapContentInfo: { data (1.2.840.113549.1.7.1) }
 *     certificates: [0] IMPLICIT { certificate }
 *     signerInfos: {
 *       SignerInfo {
 *         version: 1
 *         issuerAndSerialNumber
 *         digestAlgorithm: SHA-256
 *         signedAttrs: { contentType, signingTime, messageDigest }
 *         signatureAlgorithm
 *         signature
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * References:
 * - RFC 5652 (Cryptographic Message Syntax)
 * - RFC 3161 (Internet X.509 PKI Time-Stamp Protocol)
 * - PKCS#7 / CMS SignedData
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Information needed to sign a hash.
 */
export interface SignerInfo {
  /** DER-encoded X.509 certificate. */
  certificate: Uint8Array;
  /** PKCS#8 DER-encoded private key. */
  privateKey: Uint8Array;
  /** Hash algorithm. */
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

/**
 * Options for building a signature.
 */
export interface SignatureOptions {
  signerInfo: SignerInfo;
  reason?: string | undefined;
  location?: string | undefined;
  contactInfo?: string | undefined;
  signingDate?: Date | undefined;
}

// ---------------------------------------------------------------------------
// Well-known OIDs
// ---------------------------------------------------------------------------

/** OID constants for ASN.1 structures. */
const OID = {
  // PKCS#7 / CMS content types
  signedData: '1.2.840.113549.1.7.2',
  data: '1.2.840.113549.1.7.1',

  // Hash algorithms
  sha256: '2.16.840.1.101.3.4.2.1',
  sha384: '2.16.840.1.101.3.4.2.2',
  sha512: '2.16.840.1.101.3.4.2.3',

  // Signature algorithms
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha256WithRSA: '1.2.840.113549.1.1.11',
  sha384WithRSA: '1.2.840.113549.1.1.12',
  sha512WithRSA: '1.2.840.113549.1.1.13',
  ecPublicKey: '1.2.840.10045.2.1',
  ecdsaWithSHA256: '1.2.840.10045.4.3.2',
  ecdsaWithSHA384: '1.2.840.10045.4.3.3',
  ecdsaWithSHA512: '1.2.840.10045.4.3.4',

  // PKCS#9 authenticated attributes
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
} as const;

/** Map hash algorithm name to OID. */
const HASH_OID_MAP: Record<string, string> = {
  'SHA-256': OID.sha256,
  'SHA-384': OID.sha384,
  'SHA-512': OID.sha512,
};

// ---------------------------------------------------------------------------
// ASN.1 DER encoding primitives
// ---------------------------------------------------------------------------

/** ASN.1 DER tag constants. */
const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

/**
 * Encode the length field of a DER TLV (Tag-Length-Value).
 *
 * - Lengths 0–127 are encoded as a single byte.
 * - Lengths >= 128 use the long form: first byte has bit 7 set and
 *   the lower 7 bits give the number of length bytes that follow.
 */
export function encodeLength(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }
  if (length < 0x100) {
    return new Uint8Array([0x81, length]);
  }
  if (length < 0x10000) {
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
  }
  if (length < 0x1000000) {
    return new Uint8Array([
      0x83,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ]);
  }
  return new Uint8Array([
    0x84,
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
  ]);
}

/**
 * Encode a DER TLV (Tag-Length-Value) triplet.
 */
function encodeTlv(tag: number, value: Uint8Array): Uint8Array {
  const len = encodeLength(value.length);
  const result = new Uint8Array(1 + len.length + value.length);
  result[0] = tag;
  result.set(len, 1);
  result.set(value, 1 + len.length);
  return result;
}

/**
 * Concatenate multiple Uint8Arrays.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode a SEQUENCE containing the given DER-encoded contents.
 */
export function encodeSequence(contents: Uint8Array[]): Uint8Array {
  return encodeTlv(TAG.SEQUENCE, concat(...contents));
}

/**
 * Encode a SET containing the given DER-encoded contents.
 */
export function encodeSet(contents: Uint8Array[]): Uint8Array {
  return encodeTlv(TAG.SET, concat(...contents));
}

/**
 * Encode an OID from dotted-decimal string (e.g. "1.2.840.113549.1.7.2").
 */
export function encodeOID(oid: string): Uint8Array {
  const parts = oid.split('.').map(Number);
  if (parts.length < 2) {
    throw new Error(`Invalid OID: ${oid}`);
  }

  // First two components are encoded as: first * 40 + second
  const encodedParts: number[] = [];
  encodedParts.push(parts[0]! * 40 + parts[1]!);

  // Remaining components use variable-length base-128 encoding
  for (let i = 2; i < parts.length; i++) {
    let value = parts[i]!;
    if (value < 128) {
      encodedParts.push(value);
    } else {
      const bytes: number[] = [];
      bytes.push(value & 0x7f);
      value >>= 7;
      while (value > 0) {
        bytes.push(0x80 | (value & 0x7f));
        value >>= 7;
      }
      bytes.reverse();
      encodedParts.push(...bytes);
    }
  }

  return encodeTlv(TAG.OID, new Uint8Array(encodedParts));
}

/**
 * Encode an OCTET STRING.
 */
export function encodeOctetString(data: Uint8Array): Uint8Array {
  return encodeTlv(TAG.OCTET_STRING, data);
}

/**
 * Encode an INTEGER.
 *
 * DER integers are signed; a leading 0x00 byte is added if the
 * high bit of the first byte is set (to indicate a positive value).
 */
export function encodeInteger(data: Uint8Array): Uint8Array {
  // Remove leading zero bytes (but keep at least one byte)
  let start = 0;
  while (start < data.length - 1 && data[start] === 0) {
    start++;
  }
  const trimmed = data.subarray(start);

  // Add a leading 0x00 if the high bit is set
  if (trimmed[0]! & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded[0] = 0;
    padded.set(trimmed, 1);
    return encodeTlv(TAG.INTEGER, padded);
  }

  return encodeTlv(TAG.INTEGER, trimmed);
}

/**
 * Encode a small non-negative integer value.
 */
function encodeIntegerValue(value: number): Uint8Array {
  if (value < 0x80) {
    return encodeTlv(TAG.INTEGER, new Uint8Array([value]));
  }
  if (value < 0x8000) {
    return encodeTlv(TAG.INTEGER, new Uint8Array([(value >> 8) & 0xff, value & 0xff]));
  }
  return encodeTlv(TAG.INTEGER, new Uint8Array([
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]));
}

/**
 * Encode a UTF8String.
 */
export function encodeUtf8String(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encodeTlv(TAG.UTF8_STRING, encoder.encode(str));
}

/**
 * Encode a PrintableString.
 */
export function encodePrintableString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encodeTlv(TAG.PRINTABLE_STRING, encoder.encode(str));
}

/**
 * Encode a UTCTime from a Date.
 *
 * Format: YYMMDDHHmmSSZ
 */
export function encodeUTCTime(date: Date): Uint8Array {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = pad(date.getUTCFullYear() % 100);
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const str = `${year}${month}${day}${hours}${minutes}${seconds}Z`;
  const encoder = new TextEncoder();
  return encodeTlv(TAG.UTC_TIME, encoder.encode(str));
}

/**
 * Encode a context-specific tagged value (implicit or explicit).
 *
 * For PKCS#7:
 * - [0] is used for content in ContentInfo (explicit, constructed)
 * - [0] IMPLICIT is used for certificates in SignedData
 * - [0] IMPLICIT is used for signed attributes in SignerInfo
 */
export function encodeContextTag(tag: number, contents: Uint8Array): Uint8Array {
  // Context-specific, constructed
  const tagByte = 0xa0 | tag;
  const len = encodeLength(contents.length);
  const result = new Uint8Array(1 + len.length + contents.length);
  result[0] = tagByte;
  result.set(len, 1);
  result.set(contents, 1 + len.length);
  return result;
}

/**
 * Encode an AlgorithmIdentifier SEQUENCE for a hash algorithm.
 *
 * AlgorithmIdentifier ::= SEQUENCE {
 *   algorithm  OID,
 *   parameters ANY DEFINED BY algorithm OPTIONAL
 * }
 */
function encodeDigestAlgorithm(hashAlgo: string): Uint8Array {
  const oid = HASH_OID_MAP[hashAlgo];
  if (!oid) {
    throw new Error(`Unsupported hash algorithm: ${hashAlgo}`);
  }
  // SHA-2 algorithms have NULL parameters
  return encodeSequence([encodeOID(oid), encodeTlv(TAG.NULL, new Uint8Array(0))]);
}

/**
 * Encode an AlgorithmIdentifier for a signature algorithm.
 */
function encodeSignatureAlgorithm(keyAlgo: string, hashAlgo: string): Uint8Array {
  let oid: string;

  if (keyAlgo === 'RSA' || keyAlgo === 'RSASSA-PKCS1-v1_5') {
    switch (hashAlgo) {
      case 'SHA-256': oid = OID.sha256WithRSA; break;
      case 'SHA-384': oid = OID.sha384WithRSA; break;
      case 'SHA-512': oid = OID.sha512WithRSA; break;
      default: throw new Error(`Unsupported hash for RSA: ${hashAlgo}`);
    }
    return encodeSequence([encodeOID(oid), encodeTlv(TAG.NULL, new Uint8Array(0))]);
  }

  if (keyAlgo === 'EC' || keyAlgo === 'ECDSA') {
    switch (hashAlgo) {
      case 'SHA-256': oid = OID.ecdsaWithSHA256; break;
      case 'SHA-384': oid = OID.ecdsaWithSHA384; break;
      case 'SHA-512': oid = OID.ecdsaWithSHA512; break;
      default: throw new Error(`Unsupported hash for ECDSA: ${hashAlgo}`);
    }
    return encodeSequence([encodeOID(oid)]);
  }

  throw new Error(`Unsupported key algorithm: ${keyAlgo}`);
}

// ---------------------------------------------------------------------------
// X.509 Certificate parsing (minimal)
// ---------------------------------------------------------------------------

/**
 * Minimal ASN.1 DER parser result.
 */
interface Asn1Node {
  tag: number;
  constructed: boolean;
  data: Uint8Array;
  children: Asn1Node[];
  offset: number;
  headerLength: number;
  totalLength: number;
}

/**
 * Parse a single DER TLV from a byte array at the given offset.
 */
function parseDerTlv(data: Uint8Array, offset: number): Asn1Node {
  if (offset >= data.length) {
    throw new Error('Unexpected end of DER data');
  }

  const tag = data[offset]!;
  const constructed = !!(tag & 0x20);
  let pos = offset + 1;

  // Parse length
  let length: number;
  const firstLenByte = data[pos]!;
  pos++;

  if (firstLenByte < 0x80) {
    length = firstLenByte;
  } else {
    const numLenBytes = firstLenByte & 0x7f;
    length = 0;
    for (let i = 0; i < numLenBytes; i++) {
      length = (length << 8) | data[pos]!;
      pos++;
    }
  }

  const headerLength = pos - offset;
  const nodeData = data.subarray(pos, pos + length);

  // Parse children if constructed
  const children: Asn1Node[] = [];
  if (constructed) {
    let childOffset = 0;
    while (childOffset < nodeData.length) {
      const child = parseDerTlv(nodeData, childOffset);
      children.push(child);
      childOffset += child.totalLength;
    }
  }

  return {
    tag,
    constructed,
    data: nodeData,
    children,
    offset,
    headerLength,
    totalLength: headerLength + length,
  };
}

/**
 * Extract the issuer and serial number from a DER-encoded X.509 certificate.
 *
 * Certificate ::= SEQUENCE {
 *   tbsCertificate TBSCertificate SEQUENCE {
 *     version [0] EXPLICIT INTEGER { v3(2) },
 *     serialNumber INTEGER,
 *     signature AlgorithmIdentifier,
 *     issuer Name,
 *     ...
 *   }
 *   ...
 * }
 */
function extractIssuerAndSerial(certDer: Uint8Array): {
  issuerDer: Uint8Array;
  serialDer: Uint8Array;
  subjectCN: string;
} {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  // Check if first child is the version tag [0]
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1; // Skip the version
  }

  const serialNode = tbsCert.children[idx]!;
  const serialDer = certDer.subarray(
    serialNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset),
    serialNode.offset + serialNode.totalLength + (tbsCert.data.byteOffset - certDer.byteOffset),
  );

  // signature AlgorithmIdentifier is at idx+1
  // issuer Name is at idx+2
  const issuerNode = tbsCert.children[idx + 2]!;
  const issuerStart = issuerNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  const issuerDer = certDer.subarray(
    issuerStart,
    issuerStart + issuerNode.totalLength,
  );

  // subject Name is at idx+4
  const subjectNode = tbsCert.children[idx + 4]!;
  const subjectCN = extractCommonName(subjectNode);

  return { issuerDer, serialDer, subjectCN };
}

/**
 * Extract the Subject Public Key Info from a DER-encoded X.509 certificate.
 */
function extractSubjectPublicKeyInfo(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }

  // subjectPublicKeyInfo is at idx+5
  const spkiNode = tbsCert.children[idx + 5]!;
  const spkiStart = spkiNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(spkiStart, spkiStart + spkiNode.totalLength);
}

/**
 * Detect the key algorithm from a certificate's SubjectPublicKeyInfo.
 */
function detectKeyAlgorithm(certDer: Uint8Array): 'RSA' | 'EC' {
  const spki = extractSubjectPublicKeyInfo(certDer);
  const spkiNode = parseDerTlv(spki, 0);
  const algorithmSeq = spkiNode.children[0]!;
  const oidNode = algorithmSeq.children[0]!;

  // Decode the OID bytes to dotted string
  const oidStr = decodeOidBytes(oidNode.data);

  if (oidStr === OID.rsaEncryption) return 'RSA';
  if (oidStr === OID.ecPublicKey) return 'EC';

  // Default to RSA for unknown algorithms
  return 'RSA';
}

/**
 * Decode OID bytes (without the tag and length) to dotted-decimal string.
 */
function decodeOidBytes(data: Uint8Array): string {
  if (data.length === 0) return '';

  const parts: number[] = [];
  // First byte encodes first two components
  parts.push(Math.floor(data[0]! / 40));
  parts.push(data[0]! % 40);

  let value = 0;
  for (let i = 1; i < data.length; i++) {
    const byte = data[i]!;
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }

  return parts.join('.');
}

/**
 * Extract Common Name (CN) from an ASN.1 Name (SEQUENCE of SETs of
 * AttributeTypeAndValue).
 */
function extractCommonName(nameNode: Asn1Node): string {
  const textDecoder = new TextDecoder('utf-8');
  // OID for CN: 2.5.4.3 = 55 04 03
  const cnOidBytes = [0x55, 0x04, 0x03];

  for (const rdnSet of nameNode.children) {
    for (const atv of rdnSet.children) {
      const oid = atv.children[0]!;
      if (
        oid.data.length === cnOidBytes.length &&
        oid.data[0] === cnOidBytes[0] &&
        oid.data[1] === cnOidBytes[1] &&
        oid.data[2] === cnOidBytes[2]
      ) {
        const value = atv.children[1]!;
        return textDecoder.decode(value.data);
      }
    }
  }

  return 'Unknown';
}

/**
 * Detect the named curve from a certificate's SubjectPublicKeyInfo.
 * Returns the Web Crypto named curve string.
 */
function detectNamedCurve(certDer: Uint8Array): string {
  const spki = extractSubjectPublicKeyInfo(certDer);
  const spkiNode = parseDerTlv(spki, 0);
  const algorithmSeq = spkiNode.children[0]!;

  if (algorithmSeq.children.length < 2) return 'P-256';

  const curveOidNode = algorithmSeq.children[1]!;
  if (curveOidNode.tag !== TAG.OID) return 'P-256';

  const curveOid = decodeOidBytes(curveOidNode.data);

  // Map well-known curve OIDs to Web Crypto names
  switch (curveOid) {
    case '1.2.840.10045.3.1.7': return 'P-256';
    case '1.3.132.0.34': return 'P-384';
    case '1.3.132.0.35': return 'P-521';
    default: return 'P-256';
  }
}

// ---------------------------------------------------------------------------
// Web Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a Uint8Array backed by a plain ArrayBuffer.
 */
function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

/**
 * Get the Web Crypto subtle interface.
 */
function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is not available. ' +
      'Requires Node.js 18+, a modern browser, Deno, or Bun.',
    );
  }
  return subtle;
}

/**
 * Import a PKCS#8 private key for signing.
 */
async function importPrivateKey(
  pkcs8Der: Uint8Array,
  keyAlgorithm: 'RSA' | 'EC',
  hashAlgorithm: string,
  namedCurve?: string,
): Promise<CryptoKey> {
  const subtle = getSubtle();

  let algorithm: RsaHashedImportParams | EcKeyImportParams;
  if (keyAlgorithm === 'RSA') {
    algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: hashAlgorithm,
    };
  } else {
    algorithm = {
      name: 'ECDSA',
      namedCurve: namedCurve ?? 'P-256',
    };
  }

  return subtle.importKey(
    'pkcs8',
    toBuffer(pkcs8Der),
    algorithm,
    false,
    ['sign'],
  );
}

/**
 * Sign data using the imported private key.
 */
async function signData(
  key: CryptoKey,
  data: Uint8Array,
  keyAlgorithm: 'RSA' | 'EC',
  hashAlgorithm: string,
): Promise<Uint8Array> {
  const subtle = getSubtle();

  let algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  if (keyAlgorithm === 'RSA') {
    algorithm = { name: 'RSASSA-PKCS1-v1_5' };
  } else {
    algorithm = { name: 'ECDSA', hash: hashAlgorithm };
  }

  const signature = await subtle.sign(algorithm, key, toBuffer(data));
  return new Uint8Array(signature);
}

// ---------------------------------------------------------------------------
// PKCS#7 SignedData builder
// ---------------------------------------------------------------------------

/**
 * Build a PKCS#7 (CMS) SignedData structure for a PDF signature.
 *
 * Takes a pre-computed hash of the PDF content (excluding the
 * /Contents placeholder) and produces a DER-encoded PKCS#7 blob
 * that can be embedded in the PDF's /Contents field.
 *
 * @param dataHash  The hash of the PDF bytes covered by ByteRange.
 * @param options   Signing options (certificate, key, etc.).
 * @returns         DER-encoded PKCS#7 SignedData.
 */
export async function buildPkcs7Signature(
  dataHash: Uint8Array,
  options: SignatureOptions,
): Promise<Uint8Array> {
  const { signerInfo: signerInfoOpts } = options;
  const hashAlgorithm = signerInfoOpts.hashAlgorithm;

  // Detect key type from certificate
  const keyAlgo = detectKeyAlgorithm(signerInfoOpts.certificate);
  const namedCurve = keyAlgo === 'EC'
    ? detectNamedCurve(signerInfoOpts.certificate)
    : undefined;

  // Extract issuer and serial from certificate
  const { issuerDer, serialDer } = extractIssuerAndSerial(
    signerInfoOpts.certificate,
  );

  // Import private key
  const privateKey = await importPrivateKey(
    signerInfoOpts.privateKey,
    keyAlgo,
    hashAlgorithm,
    namedCurve,
  );

  // Build signed attributes
  const signingTime = options.signingDate ?? new Date();
  const signedAttrs = buildSignedAttributes(dataHash, hashAlgorithm, signingTime);

  // The signed attributes must be hashed as a SET when computing
  // the signature, but embedded as [0] IMPLICIT in the SignerInfo
  const signedAttrsForHash = encodeSet(signedAttrs);

  // Hash the signed attributes
  const subtle = getSubtle();
  const signedAttrsHash = new Uint8Array(
    await subtle.digest(hashAlgorithm, toBuffer(signedAttrsForHash)),
  );

  // Sign the signed attributes hash (actually, sign the raw bytes
  // because Web Crypto does the hashing internally for RSA PKCS1)
  const signatureValue = await signData(
    privateKey,
    signedAttrsForHash,
    keyAlgo,
    hashAlgorithm,
  );

  // Convert ECDSA signature from IEEE P1363 to DER format if needed
  const finalSignature = keyAlgo === 'EC'
    ? convertEcdsaToDer(signatureValue)
    : signatureValue;

  // Build the SignerInfo
  const signerInfoValue = buildSignerInfo(
    issuerDer,
    serialDer,
    hashAlgorithm,
    keyAlgo,
    signedAttrs,
    finalSignature,
  );

  // Build the SignedData
  const signedData = buildSignedData(
    hashAlgorithm,
    signerInfoOpts.certificate,
    signerInfoValue,
  );

  // Wrap in ContentInfo
  const contentInfo = encodeSequence([
    encodeOID(OID.signedData),
    encodeContextTag(0, signedData),
  ]);

  return contentInfo;
}

/**
 * Build the authenticated attributes for the signer.
 *
 * Required attributes:
 * 1. contentType (data)
 * 2. signingTime
 * 3. messageDigest (the hash of the PDF content)
 */
function buildSignedAttributes(
  dataHash: Uint8Array,
  _hashAlgorithm: string,
  signingTime: Date,
): Uint8Array[] {
  // Attribute: contentType = data
  const contentTypeAttr = encodeSequence([
    encodeOID(OID.contentType),
    encodeSet([encodeOID(OID.data)]),
  ]);

  // Attribute: signingTime
  const signingTimeAttr = encodeSequence([
    encodeOID(OID.signingTime),
    encodeSet([encodeUTCTime(signingTime)]),
  ]);

  // Attribute: messageDigest
  const messageDigestAttr = encodeSequence([
    encodeOID(OID.messageDigest),
    encodeSet([encodeOctetString(dataHash)]),
  ]);

  return [contentTypeAttr, signingTimeAttr, messageDigestAttr];
}

/**
 * Build a SignerInfo SEQUENCE.
 */
function buildSignerInfo(
  issuerDer: Uint8Array,
  serialDer: Uint8Array,
  hashAlgorithm: string,
  keyAlgorithm: 'RSA' | 'EC',
  signedAttrs: Uint8Array[],
  signatureValue: Uint8Array,
): Uint8Array {
  // version INTEGER (1 for issuerAndSerialNumber)
  const version = encodeIntegerValue(1);

  // issuerAndSerialNumber SEQUENCE
  const issuerAndSerial = encodeSequence([issuerDer, serialDer]);

  // digestAlgorithm AlgorithmIdentifier
  const digestAlgo = encodeDigestAlgorithm(hashAlgorithm);

  // signedAttrs [0] IMPLICIT SET OF Attribute
  const signedAttrsEncoded = encodeContextTag(0, concat(...signedAttrs));

  // signatureAlgorithm AlgorithmIdentifier
  const sigAlgo = encodeSignatureAlgorithm(keyAlgorithm, hashAlgorithm);

  // signature OCTET STRING
  const sigOctetStr = encodeOctetString(signatureValue);

  return encodeSequence([
    version,
    issuerAndSerial,
    digestAlgo,
    signedAttrsEncoded,
    sigAlgo,
    sigOctetStr,
  ]);
}

/**
 * Build the SignedData SEQUENCE.
 */
function buildSignedData(
  hashAlgorithm: string,
  certificate: Uint8Array,
  signerInfo: Uint8Array,
): Uint8Array {
  // version INTEGER (1)
  const version = encodeIntegerValue(1);

  // digestAlgorithms SET OF AlgorithmIdentifier
  const digestAlgorithms = encodeSet([encodeDigestAlgorithm(hashAlgorithm)]);

  // encapContentInfo SEQUENCE { contentType OID }
  // For detached signatures, we include the content type but no content
  const encapContentInfo = encodeSequence([
    encodeOID(OID.data),
  ]);

  // certificates [0] IMPLICIT SET OF Certificate
  const certificates = encodeContextTag(0, certificate);

  // signerInfos SET OF SignerInfo
  const signerInfos = encodeSet([signerInfo]);

  return encodeSequence([
    version,
    digestAlgorithms,
    encapContentInfo,
    certificates,
    signerInfos,
  ]);
}

/**
 * Convert an ECDSA signature from IEEE P1363 format (r || s, fixed-length
 * concatenation) to DER format (SEQUENCE { INTEGER r, INTEGER s }).
 *
 * Web Crypto returns P1363 format; PKCS#7 expects DER.
 */
function convertEcdsaToDer(p1363Sig: Uint8Array): Uint8Array {
  const halfLen = p1363Sig.length / 2;
  const r = p1363Sig.subarray(0, halfLen);
  const s = p1363Sig.subarray(halfLen);

  return encodeSequence([
    encodeInteger(r),
    encodeInteger(s),
  ]);
}

// ---------------------------------------------------------------------------
// Public re-exports of parsing utilities (for verification)
// ---------------------------------------------------------------------------

export { parseDerTlv, extractIssuerAndSerial, extractSubjectPublicKeyInfo };
export { detectKeyAlgorithm, detectNamedCurve, extractCommonName };
export { decodeOidBytes, toBuffer, getSubtle };
export type { Asn1Node };
