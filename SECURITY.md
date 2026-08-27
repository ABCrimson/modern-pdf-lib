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

## Reporting a Vulnerability

> [!CAUTION]
> **Do not open a public GitHub issue for a security vulnerability.** Use one of
> the private channels below.

| Channel | How |
|---|---|
| GitHub Security Advisory *(preferred)* | [Open a private advisory](https://github.com/ABCrimson/modern-pdf-lib/security/advisories/new) |
| Email | The address listed on the [maintainer's GitHub profile](https://github.com/ABCrimson) |

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
| Form scripting | `src/form/` | Evaluation of Acrobat form calculation scripts |
| Security tooling | `src/security/` | Threat scanner, sanitizer, redaction verifier, encryption inspector |
| WASM modules | `src/wasm/` | Rust crates for deflate, PNG, TTF, shaping, JBIG2, and JPEG |

> [!NOTE]
> The form calculation evaluator (`src/form/jsEvaluator.ts`) is a purpose-built
> arithmetic parser — it handles `AFSimple_Calculate` and simple arithmetic over
> field references. It is **not** a JavaScript engine and does not call `eval()`
> or `new Function()` on document-supplied script text.

### Particularly valuable reports

- Memory-exhaustion or infinite-loop denial of service reachable from a crafted PDF.
- A signature that verifies when it should not (chain, revocation, or byte-range confusion).
- Encryption or permission checks that can be bypassed.
- Content that survives [`applyRedactions`](./docs/guide/security.md) or that
  `verifyRedactions` reports as clean while remaining extractable.
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
