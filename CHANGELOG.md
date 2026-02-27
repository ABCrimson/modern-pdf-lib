# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.1] - 2026-02-27

### Fixed
- **VitePress docs deployment**: Added `ignoreDeadLinks` for `/api/` paths to fix dead link errors caused by TypeDoc-generated pages and `cleanUrls` mode
- **VitePress config**: Updated GitHub repository URLs from placeholder to `ABCrimson/modern-pdf-lib`
- **VitePress config**: Corrected copyright year to 2026

### Changed
- **GitHub Actions**: Updated all action versions to latest releases:
  - `actions/checkout` v4 → v6 (Node.js 24 runtime, improved credential persistence)
  - `actions/setup-node` v4 → v6 (Node.js 24 runtime, npm-only auto-caching)
  - `actions/cache` v4 → v5 (Node.js 24 runtime)
  - `actions/upload-artifact` v4 → v7 (direct upload support, ESM migration)
  - `actions/download-artifact` v4 → v8 (enforced hash verification, ESM migration)
  - `actions/upload-pages-artifact` v3 → v4 (runtime alignment)
  - `softprops/action-gh-release` v2 → v2.5.0 (bug fixes)

## [0.10.0] - 2026-02-27

### Changed
- **Node.js requirement**: Bumped minimum from 22 to 25.7 to support native `Uint8Array.toHex()`, `fromHex()`, `toBase64()`, and `fromBase64()` APIs used throughout the codebase

### Fixed
- **CI peer dependency conflict**: Added `--legacy-peer-deps` to `npm ci` in all workflow jobs — resolves `tsdown@0.21.0-beta.2` requiring `typescript@^5.0.0` while we use TypeScript 6.0
- **WASM build**: Made WASM compilation non-blocking (`continue-on-error: true`) in the release workflow since WASM modules are optional with pure-JS fallbacks

### Infrastructure
- **npm trusted publishing**: Switched from `NPM_TOKEN` secret to OIDC-based trusted publishing — no secrets to manage, GitHub Actions authenticates directly with npm via OpenID Connect
- **npm provenance**: Added explicit `id-token: write` permission on the publish job for cryptographic provenance attestation
- **Bundle path fix**: Corrected `ci.yml` bundle-size check to reference `dist/index.mjs` instead of the non-existent `dist/index.js`

## [0.9.0] - 2026-02-27

First public release on npm as `modern-pdf-lib`.

### Changed
- **Renamed** from `modern-pdf` to `modern-pdf-lib` (v0.9.0)
- **Package exports**: Fixed conditional exports to use correct `.mjs`/`.d.mts`/`.d.cts` extensions matching tsdown output
- **Package size**: Reduced from 1.3 MB to 589 KB by excluding source map files from the published tarball
- **ESNext modernization**: Replaced manual implementations with native APIs:
  - `Uint8Array.toHex()` / `Uint8Array.fromHex()` for hex conversions
  - `Uint8Array.toBase64()` / `Uint8Array.fromBase64()` for Base64
  - `Map.groupBy()` for grouping operations
  - `TextDecoder('latin1')` for Latin-1 decoding
  - `concatBytes()` utility for Uint8Array concatenation
  - Iterator helpers (`.keys().toArray()`, `.values().toArray()`)

### Added
- **README**: Comprehensive, visually striking README with dark/light mode badges, feature comparison table (18 rows vs pdf-lib), collapsible API examples, runtime table, WASM acceleration table
- **`prepublishOnly` script**: Runs typecheck + tests + build before every publish
- **Repository metadata**: Added `homepage`, `bugs`, and corrected `repository` URLs in package.json
- **GitHub release**: Created v0.9.0 release with release notes

### Fixed
- **TypeScript strict mode errors**:
  - `accessibilityChecker.ts`: Fixed `noUncheckedIndexedAccess` errors with `Map.groupBy` by extracting array elements to local variables
  - `pdfDocument.ts`: Fixed `exactOptionalPropertyTypes` error by adding `| undefined` to optional property type
- **Test assertions**: Updated 3 tests to use generic `.toThrow()` instead of regex patterns that didn't match native API error messages

## [0.1.0] - 2026-02-25

Initial development release.

### Features
- **PDF Creation**: Full document creation with text, fonts (standard 14 + TrueType), images (PNG/JPEG), shapes, colors, opacity
- **PDF Parsing**: Complete parser supporting PDF 1.0-2.0, all xref formats, all stream filters, lazy object resolution
- **Text Extraction**: Full text extraction with positions, font tracking, ToUnicode CMap support
- **Page Manipulation**: Insert, remove, move, rotate, crop, resize pages
- **Document Merge/Split**: Merge multiple PDFs, split by page ranges, cross-document page copy with resource deduplication
- **Incremental Save**: Append-only saves preserving original bytes and signatures
- **Forms (AcroForm)**: Read, write, fill, flatten — text fields, checkboxes, radio groups, dropdowns, listboxes, buttons, signature fields
- **Annotations**: Full annotation support — text, link, freetext, highlight, underline, strikeout, squiggly, line, square, circle, polygon, polyline, stamp, ink, redact
- **Encryption**: RC4-40, RC4-128, AES-128, AES-256 encryption/decryption with password verification
- **Digital Signatures**: PKCS#7/CMS signing with RSA/ECDSA, signature verification, RFC 3161 timestamps
- **Bookmarks/Outlines**: Full outline tree with nested bookmarks, colors, styles, all fit modes
- **XMP Metadata**: Generate and parse XMP metadata packets with Dublin Core/XMP/PDF namespaces
- **Viewer Preferences**: All 12 viewer preference fields
- **Tagged PDF / Accessibility**: Structure tree, marked content, PDF/UA validation with 13 check codes
- **SVG Import**: Parse and render SVG paths, shapes, colors, transforms
- **PDF/A Compliance**: Validation and enforcement for PDF/A-1b through PDF/A-3u
- **Optional Content (Layers)**: Create, manage, and render content in layers
- **Embedded Files**: Attach and retrieve file attachments
- **Watermarks**: Text watermarks with custom styling, opacity, rotation
- **Redaction**: Two-step redaction (mark + apply) with overlay text
- **Streaming Output**: `ReadableStream` and `Blob` output for serverless/edge
- **Object Streams**: Cross-reference streams for smaller file sizes
- **Universal Runtime**: Works in Node.js, Deno, Bun, Cloudflare Workers, browsers — ESM-only, zero Buffer usage
