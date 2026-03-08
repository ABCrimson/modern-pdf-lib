# Multi-Party Signing Workflow

This guide walks through a complete multi-party PDF signing workflow: from creating a contract to archiving with Long-Term Validation (LTV) data. Every step uses the `modern-pdf-lib` API and preserves all previous signatures via incremental save.

---

## Prerequisites

```ts
import {
  createPdf,
  signPdf,
  verifySignatures,
  getSignatures,
  diffSignedContent,
  addCounterSignature,
  embedLtvData,
  hasLtvData,
  setCertificationLevel,
  getCertificationLevel,
  MdpPermission,
  addFieldLock,
  getFieldLocks,
  validateSignatureChain,
  detectModifications,
  optimizeIncrementalSave,
} from 'modern-pdf-lib';
```

You will also need DER-encoded X.509 certificates and PKCS#8 private keys for each signer. These can be loaded from PEM files by stripping headers and base64-decoding.

---

## Step-by-Step Workflow

### 1. Create the Contract

```ts
const doc = createPdf();
const page = doc.addPage([612, 792]);
page.drawText('Service Agreement', { x: 50, y: 750, size: 24 });
page.drawText('Between Party A and Party B', { x: 50, y: 720, size: 14 });
page.drawText('Terms and conditions...', { x: 50, y: 680, size: 12 });

const contractPdf = await doc.save();
```

### 2. Signer A Signs the Contract

The first signer typically certifies the document, setting the MDP (Modification Detection and Prevention) level to control what subsequent signers can do.

```ts
// Certify with MDP level 2 (allow form filling and signing)
const certifiedPdf = setCertificationLevel(contractPdf, MdpPermission.FormFilling);

// Sign the certified document
const signerAPdf = await signPdf(certifiedPdf, 'SignerA', {
  certificate: signerACert,
  privateKey: signerAKey,
  reason: 'Approval of terms',
  location: 'New York, NY',
  appearance: {
    rect: [50, 50, 200, 80],
    text: ['Signed by: Alice Smith', 'Role: Authorized Representative'],
  },
});
```

### 3. Lock Specific Fields (Optional)

After signing, you can lock specific form fields to prevent modification.

```ts
const lockedPdf = addFieldLock(signerAPdf, 'SignerA', {
  action: 'include',
  fields: ['ContractAmount', 'EffectiveDate'],
});
```

### 4. Signer B Counter-Signs

A counter-signature attests that Signer B witnessed Signer A's signature at a specific time.

```ts
const counterSignedPdf = await addCounterSignature(
  signerAPdf,
  0, // counter-sign the first signature (Signer A's)
  {
    certificate: signerBCert,
    privateKey: signerBKey,
    hashAlgorithm: 'SHA-256',
  },
);
```

Alternatively, Signer B can add their own independent signature:

```ts
const signerBPdf = await signPdf(counterSignedPdf, 'SignerB', {
  certificate: signerBCert,
  privateKey: signerBKey,
  reason: 'Acceptance of terms',
  location: 'San Francisco, CA',
  appearance: {
    rect: [300, 50, 200, 80],
    text: ['Signed by: Bob Jones', 'Role: Client'],
  },
});
```

### 5. Notary Certifies

A notary can add a final certification signature:

```ts
const notarizedPdf = await signPdf(signerBPdf, 'Notary', {
  certificate: notaryCert,
  privateKey: notaryKey,
  reason: 'Notarization',
  location: 'County Clerk Office',
  appearance: {
    rect: [50, 150, 200, 80],
    text: ['Notarized by: Carol Williams', 'Commission #12345'],
  },
});
```

### 6. Archive with LTV Data

Embed Long-Term Validation data so signatures can be verified decades later, even if CAs expire or CRLs become unavailable.

```ts
const archivedPdf = await embedLtvData(notarizedPdf, {
  includeOcsp: true,
  includeCrl: true,
  includeCerts: true,
  // Optionally provide pre-fetched validation data
  ocspResponses: [ocspResponseDer],
  crls: [crlDer],
  extraCertificates: [intermediateCaCert, rootCaCert],
});

// Verify LTV data was embedded
console.log('Has LTV data:', hasLtvData(archivedPdf));
```

---

## MDP Permission Levels

The MDP (Modification Detection and Prevention) system controls what changes are allowed after a certification signature.

| Level | Constant | Allowed Changes |
|-------|----------|-----------------|
| 1 | `MdpPermission.NoChanges` | No changes allowed at all |
| 2 | `MdpPermission.FormFilling` | Form filling and additional signatures |
| 3 | `MdpPermission.Annotating` | Annotations, form filling, and signatures |

```ts
// Set certification level before the first signature
const certified = setCertificationLevel(pdfBytes, MdpPermission.FormFilling);

// Read the current certification level
const level = getCertificationLevel(pdfBytes);
// level === MdpPermission.FormFilling
```

---

## Field Locking

Lock form fields after signing to prevent tampering:

```ts
// Lock specific fields
const locked = addFieldLock(signedPdf, 'SignerA', {
  action: 'include',
  fields: ['Amount', 'Date', 'Terms'],
});

// Lock all fields except specified ones
const partialLock = addFieldLock(signedPdf, 'SignerA', {
  action: 'exclude',
  fields: ['Comments'], // only Comments remains editable
});

// Read existing field locks
const locks = getFieldLocks(signedPdf);
for (const lock of locks) {
  console.log(`Signature "${lock.fieldName}" locks: ${lock.fields.join(', ')}`);
}
```

---

## Counter-Signatures

A counter-signature is a cryptographic attestation applied to an existing signature. It proves that a specific signature existed at the time the counter-signature was created.

```ts
// Add a counter-signature to the first signature
const counterSigned = await addCounterSignature(pdfBytes, 0, {
  certificate: witnessCert,
  privateKey: witnessKey,
  hashAlgorithm: 'SHA-256',
});

// List all counter-signatures in the document
import { getCounterSignatures } from 'modern-pdf-lib';

const counterSigs = getCounterSignatures(pdfBytes);
for (const cs of counterSigs) {
  console.log(`Signature #${cs.targetSignatureIndex} counter-signed by ${cs.signerName}`);
  if (cs.signedAt) {
    console.log(`  at: ${cs.signedAt.toISOString()}`);
  }
  console.log(`  valid: ${cs.isValid}`);
}
```

---

## LTV Archival

Long-Term Validation ensures that signatures remain verifiable even after certificates expire or revocation services go offline.

<details>
<summary>What does LTV embed?</summary>

The Document Security Store (DSS) dictionary is added to the PDF catalog and contains:

- **Certificates**: The full certificate chain from signer to root CA
- **OCSP responses**: Proof of certificate validity at signing time
- **CRLs**: Certificate Revocation Lists showing the certificate was not revoked

This data is embedded in the PDF itself, making the document self-contained for verification.

</details>

```ts
// Check if LTV data already exists
if (!hasLtvData(pdfBytes)) {
  const ltvPdf = await embedLtvData(pdfBytes, {
    includeOcsp: true,
    includeCrl: true,
    includeCerts: true,
    extraCertificates: [rootCaCert],
    ocspResponses: [fetchedOcspResponse],
    crls: [fetchedCrl],
  });
}
```

---

## Verification

### Verify All Signatures

```ts
const results = await verifySignatures(pdfBytes);

for (const result of results) {
  console.log(`${result.fieldName}: ${result.valid ? 'VALID' : 'INVALID'}`);
  console.log(`  Signed by: ${result.signedBy}`);
  console.log(`  Integrity: ${result.integrityValid}`);
  console.log(`  Certificate: ${result.certificateValid}`);
}
```

### Validate Signature Chain

Ensure all signatures form a valid incremental chain:

```ts
const chainResult = await validateSignatureChain(pdfBytes);
console.log(`Chain valid: ${chainResult.valid}`);
for (const entry of chainResult.entries) {
  console.log(`  ${entry.fieldName}: ${entry.valid ? 'OK' : 'BROKEN'}`);
}
```

### Detect Modifications

Compare the signed content against the current document:

```ts
const diff = await diffSignedContent(pdfBytes, 0); // diff against first signature
if (diff.hasChanges) {
  for (const change of diff.changes) {
    console.log(`[${change.type}] ${change.description}`);
  }
}
```

### Check MDP Compliance

```ts
const report = await detectModifications(pdfBytes);
if (report.violations.length > 0) {
  console.log('MDP violations detected:');
  for (const v of report.violations) {
    console.log(`  ${v.type}: ${v.description}`);
  }
}
```

---

## Troubleshooting

<details>
<summary>"Signature (N bytes) exceeds placeholder capacity"</summary>

The default signature placeholder is 8192 bytes. If you include large certificate chains or timestamp tokens, you may need a larger placeholder. Use `prepareForSigning()` with a larger `placeholderSize`:

```ts
import { prepareForSigning } from 'modern-pdf-lib';

const { preparedPdf, byteRange } = prepareForSigning(
  pdfBytes,
  'Signature1',
  16384, // 16 KB placeholder
);
```

</details>

<details>
<summary>"Cannot find startxref in PDF"</summary>

The PDF may be corrupted or not a valid PDF file. Ensure the file starts with `%PDF-` and ends with `%%EOF`. If the file was truncated during transfer, re-download it.

</details>

<details>
<summary>Previous signature becomes invalid after adding a new one</summary>

Each signature uses incremental save, so previous signatures should remain valid. If a previous signature becomes invalid, it usually means:

1. The PDF was modified in a way that violates the MDP policy
2. The tool used to add the new signature did not use incremental save
3. The ByteRange of the previous signature was corrupted

Use `diffSignedContent()` to investigate what changed.

</details>

<details>
<summary>Signature shows as "Unknown" signer</summary>

The signer name is extracted from the certificate's Subject Common Name (CN). If the certificate is malformed or uses an unusual encoding, the name extraction may fail. Verify the certificate structure with:

```ts
const sigs = getSignatures(pdfBytes);
for (const sig of sigs) {
  console.log(`${sig.fieldName}: ${sig.signedBy}`);
}
```

</details>

<details>
<summary>LTV data not recognized by Adobe Reader</summary>

Adobe Reader expects the DSS dictionary to be referenced from the PDF catalog (`/DSS N 0 R`). Ensure you are using `embedLtvData()` which handles this automatically. Also verify that the OCSP responses and CRLs are valid DER-encoded data.

</details>

<details>
<summary>Optimizing large incremental saves</summary>

If your signing workflow produces large incremental updates, use the optimizer to strip unchanged objects:

```ts
import { findChangedObjects, optimizeIncrementalSave } from 'modern-pdf-lib';

// See what actually changed
const changed = findChangedObjects(originalPdf, modifiedPdf);
console.log(`${changed.length} objects actually changed`);

// Build optimized incremental update
const optimized = optimizeIncrementalSave(originalPdf, changes);
console.log(`Saved ${modifiedPdf.length - optimized.length} bytes`);
```

</details>
