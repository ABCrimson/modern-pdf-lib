# Signature Verification

This guide covers verifying digital signatures in PDF documents using `modern-pdf-lib`. For creating signatures, see the [Signatures guide](./signatures.md).

## Quick Start

Verify all signatures in a PDF in three lines:

```ts
import { verifySignatures } from 'modern-pdf-lib';

const pdfBytes = new Uint8Array(/* ... */);
const results = await verifySignatures(pdfBytes);
console.log(results.map(r => `${r.fieldName}: ${r.valid ? 'VALID' : 'INVALID'}`));
```

## Understanding Digital Signatures

A PDF digital signature provides two guarantees:

1. **Integrity** -- the document has not been modified since it was signed. The signer computes a cryptographic hash of the PDF bytes covered by the `ByteRange`, and that hash is embedded in the PKCS#7 structure. Verification recomputes the hash and compares it to the embedded value.

2. **Identity** -- the signature was created by the holder of the private key matching the embedded certificate. The signature is verified using the public key from the X.509 certificate in the PKCS#7 structure.

A valid signature means both checks pass: the document bytes are unchanged AND the cryptographic signature is mathematically correct.

## Certificate Chains

Real-world certificates form a chain of trust from the leaf (signer) certificate up to a trusted root CA:

```
  Root CA (self-signed, trusted)
      |
      +-- issues -->  Intermediate CA
                          |
                          +-- issues -->  Leaf Certificate (signer)
```

Each certificate in the chain is signed by the one above it. The root CA is self-signed and must be explicitly trusted. To verify a chain:

1. The leaf certificate's issuer must match the intermediate CA's subject
2. The intermediate CA's issuer must match the root CA's subject
3. The root CA must be in a trust store
4. Each certificate must have valid dates and key usage flags

```ts
import {
  buildCertificateChain,
  validateCertificateChain,
  TrustStore,
} from 'modern-pdf-lib';

// Build a trust store with your root CA
const trustStore = new TrustStore();
await trustStore.addCertificate(rootCaDer);

// Build and validate the chain
const chain = buildCertificateChain(leafCert, [intermediateCert]);
const result = await validateCertificateChain(chain, {
  trustStore,
});
console.log(`Chain valid: ${result.valid}`);
```

## Revocation Checking

Certificates can be revoked before their expiration date. Two protocols exist for checking revocation status:

### OCSP (Online Certificate Status Protocol)

OCSP queries a responder server for the real-time status of a specific certificate. It returns one of three statuses: `good`, `revoked`, or `unknown`.

```ts
import { checkCertificateStatus, extractOcspUrl } from 'modern-pdf-lib';

// Extract the OCSP responder URL from the certificate
const ocspUrl = extractOcspUrl(leafCert);

if (ocspUrl) {
  const result = await checkCertificateStatus(
    leafCert,
    issuerCert,
    ocspUrl,
  );
  console.log(`OCSP status: ${result.status}`); // 'good' | 'revoked' | 'unknown'
}
```

### CRL (Certificate Revocation List)

CRLs are signed lists of revoked certificate serial numbers published by the CA. They are larger than OCSP responses but can be cached for offline use.

```ts
import { downloadCrl, isCertificateRevoked, extractCrlUrls } from 'modern-pdf-lib';

const crlUrls = extractCrlUrls(leafCert);

for (const url of crlUrls) {
  const crl = await downloadCrl(url);
  const revoked = isCertificateRevoked(leafCert, crl);
  console.log(`Revoked: ${revoked}`);
}
```

### Online vs Offline

| Aspect | Online | Offline |
|--------|--------|---------|
| Network required | Yes | No |
| Data freshness | Real-time | As fresh as embedded data |
| Use case | Standard verification | Air-gapped environments, LTV |
| API | `checkCertificateStatus()`, `downloadCrl()` | `verifyOfflineRevocation()` |

## Trust Stores

The `TrustStore` class manages a collection of trusted root CA certificates for custom trust validation:

```ts
import { TrustStore } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

// Create a trust store with your organization's root CAs
const store = new TrustStore();

// Add individual certificates (DER-encoded)
const rootCa = new Uint8Array(await readFile('root-ca.der'));
await store.addCertificate(rootCa);

// Add multiple certificates at once
const intermediateCa = new Uint8Array(await readFile('intermediate-ca.der'));
await store.addCertificates([rootCa, intermediateCa]);

// Check if a certificate is trusted
const trusted = await store.isTrusted(someCert);

// Find the issuer of a certificate
const issuer = await store.findIssuer(leafCert);

// Initialize with certificates in the constructor
const preloaded = new TrustStore({
  certificates: [rootCa, intermediateCa],
});
```

### Trust Store Operations

| Method | Description |
|--------|-------------|
| `addCertificate(cert)` | Add a single trusted certificate |
| `addCertificates(certs)` | Add multiple trusted certificates |
| `removeCertificate(serial)` | Remove a certificate by serial number |
| `isTrusted(cert)` | Check if a certificate is in the store |
| `findIssuer(cert)` | Find the issuer certificate for a given cert |
| `getAllCertificates()` | Get all certificates in the store |
| `size` | Number of certificates in the store |
| `clear()` | Remove all certificates |

## Detailed Verification

For full information about a signature, use `verifySignatureDetailed()`:

```ts
import { verifySignatureDetailed, TrustStore } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdfBytes = new Uint8Array(await readFile('signed.pdf'));
const rootCa = new Uint8Array(await readFile('root-ca.der'));

const trustStore = new TrustStore({ certificates: [rootCa] });

const result = await verifySignatureDetailed(pdfBytes, {
  trustStore,
  checkRevocation: true,
});

console.log(`Integrity: ${result.integrityValid}`);
console.log(`Signature: ${result.signatureValid}`);
console.log(`Signed by: ${result.signerInfo?.commonName}`);
console.log(`Signing date: ${result.signingDate}`);
```

The `DetailedVerificationResult` provides:

| Field | Description |
|-------|-------------|
| `integrityValid` | ByteRange hash matches the signed digest |
| `signatureValid` | Cryptographic signature verification passed |
| `signerInfo` | Certificate details (CN, issuer, serial, validity) |
| `signingDate` | Date from the signed attributes |
| `chainValid` | Certificate chain validates to a trusted root |
| `revocationStatus` | OCSP/CRL check result |

## Offline Verification

For air-gapped environments where no network access is available, use offline revocation checking with embedded data:

```ts
import {
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
} from 'modern-pdf-lib';

// Extract CRL and OCSP data embedded in the PKCS#7 signature
const signatureBytes = /* DER-encoded PKCS#7 from the PDF */;
const revocationData = extractEmbeddedRevocationData(signatureBytes);

console.log(`Embedded OCSP responses: ${revocationData.ocsps.length}`);
console.log(`Embedded CRLs: ${revocationData.crls.length}`);

// Check revocation using only embedded data (no network)
const result = verifyOfflineRevocation(certificateDer, revocationData);

console.log(`Checked: ${result.checked}`);
console.log(`Status: ${result.status}`);   // 'good' | 'revoked' | 'unknown' | 'no-data'
console.log(`Source: ${result.source}`);    // 'ocsp' | 'crl' | 'none'
```

This is essential for:

- Air-gapped or restricted network environments
- Long-Term Validation (LTV) workflows where revocation data must persist with the document
- Verifying documents years after the original OCSP responders may be offline

## Certificate Policy

Validate that a certificate has the correct key usage and policy for document signing:

```ts
import {
  validateCertificatePolicy,
  validateKeyUsage,
  validateExtendedKeyUsage,
  EKU_OIDS,
} from 'modern-pdf-lib';

// Quick policy check
const policy = validateCertificatePolicy(certificateDer, {
  requireDigitalSignature: true,
  requireNonRepudiation: true,
  allowExpired: false,
});

console.log(`Policy valid: ${policy.valid}`);
console.log(`Is CA: ${policy.isCA}`);
console.log(`Key usage valid: ${policy.keyUsage.valid}`);
console.log(`Validity period: ${policy.validityPeriod.notBefore} - ${policy.validityPeriod.notAfter}`);

if (policy.warnings.length > 0) {
  console.log('Warnings:', policy.warnings);
}

// Granular key usage check
const ku = validateKeyUsage(certificateDer, ['digitalSignature', 'nonRepudiation']);
console.log(`Present flags: ${ku.presentFlags}`);
console.log(`Missing flags: ${ku.missingFlags}`);

// Extended key usage check
const eku = validateExtendedKeyUsage(certificateDer, [
  EKU_OIDS.emailProtection,
  EKU_OIDS.adobeAuthenticDocument,
]);
console.log(`EKU valid: ${eku.valid}`);
console.log(`Present OIDs: ${eku.presentOids}`);
```

### Well-Known EKU OIDs

| Constant | OID | Use Case |
|----------|-----|----------|
| `EKU_OIDS.serverAuth` | 1.3.6.1.5.5.7.3.1 | TLS server certificates |
| `EKU_OIDS.clientAuth` | 1.3.6.1.5.5.7.3.2 | TLS client certificates |
| `EKU_OIDS.codeSigning` | 1.3.6.1.5.5.7.3.3 | Code signing |
| `EKU_OIDS.emailProtection` | 1.3.6.1.5.5.7.3.4 | S/MIME email signing |
| `EKU_OIDS.timeStamping` | 1.3.6.1.5.5.7.3.8 | RFC 3161 TSA |
| `EKU_OIDS.ocspSigning` | 1.3.6.1.5.5.7.3.9 | OCSP responder signing |
| `EKU_OIDS.adobeAuthenticDocument` | 1.2.840.113583.1.1.5 | Adobe PDF signing |
| `EKU_OIDS.anyExtendedKeyUsage` | 2.5.29.37.0 | Matches any purpose |

## Best Practices

A recommended verification workflow for production use:

1. **Verify integrity first** -- Check that the document bytes have not been modified. This is the fastest check and should always pass.

2. **Verify the cryptographic signature** -- Ensure the signature was created with the private key matching the embedded certificate.

3. **Validate the certificate policy** -- Check that the certificate has the right key usage flags (digitalSignature, nonRepudiation) and is not expired.

4. **Build and validate the certificate chain** -- Walk the chain from the leaf to a trusted root. Use a `TrustStore` populated with your organization's accepted root CAs.

5. **Check revocation status** -- Query OCSP or check CRLs to ensure no certificate in the chain has been revoked. Use offline revocation data when available.

6. **Log and audit** -- Record all verification results for compliance and audit trails.

```ts
import {
  verifySignatures,
  validateCertificatePolicy,
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
  TrustStore,
} from 'modern-pdf-lib';

async function verifyDocument(pdfBytes: Uint8Array, rootCa: Uint8Array) {
  // Step 1-2: Verify integrity and signature
  const results = await verifySignatures(pdfBytes);

  for (const result of results) {
    if (!result.valid) {
      console.error(`Signature ${result.fieldName} is INVALID`);
      continue;
    }

    console.log(`Signature ${result.fieldName} is cryptographically valid`);

    // Steps 3-5 would use the certificate from the signature
    // for policy validation, chain building, and revocation checking
  }
}
```
