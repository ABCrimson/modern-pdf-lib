# Contributing to modern-pdf-lib

Thank you for your interest in contributing! This guide will help you get started.

## Quick Start

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/modern-pdf-lib.git
cd modern-pdf-lib

# Install dependencies
npm install

# Run the test suite
npm test
```

## Development Workflow

1. **Branch from `master`** — create a descriptive branch name (e.g., `fix/png-embed-crash`, `feat/svg-support`)
2. **Make your changes** — keep PRs focused on a single concern
3. **Run tests** — ensure all tests pass before submitting
4. **Submit a pull request** — fill out the PR template and link any related issues

```bash
# Run the full test suite
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Build
npm run build
```

## Code Style

- **TypeScript strict mode** — no `any` casts, no `as any`
- **ESM-only** — use `import`/`export`, never `require()`
- **No `Buffer`** — use `Uint8Array` for all binary data (ensures cross-runtime compatibility)
- **No `var`** — use `const` by default, `let` when reassignment is needed
- **Modern APIs** — prefer `.includes()` over `.indexOf()`, `**` over `Math.pow()`, etc.

## Testing

We use [Vitest](https://vitest.dev/) for all tests. When adding a new feature or fixing a bug:

- Write tests that cover the new behavior
- Place test files alongside source files using the `*.test.ts` naming convention
- Run the full suite to ensure nothing is broken

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add SVG embedding support
fix: correct CMYK color conversion in JPEG decoder
docs: update API reference for table layout
test: add edge case coverage for form evaluator
refactor: simplify encryption handler key derivation
```

## Project Structure

```
src/
  core/        PDF document model, pages, writer, embedding, merging
  parser/      PDF parser, image decoders (CCITT, JBIG2, JPEG2000)
  crypto/      RC4 and AES encryption
  signature/   Digital signatures, PKCS#7, CRL/OCSP, LTV
  form/        Interactive form fields, JavaScript evaluator
  assets/      Font and image embedding (PNG, JPEG, WebP, TIFF)
  barcode/     QR codes, Code 128, EAN, PDF417, Data Matrix
  layout/      Table engine with pagination
  compliance/  PDF/A enforcement
  wasm/        Rust WASM modules (libdeflate, png, ttf, shaping, jbig2, jpeg)
```

## Questions?

- **Bugs and features**: [Open an issue](https://github.com/ABCrimson/modern-pdf-lib/issues)
- **Security issues**: See [SECURITY.md](./SECURITY.md)
- **General discussion**: [GitHub Discussions](https://github.com/ABCrimson/modern-pdf-lib/discussions)
