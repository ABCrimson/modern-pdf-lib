# Multi-Party Signing Workflow

This guide walks through a complete multi-party PDF signing workflow: from creating a contract to archiving with Long-Term Validation (LTV) data. Every step uses the `modern-pdf-lib` API and preserves all previous signatures via incremental save.

The workflow needs an unencrypted PDF: `signPdf`, `addCounterSignature` and `embedLtvData` do not encrypt what they append, so for an encrypted file they throw `UnsupportedEncryptionError` (code `unsupported-encryption-path`).

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
  getCertificationLevel,
  getFieldLocks,
  validateSignatureChain,
  detectModifications,
  optimizeIncrementalSave,
} from 'modern-pdf-lib';
```

In this version `signPdf()` writes no DocMDP certification and no `/Lock` dictionary. `setCertificationLevel()` and `addFieldLock()` have no effect: each emits one `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`) per process, and the signature that follows carries no certification level and no locked fields. `getCertificationLevel()` and `getFieldLocks()` read what files from other producers hold. The `reason`, `location` and `contactInfo` options are not written into the signature dictionary either (see the [signature guide](./signatures.md)), so the signatures below set them only where a visible appearance shows them.

You will also need DER-encoded X.509 certificates and PKCS#8 private keys for each signer. These can be loaded from PEM files by stripping headers and base64-decoding.

---

## Step-by-Step Workflow

### 1. Create the Contract

```ts
import { StandardFonts } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage([612, 792]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Service Agreement', { x: 50, y: 750, size: 24, font });
page.drawText('Between Party A and Party B', { x: 50, y: 720, size: 14, font });
page.drawText('Terms and conditions...', { x: 50, y: 680, size: 12, font });

const contractPdf = await doc.save();
```

### 2. Signer A Signs the Contract

The first signer signs the contract with a visible signature:

```ts
const signerAOptions = {
  certificate: signerACert,
  privateKey: signerAKey,
  appearance: {
    rect: [50, 50, 200, 80],
    text: ['Signed by: Alice Smith', 'Role: Authorized Representative'],
  },
};

const signerAPdf = await signPdf(contractPdf, 'SignerA', signerAOptions);
```

This signature is not a certification signature: `signPdf()` has no option that writes a DocMDP level (see [MDP Permission Levels](#mdp-permission-levels)).

### 3. Field Locks

`signPdf()` writes no `/Lock` dictionary, so a signature cannot lock form fields in this version. `addFieldLock()` stores the lock on the sign options and nothing reads it (see [Field Locking](#field-locking)). Fields stay editable after the signature, and `detectModifications()` reports changes made after it.

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
  appearance: {
    rect: [300, 50, 200, 80],
    text: ['Signed by: Bob Jones', 'Role: Client'],
  },
});
```

### 5. Notary Signs

A notary can add a final signature:

```ts
const notarizedPdf = await signPdf(signerBPdf, 'Notary', {
  certificate: notaryCert,
  privateKey: notaryKey,
  appearance: {
    rect: [50, 150, 200, 80],
    text: ['Notarized by: Carol Williams', 'Commission #12345'],
  },
});
```

### 6. Archive with LTV Data

Embed Long-Term Validation data so that the certificates, OCSP responses and CRLs you collected stay in the document. `embedLtvData()` stores the certificates it finds in the signatures, your `extraCertificates`, and the OCSP responses and CRLs you pass; it fetches nothing and does not check that a response or a CRL is authentic or that it covers the signer.

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

The MDP (Modification Detection and Prevention) system of ISO 32000 controls what changes are allowed after a certification signature. `signPdf()` does not write one in this version, so a signature made here carries no level. `setCertificationLevel()` has no effect: it stores the level on the options object, nothing reads it, and it emits one `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`) per process.

The levels, as they appear in files from other producers:

| Level | Constant | Allowed Changes |
|-------|----------|-----------------|
| 1 | `MdpPermission.NoChanges` | No changes allowed at all |
| 2 | `MdpPermission.FormFillAndSign` | Form filling and additional signatures |
| 3 | `MdpPermission.FormFillSignAnnotate` | Annotations, form filling, and signatures |

`detectModifications()` reports a signature added after a certification as an `unknown` violation, so at levels 2 and 3 it returns `isCompliant: false` for it; see [Check MDP Compliance](#check-mdp-compliance).

```ts
// Read the certification level of a PDF that carries a DocMDP signature
const level = getCertificationLevel(certifiedPdfBytes);
// level is an MdpPermission, or undefined when the file has no certification
```

---

## Field Locking

`signPdf()` writes no `/Lock` dictionary in this version. `addFieldLock()` validates its arguments, stores the lock on the options object, and emits one `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`) per process; nothing reads the stored lock, so no field is locked.

To read the field locks of a file that has them:

```ts
const locks = getFieldLocks(signedPdfBytes);
for (const lock of locks) {
  console.log(`Signature "${lock.signatureFieldName}" locks: ${lock.lockedFields.join(', ')}`);
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
  console.log(`  structurally valid: ${cs.isValid}`); // parsed only; the counter-signature is not cryptographically verified
}
```

---

## LTV Archival

Long-Term Validation keeps the validation material with the document, so that a verifier can read it after certificates expire or revocation services go offline.

<details>
<summary>What does LTV embed?</summary>

The Document Security Store (DSS) dictionary is added to the PDF catalog and contains:

- **Certificates**: The certificates found in the signatures, plus any you pass as `extraCertificates`
- **OCSP responses**: The responses you supplied for the certificates
- **CRLs**: The Certificate Revocation Lists you supplied

This data is embedded in the PDF itself. The library does not authenticate it when it reads it back: `verifyOfflineRevocation()` reports a matching embedded answer as `unknown`, not as `good`.

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
  console.log(`${result.fieldName}: ${result.valid ? 'VALID' : 'NOT VALID'}`);
  console.log(`  Signed by: ${result.signedBy}`);
  console.log(`  Integrity: ${result.integrityValid}`);
  console.log(`  Certificate: ${result.certificateValid}`);
  console.log(`  Covers whole file: ${result.coversWholeDocument}`);
}
```

`valid` requires the signature's ByteRange to cover the whole file except its `/Contents` value. Every signature that is followed by a later update (the next signer's signature, a form fill) does not, so for a file signed by `SignerA`, `SignerB` and the notary in turn, before the LTV step, the results are:

| Signature | `integrityValid` | `certificateValid` | `coversWholeDocument` | `valid` |
|-----------|------------------|--------------------|-----------------------|---------|
| `SignerA` (followed by later signatures) | `true` | `true` | `false` | `false` |
| `SignerB` (followed by the notary) | `true` | `true` | `false` | `false` |
| `Notary` (last in the file) | `true` | `true` | `true` | `true` |

`embedLtvData()` appends the Document Security Store as an incremental update after the last signature. After that step the notary signature also reports `coversWholeDocument: false` and `valid: false`, with `integrityValid` and `certificateValid` still `true`.

An earlier signature that reports `valid: false` with `integrityValid: true` is the expected result for a multi-signed file, not a sign of tampering: its own bytes are intact and a later revision exists. Read `integrityValid` and `certificateValid` for each earlier signature and `valid` for the last one. Validating each signature against its own revision is not implemented in this release. `valid` is also not a trust decision: it does not check the signer's certificate chain, see the [verification guide](./verification.md).

### Validate Signature Chain

Ensure all signatures form a valid incremental chain:

```ts
const chainResult = await validateSignatureChain(pdfBytes);
console.log(`Chain valid: ${chainResult.isChainValid}`);
for (const entry of chainResult.signatures) {
  console.log(`  ${entry.fieldName}: ${entry.status === 'valid' ? 'OK' : 'BROKEN'}`);
}
```

`isChainValid` is true only when every entry has status `valid`: each signature's ByteRange is well formed and reaches past the previous signature, and each signature's digest and CMS signature verify over its covered bytes. It does not check the signers' certificates against trust anchors, and it says nothing about bytes after the last signature (check `coversWholeDocument` from `verifySignatures()`). A PDF without signatures gives `isChainValid: true`.

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

A violation of type `unknown` means that an object added or changed after a signed revision carries a signature key (`/Type /Sig`, `/FT /Sig` or `/SubFilter /adbe.pkcs7.detached`). The detector cannot tell a real added signature from a change that hides behind such a key, so it reports `unknown`; for a certified document that makes `isCompliant` false at every certification level, including a signature added at a level that allows signing. `isCompliant` is judged only when the document has a certification level. A report without violations comes from a pattern check over the object text of the revisions; it is not proof that nothing changed.

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

Each signature uses incremental save, so the bytes an earlier signature covers stay as they were: its `integrityValid` and `certificateValid` stay `true`. Its `valid` becomes `false` and `coversWholeDocument` becomes `false`, because the file now has bytes after the signed range. That is how this release reports every non-final signature of a multi-signed file.

If `integrityValid` of an earlier signature is `false`, the covered bytes changed; if `certificateValid` is `false`, the signature does not verify with its embedded certificate. It usually means:

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

// See what actually changed (returns the changed object numbers)
const changedObjectNumbers = findChangedObjects(originalPdf, modifiedPdf);
console.log(`${changedObjectNumbers.length} objects actually changed`);

// Build optimized incremental update from the changed objects.
// Each change carries the object/generation number and its new raw bytes.
const changes = [
  { objectNumber: 12, generationNumber: 0, newContent: updatedObjectBytes },
];
const optimized = optimizeIncrementalSave(originalPdf, changes);
console.log(`Saved ${modifiedPdf.length - optimized.length} bytes`);
```

</details>
