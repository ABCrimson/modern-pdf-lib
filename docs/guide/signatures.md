# Digital Signatures

This guide covers creating and verifying digital signatures in PDF documents using `modern-pdf-lib`.

## Overview

PDF digital signatures use PKCS#7/CMS detached signatures to guarantee document integrity and signer identity. The library supports:

- **Signing** with RSA or ECDSA keys (SHA-256, SHA-384, SHA-512)
- **Visible and invisible** signature appearances
- **RFC 3161 timestamps** from external TSA servers
- **Signature verification** (integrity + cryptographic validation)
- **Multiple signatures** via incremental saves

## Signing a PDF

The high-level `signPdf()` function handles the full workflow: preparing the ByteRange placeholder, hashing the document, building the PKCS#7 signature, and embedding it.

### Invisible Signature

```ts
import { signPdf } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

// Load your DER-encoded certificate and PKCS#8 private key
const certificate = await readFile('signer.crt.der');
const privateKey = await readFile('signer.key.der');
const pdfBytes = await readFile('document.pdf');

const signedPdf = await signPdf(pdfBytes, 'Signature1', {
  certificate,
  privateKey,
  reason: 'Document approval',
  location: 'New York, NY',
  hashAlgorithm: 'SHA-256',
});

await writeFile('document-signed.pdf', signedPdf);
```

### Visible Signature

Add an `appearance` option to render the signature as a visible box on the page:

```ts
const signedPdf = await signPdf(pdfBytes, 'Signature1', {
  certificate,
  privateKey,
  reason: 'Final approval',
  location: 'London, UK',
  appearance: {
    pageIndex: 0,                        // first page
    rect: [50, 50, 200, 80],             // [x, y, width, height] in points
    fontSize: 10,
    borderColor: [0, 0, 0],              // black border
    borderWidth: 1,
    backgroundColor: [0.95, 0.95, 1],    // light blue background
  },
});
```

When `text` is omitted, the library auto-generates lines from the certificate subject CN, reason, location, and current date. You can also supply custom text:

```ts
appearance: {
  rect: [50, 50, 250, 60],
  text: [
    'Approved by: Jane Smith',
    'Department: Legal',
    'Date: 2026-02-28',
  ],
}
```

## Verifying Signatures

Use `verifySignatures()` to check all signatures in a PDF, or `verifySignature()` for a single one.

```ts
import { verifySignatures } from 'modern-pdf-lib';

const results = await verifySignatures(pdfBytes);

for (const result of results) {
  console.log(`Field: ${result.fieldName}`);
  console.log(`Signed by: ${result.signedBy}`);
  console.log(`Integrity valid: ${result.integrityValid}`);
  console.log(`Signature valid: ${result.valid}`);
}
```

Each `SignatureVerificationResult` includes:

| Field | Description |
|---|---|
| `fieldName` | The signature field name |
| `signedBy` | Subject CN from the certificate |
| `valid` | Overall validity (integrity AND signature) |
| `integrityValid` | Whether the ByteRange hash matches |
| `certificateValid` | Whether the cryptographic signature verifies |
| `reason` | Signing reason, if present |
| `signingDate` | Signing date, if present |

### Extracting Signature Info (Without Verification)

Use `getSignatures()` for fast metadata extraction without cryptographic verification:

```ts
import { getSignatures } from 'modern-pdf-lib';

const sigs = getSignatures(pdfBytes);
for (const sig of sigs) {
  console.log(`${sig.fieldName}: signed by ${sig.signedBy}`);
}
```

## Low-Level API

For advanced use cases (custom signature providers, hardware tokens, external signing services), use the low-level ByteRange and PKCS#7 APIs directly.

### Step-by-Step Signing

```ts
import {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  buildPkcs7Signature,
} from 'modern-pdf-lib';

// 1. Prepare the PDF with a signature placeholder
const { preparedPdf, byteRange } = prepareForSigning(
  pdfBytes,
  'Signature1',
  8192,  // placeholder size in bytes
);

// 2. Hash the covered regions
const hash = await computeSignatureHash(
  preparedPdf,
  byteRange.byteRange,
  'SHA-256',
);

// 3. Build the PKCS#7 signature (or use an external signer)
const pkcs7 = await buildPkcs7Signature(hash, {
  signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
  reason: 'Approval',
  signingDate: new Date(),
});

// 4. Embed the signature bytes into the placeholder
const signedPdf = embedSignature(preparedPdf, pkcs7, byteRange);
```

### Using an External Signer

If you need to sign with a hardware token or remote signing service, compute the hash locally and send it externally:

```ts
const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'Sig1', 16384);
const hash = await computeSignatureHash(preparedPdf, byteRange.byteRange);

// Send `hash` to your external signing service
const externalPkcs7 = await yourSigningService.sign(hash);

const signedPdf = embedSignature(preparedPdf, externalPkcs7, byteRange);
```

## RFC 3161 Timestamping

Add a trusted timestamp from a TSA server:

```ts
import { requestTimestamp } from 'modern-pdf-lib';

const timestamp = await requestTimestamp(hash, 'https://tsa.example.com/timestamp');
console.log(`Timestamp: ${timestamp.genTime}`);
```

Or include it automatically during signing:

```ts
const signedPdf = await signPdf(pdfBytes, 'Signature1', {
  certificate,
  privateKey,
  timestampUrl: 'https://freetsa.org/tsr',
});
```

## Key Preparation

The library expects DER-encoded certificates and PKCS#8 private keys. Convert from PEM with OpenSSL:

```bash
# Certificate: PEM → DER
openssl x509 -in cert.pem -outform DER -out cert.der

# Private key: PEM → PKCS#8 DER
openssl pkcs8 -topk8 -inform PEM -outform DER \
  -in key.pem -out key.der -nocrypt

# Generate a self-signed test certificate + key
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=Test Signer"
openssl x509 -in cert.pem -outform DER -out cert.der
openssl pkcs8 -topk8 -inform PEM -outform DER \
  -in key.pem -out key.der -nocrypt
```

## Limitations

- **Certificate chain validation** is not performed — Web Crypto does not expose chain/trust-store APIs. Only the mathematical signature against the embedded certificate is verified.
- **CRL/OCSP revocation** checking is not supported.
- **LTV (Long-Term Validation)** embedding is not yet implemented.
- Supported key types: RSA (PKCS#1 v1.5), ECDSA (P-256, P-384, P-521).
