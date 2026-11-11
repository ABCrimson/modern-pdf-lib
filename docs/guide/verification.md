# Signature Verification

This guide covers verifying digital signatures in PDF documents using `modern-pdf-lib`. For creating signatures, see the [Signatures guide](./signatures.md).

## Quick Start

Verify all signatures in a PDF in three lines:

```ts
import { verifySignatures } from 'modern-pdf-lib';

const pdfBytes = new Uint8Array(/* ... */);
const results = await verifySignatures(pdfBytes);
console.log(results.map(r => `${r.fieldName}: ${r.valid ? 'VALID' : 'NOT VALID'}`));
```

`valid` is true only when the digest matches, the signature verifies with the certificate embedded in the signature, and the signature's ByteRange covers the whole file except the `/Contents` value (`coversWholeDocument`). It does not say that the signer is trusted, that the certificate is unrevoked, or when the document was signed: `verifySignatures()` does not look at trust anchors, and a self-signed certificate verifies as `valid` like any other. Trust is a separate check, described in [Certificate Chains](#certificate-chains).

An earlier signature of a file that has later updates (a second signature, a form fill) reports `valid: false`, with `integrityValid` and `certificateValid` unchanged and `coversWholeDocument: false`. Only the last signature of a multi-signed file can be `valid`. See the [multi-party signing guide](./multi-sign.md).

Earlier releases reported more signatures as valid or trusted than they had shown: a signature that left bytes outside its range, a chain that ended in any self-signed root, an OCSP or CRL answer that was never authenticated, and a time the signer wrote itself. See the [security advisories published with 0.40.5](https://github.com/ABCrimson/modern-pdf-lib/security/advisories).

## Understanding Digital Signatures

A PDF digital signature provides two guarantees:

1. **Integrity** -- the document has not been modified since it was signed. The signer computes a cryptographic hash of the PDF bytes covered by the `ByteRange`, and that hash is embedded in the PKCS#7 structure. Verification recomputes the hash and compares it to the embedded value.

2. **Identity** -- the signature was created by the holder of the private key matching the embedded certificate. The signature is verified using the public key from the X.509 certificate in the PKCS#7 structure.

`integrityValid` and `certificateValid` report these two checks. `valid` additionally requires `coversWholeDocument`, so that no byte of the file is left outside the signature. A true `valid` means the covered bytes are unchanged and the signature is mathematically correct for the embedded certificate. It does not mean that the certificate belongs to anyone you trust: that needs a chain checked against trust anchors you chose.

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
3. The root CA must be one of the trust anchors you pass (`trustedCerts`)
4. Each certificate must be within its validity dates, and each certificate above the leaf must be a CA certificate (BasicConstraints) unless it is a self-signed root. Key usage is checked separately with `validateCertificatePolicy()` (see [Certificate Policy](#certificate-policy)).

```ts
import {
  buildCertificateChain,
  validateCertificateChain,
} from 'modern-pdf-lib';

// Build the chain (leaf first, root last)
const { chain, complete } = buildCertificateChain(leafCert, [intermediateCert]);

// Validate the chain against your trusted root CAs (DER-encoded)
const result = await validateCertificateChain(chain, {
  trustedCerts: [rootCaDer],
});
console.log(`Chain valid: ${result.valid}`);
```

`validateCertificateChain()` trusts a self-signed root only when its bytes equal a certificate listed in `trustedCerts`. A chain that ends below the root can be valid when the issuer of its last certificate is a listed certificate that is within its validity period, is a CA certificate or self-signed, and verifies the last certificate's signature. With `trustedCerts` empty or absent no chain is valid, so `result.valid` is `false` even when every signature in the chain verifies; `result.errors` reports it. A certificate in `trustedCerts` that is not self-signed anchors the certificates it signed, not itself. `complete` from `buildCertificateChain()` only reports that a chain was assembled; it is not a trust decision.

`verifySignatures()` and `verifySignatureDetailed()` do not run this check on a signature's certificate. To decide trust for a signature, build the signer's chain and pass it to `validateCertificateChain()` yourself.

## Revocation Checking

Certificates can be revoked before their expiration date. Two protocols exist for checking revocation status:

### OCSP (Online Certificate Status Protocol)

OCSP queries a responder server for the real-time status of a specific certificate. The result status is `good`, `revoked`, or `unknown`. `good` and `revoked` are returned only for an answer that is authenticated: its signature verifies with the issuer certificate, or with a delegated responder certificate that the issuer signed, that carries the OCSP-signing extended key usage and that is within its validity period; it matches the requested certificate; and it is within its `thisUpdate` / `nextUpdate` window. Any other answer is `unknown`, also when the responder claims `revoked`. In that case `unauthenticatedReason` says why the answer was not accepted and, when a response for the requested certificate was found, quotes its claimed status. The responder certificate's own revocation status is not checked. `checkCertificateStatus()` throws a plain `Error` when the HTTP request fails, the responder returns an error status (for example `tryLater`), or the response cannot be parsed.

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
  if (result.status === 'unknown') {
    console.log(result.unauthenticatedReason); // why the answer was not accepted, if it was not
  }
}
```

### CRL (Certificate Revocation List)

CRLs are signed lists of revoked certificate serial numbers published by the CA. They are larger than OCSP responses but can be cached for offline use.

`downloadCrl()` and `isCertificateRevoked()` do not authenticate the CRL: its signature is not verified, and neither its issuer nor its `nextUpdate` is checked. `isCertificateRevoked()` returns `true` when the serial number is listed; `false` means only "not listed in this CRL", never "not revoked". Do not treat `false` as a good status.

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
| Can report `good` or `revoked` | Yes, for an authenticated OCSP answer | No: a matching answer is reported as `unknown` |

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
import { verifySignatureDetailed } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdfBytes = new Uint8Array(await readFile('signed.pdf'));
const rootCa = new Uint8Array(await readFile('root-ca.der'));

// verifySignatureDetailed returns one result per signature in the document
const results = await verifySignatureDetailed(pdfBytes, {
  trustedCerts: [rootCa],
  checkRevocation: true,
});

for (const result of results) {
  console.log(`Valid: ${result.valid}`);
  console.log(`Integrity: ${result.integrityValid}`);
  console.log(`Signature: ${result.cryptoValid}`);
  console.log(`Covers whole file: ${result.coversWholeDocument}`);
  console.log(`Signed by: ${result.signedBy}`);
  console.log(`Signer-claimed time: ${result.signingTime}`);
  console.log(`Revocation: ${result.revocationStatus}`);
  console.log(result.warnings);
}
```

`valid` is `integrityValid` AND `cryptoValid` AND `coversWholeDocument`. It is not a trust decision. `trustedCerts` is not used to decide `valid`; when it is empty a warning says that chain trust was not validated, and `chain` only describes the certificates found in the signature. With `checkRevocation: true` the function makes no network request. It reads an OCSP result from `revocationCache` when you pass one, and otherwise reports `revocationStatus: 'unknown'` with a warning. `crlChecked` is `false`.

The `DetailedVerificationResult` provides:

| Field | Description |
|-------|-------------|
| `valid` | `integrityValid` AND `cryptoValid` AND `coversWholeDocument` |
| `integrityValid` | ByteRange hash matches the signed digest |
| `cryptoValid` | Cryptographic signature verification passed |
| `coversWholeDocument` | The ByteRange covers the whole file except the `/Contents` value. `false` for an earlier signature of a file with later updates |
| `signedBy` | Subject CN of the signing certificate |
| `chain` | Certificate details (CN, issuer, serial, validity); not validated against trust anchors |
| `signingTime` | The time the signer claims (the `signingTime` attribute); not attested by a timestamp authority |
| `timestamp` | `{ time, valid }` built from `signingTime`; `valid` is always `false` because no RFC 3161 token is verified |
| `revocationChecked`, `revocationStatus` | `'good'`, `'revoked'`, `'unknown'` or `'unchecked'` (not requested); see above for where the status comes from |
| `ocspResponse`, `crlChecked` | OCSP details taken from the revocation cache, if any; `crlChecked` is `false` |
| `warnings`, `errors` | Non-fatal findings and fatal findings of the check |

## Offline Verification

For air-gapped environments where no network access is available, use offline revocation checking with embedded data:

```ts
import {
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
} from 'modern-pdf-lib';

// Extract CRL and OCSP data embedded in the PKCS#7 signature
const signatureBytes = new Uint8Array(/* DER-encoded PKCS#7 from the PDF */);
const revocationData = extractEmbeddedRevocationData(signatureBytes);

console.log(`Embedded OCSP responses: ${revocationData.ocsps.length}`);
console.log(`Embedded CRLs: ${revocationData.crls.length}`);

// Check revocation using only embedded data (no network)
const certificateDer = new Uint8Array(/* DER-encoded certificate to check */);
const result = verifyOfflineRevocation(certificateDer, revocationData);

console.log(`Checked: ${result.checked}`);
console.log(`Status: ${result.status}`);   // 'unknown' or 'no-data' in this release
console.log(`Source: ${result.source}`);    // 'ocsp' | 'crl' | 'none'
console.log(result.details);               // what the check found; a matching answer's claimed status is quoted here
```

The embedded answers are not authenticated: `verifyOfflineRevocation()` has no issuer certificate and does not verify their signatures. A matching embedded OCSP response or CRL is therefore reported as `status: 'unknown'` (the claimed status is quoted in `details`), never as `good` or `revoked`. `status: 'no-data'` means nothing was embedded.

The embedded data is useful for:

- Air-gapped or restricted network environments, to read what a signature carries
- Long-Term Validation (LTV) workflows where revocation data must persist with the document
- Inspecting documents years after the original OCSP responders may be offline

Reading the data is not the same as verifying it: until an answer is authenticated, treat the offline result as `unknown`.

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

1. **Verify integrity first** -- Check that the covered bytes have not been modified (`integrityValid`) and that the signature covers the whole file (`coversWholeDocument`). `valid` combines both with the signature check.

2. **Verify the cryptographic signature** -- Ensure the signature was created with the private key matching the embedded certificate.

3. **Validate the certificate policy** -- Check that the certificate has the right key usage flags (digitalSignature, nonRepudiation) and is not expired.

4. **Build and validate the certificate chain** -- Walk the chain from the leaf to a trusted root. Pass your organization's accepted root CAs as `trustedCerts` (a `TrustStore` can hold them: `await store.getAllCertificates()`). Without trust anchors no chain is valid.

5. **Check revocation status** -- Query OCSP to ensure no certificate in the chain has been revoked. Treat `unknown` as "not shown to be good", not as good. A CRL lookup with `isCertificateRevoked()` and offline revocation data do not authenticate their answers.

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
      // Also the case for an earlier signature of a file with later updates:
      // integrityValid can be true while coversWholeDocument is false.
      console.error(
        `Signature ${result.fieldName} is not valid ` +
          `(integrity: ${result.integrityValid}, covers whole file: ${result.coversWholeDocument})`,
      );
      continue;
    }

    console.log(`Signature ${result.fieldName}: digest, signature and coverage verified`);
    console.log('This does not show that the signer is trusted.');

    // Steps 3-5 would use the certificate from the signature
    // for policy validation, chain building against your trust anchors,
    // and revocation checking
  }
}
```
