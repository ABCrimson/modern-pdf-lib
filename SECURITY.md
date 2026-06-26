# Security Policy

## Supported Versions

| Version  | Supported          |
| -------- | ------------------ |
| 0.28.x   | :white_check_mark: |
| < 0.28.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in modern-pdf-lib, please report it responsibly.

**Do not open a public issue for security vulnerabilities.**

Instead, use one of the following methods:

1. **GitHub Security Advisory**: [Open a private advisory](https://github.com/ABCrimson/modern-pdf-lib/security/advisories/new)
2. **Email**: Send details to the maintainers via the email listed on the [GitHub profile](https://github.com/ABCrimson)

### What to Include

- A description of the vulnerability
- Steps to reproduce or a proof-of-concept
- The affected version(s)
- Any potential impact assessment

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Dependent on severity, typically within 2 weeks for critical issues

## Scope

The following areas are considered security-sensitive:

- **Crypto** (`src/crypto/`): RC4 and AES encryption/decryption
- **Digital signatures** (`src/signature/`): PKCS#7 signing, certificate chain validation, CRL/OCSP revocation
- **Form evaluator** (`src/form/`): Sandboxed JavaScript evaluation of Acrobat form scripts
- **PDF parsing** (`src/parser/`): Document parser, image decoders (CCITT, JBIG2, JPEG2000)

## Responsible Disclosure

We follow a coordinated disclosure process. We ask that you:

- Allow reasonable time for us to address the issue before public disclosure
- Avoid exploiting the vulnerability beyond what is necessary to demonstrate the issue
- Do not access or modify other users' data

We are committed to working with security researchers and will credit reporters in release notes (unless anonymity is preferred).
