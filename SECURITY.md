# Security Policy

modern-pdf-lib parses, decrypts, and renders **untrusted binary input**. We take
reports against that surface seriously and will work with you on a coordinated
disclosure.

---

## Supported Versions

Only the latest minor line receives security fixes. There are no long-term
support branches while the project is pre-1.0.

| Version | Supported |
|---|---|
| 0.40.x | :white_check_mark: |
| < 0.40.0 | :x: |

If you are on an older release, upgrade before filing — the issue may already be
fixed. See [CHANGELOG.md](./CHANGELOG.md) and [VERSIONING.md](./VERSIONING.md).

---

## Fixed in 0.40.5

0.40.5 closes four classes of defect: form-script evaluation, redaction that
left text in the file, signature results that were too trusting, and
encryption dropped or doubled on save.
[See the security advisories published with 0.40.5](https://github.com/ABCrimson/modern-pdf-lib/security/advisories).

- **Form scripts.** The library does not evaluate PDF JavaScript.
  `createSandbox().execute()` throws `ScriptExecutionDisabledError` (code
  `script-execution-disabled`) without reading the script.
- **Redaction.** Redaction by removal is not available in this release.
  `redactRegions`, `applyRedactions`, `applyRedaction` and
  `PdfDocument.applyRedactions()` throw `RedactionIncompleteError` (code
  `redaction-incomplete`, reason `redaction-unavailable`) and change nothing.
  `verifyRedactions` reports the text it finds in a region; its report's
  `clean` is always `false`, because it cannot prove a region free of text.
- **Signatures.** `valid` requires the signed byte range to cover the whole
  file except `/Contents` (`coversWholeDocument`). A signature that a later
  update of the file follows, such as every signature but the last of a
  multi-signed file, therefore reports `valid: false`; its `integrityValid`
  still reports whether its own bytes match. A certificate chain is
  anchored only by a certificate listed in `trustedCerts`; with no
  `trustedCerts`, no chain is valid. An OCSP answer counts only when it is signed by the issuer
  or by a delegated responder, matches the certificate and is current; any
  other OCSP answer, and every embedded OCSP or CRL answer read offline,
  gives the status `unknown`. `downloadCrl` and `isCertificateRevoked` do not
  authenticate a CRL. A signer-claimed signing time is reported as
  `signingTime` and is never treated as a verified timestamp.
  `validateSignatureChain` reports `isChainValid: true` only when every
  signature's digest and CMS signature verify, and `detectModifications`
  reports an object that carries a signature key after a signed revision as
  an `unknown` violation. `requestTimestamp` and `parseTimestampResponse`
  throw `TimestampVerificationError` (code `timestamp-unverified`) when the
  TSTInfo in the response cannot be parsed or its message imprint or nonce
  does not match the request (for `parseTimestampResponse`, the `expected`
  values passed to it). A malformed response, an error status from the
  timestamp authority or a response without a token throws a plain `Error`.
- **Encryption on save.** For an encrypted document, `saveAsStream()`, a
  save with an `objectStreamThreshold` other than `Infinity` (the default)
  and `saveDocumentIncremental()` throw `UnsupportedEncryptionError` (code
  `unsupported-encryption-path`) instead of writing unencrypted objects, and
  a second `save()` no longer encrypts the streams twice. The functions that
  append an incremental update to PDF bytes (`signPdf`, `prepareForSigning`,
  `addCounterSignature`, `embedLtvData`, `saveIncremental`,
  `saveIncrementalWithSignaturePreservation`, `optimizeIncrementalSave` and
  `appendIncrementalUpdate`) throw the same error for an encrypted file, instead of
  appending unencrypted objects and a trailer without `/Encrypt`. `linearizePdf` throws it for an encrypted file too, and `delinearizePdf` does for a linearized file that has `/Encrypt`: their output would have no `/Encrypt` entry. `flattenTransparency`, `stripProhibitedFeatures`, `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX` throw it for an encrypted file too. For the sixteen functions named here that take PDF bytes (all of them except `saveAsStream()`), a file counts as encrypted when its bytes contain the name `/Encrypt` anywhere, whatever follows it; a name written with `#` escapes, such as `/Encr#79pt`, counts, and `/EncryptMetadata` and `/Encrypt2` do not, except in `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX`, which also refuse any file whose text contains `/Encrypt`, so `/EncryptMetadata` and `/Encrypt2` as well. An unencrypted file that holds the name `/Encrypt` anywhere outside a compressed stream, for example inside an uncompressed content stream or as text that looks like a name, is refused as well. A document
  loaded from an encrypted file is not covered by the guards on
  `saveAsStream()` and `objectStreamThreshold`: its `isEncrypted()` returns
  `false`, and `save()` writes it without encryption.

---

## Reporting a Vulnerability

> [!CAUTION]
> **Do not open a public GitHub issue for a security vulnerability.** Use the
> private channel below.

| Channel | How |
|---|---|
| GitHub Security Advisory | [Open a private advisory](https://github.com/ABCrimson/modern-pdf-lib/security/advisories/new) |

### What to include

- A description of the vulnerability and the class of issue.
- Steps to reproduce, or a proof-of-concept (a minimal malicious PDF is ideal).
- The affected version(s) and the runtime you observed it on.
- Any impact assessment you have already done.

### Response timeline

| Stage | Target |
|---|---|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix or mitigation | Severity-dependent; typically within 2 weeks for critical issues |

---

## Scope

These areas are security-sensitive. A report against any of them is in scope.

| Area | Module | Why it matters |
|---|---|---|
| Encryption | `src/crypto/` | RC4 and AES encrypt/decrypt, key derivation, permission flags |
| Digital signatures | `src/signature/` | PKCS#7/CAdES signing, certificate chain validation, CRL/OCSP revocation, LTV |
| PDF parsing | `src/parser/` | Document parser and image decoders (CCITT, JBIG2, JPEG 2000) — the primary untrusted-input surface |
| Form scripting | `src/form/` | Arithmetic calculation evaluator and script attachment; script execution is disabled (`createSandbox().execute()` throws `ScriptExecutionDisabledError`, code `script-execution-disabled`) |
| Security tooling | `src/security/` | Threat scanner, sanitizer, redaction verifier, encryption inspector |
| WASM modules | `src/wasm/` | Rust crates for deflate, PNG, TTF, shaping, JBIG2, and JPEG |

> [!NOTE]
> The form calculation evaluator (`src/form/jsEvaluator.ts`) is a purpose-built
> arithmetic parser — it handles `AFSimple_Calculate` and simple arithmetic over
> field references. It is **not** a JavaScript engine and does not call `eval()`
> or `new Function()` on document-supplied script text.
> `createSandbox().execute()` throws `ScriptExecutionDisabledError` (code
> `script-execution-disabled`); the library does not evaluate PDF JavaScript.

### Particularly valuable reports

- Memory-exhaustion or infinite-loop denial of service reachable from a crafted PDF.
- A signature that verifies when it should not (chain, revocation, or byte-range confusion).
- Encryption or permission checks that can be bypassed.
- A redaction entry point (`redactRegions`, `applyRedactions`,
  `applyRedaction`, `PdfDocument.applyRedactions()`) that returns normally or
  changes the document instead of throwing `RedactionIncompleteError`, or a
  [`verifyRedactions`](./docs/guide/security.md#verifying-redactions) report
  with `clean: true`.
- Active content (`/OpenAction`, `/Launch`, JavaScript, `/SubmitForm`) that
  `sanitizePdf` fails to remove.

---

## Responsible Disclosure

We follow a coordinated disclosure process. We ask that you:

- Allow reasonable time for a fix before public disclosure.
- Avoid exploiting the vulnerability beyond what is needed to demonstrate it.
- Do not access or modify other people's data.

We are committed to working with security researchers, and we credit reporters
in release notes unless anonymity is preferred.
</content>
