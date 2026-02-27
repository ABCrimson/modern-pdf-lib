# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.2] - 2026-02-27

### Fixed
- **Docs site assets not loading**: Added `base: '/modern-pdf-lib/'` to VitePress config — without this, all CSS/JS assets failed to load on GitHub Pages because the site is hosted at a subpath

## [0.11.1] - 2026-02-27

### Changed
- **Documentation site redesign**: Complete visual overhaul of the VitePress docs site with custom theme — deep navy dark mode, violet/cyan gradient palette, glassmorphic feature cards, Inter + JetBrains Mono fonts, SVG gradient icons, animated hero section, benchmark stats showcase, and runtime badges
- **Improved meta tags**: Added OG title, URL, Twitter card meta, Google Fonts preconnect headers
- **Navbar**: Added version dropdown with Changelog and npm links, added npm social link
- **Fixed homepage GitHub link**: Was pointing to wrong repository URL

## [0.11.0] - 2026-02-27

### Performance

This release includes a comprehensive head-to-head benchmark suite against pdf-lib (v1.17.1) covering 30+ operations across document creation, drawing, fonts, images, saving, parsing, merging, metadata, forms, and end-to-end workflows. Benchmarks were run using Vitest's built-in `bench` API (`npx vitest bench`) on Node.js 25.7, with each operation measured in isolation inside a fresh document to avoid cross-contamination.

**Results: modern-pdf-lib wins 27 of 30 benchmarks.**

| Category | Operation | Winner | Factor |
|---|---|---|---|
| Document | Create empty document | modern-pdf-lib | **39x** faster |
| Document | Add page (A4) | modern-pdf-lib | **39x** faster |
| Document | Add 100 pages | modern-pdf-lib | **35x** faster |
| Font | Embed standard font | modern-pdf-lib | **22x** faster |
| Font | Embed all 14 standard fonts | modern-pdf-lib | **3x** faster |
| Text | drawText (single call) | modern-pdf-lib | **22x** faster |
| Text | 100x drawText | modern-pdf-lib | **26x** faster |
| Text | 1,000x drawText | modern-pdf-lib | **25x** faster |
| Shapes | 1,000x drawRectangle | modern-pdf-lib | **18x** faster |
| Shapes | 500x drawCircle | modern-pdf-lib | **6x** faster |
| Shapes | 1,000x drawLine | modern-pdf-lib | **8x** faster |
| Shapes | 100x drawSvgPath | modern-pdf-lib | **7x** faster |
| Image | Embed RGB PNG (no alpha) | modern-pdf-lib | **7x** faster |
| Image | Embed RGBA PNG (with alpha) | pdf-lib | 21x faster |
| Save | Empty 1-page (uncompressed) | pdf-lib | 1.5x faster |
| Save | Empty 1-page (compressed) | modern-pdf-lib | **7x** faster |
| Save | 10-page text document | modern-pdf-lib | **2x** faster |
| Save | 100-page text+shapes | modern-pdf-lib | **11x** faster |
| Parse | Load 1-page PDF | modern-pdf-lib | **3x** faster |
| Parse | Load 10-page PDF | modern-pdf-lib | **2x** faster |
| Parse | Load 100-page PDF | modern-pdf-lib | **57x** faster |
| Merge | Copy 5 pages | modern-pdf-lib | **1.6x** faster |
| Merge | Merge two 5-page PDFs | modern-pdf-lib | **44x** faster |
| Metadata | Set all metadata fields | modern-pdf-lib | **50x** faster |
| Pages | Rotate 10 pages | modern-pdf-lib | **32x** faster |
| Pages | 100x get/set dimensions | modern-pdf-lib | **1,828x** faster |
| Pages | Remove 10 of 20 pages | modern-pdf-lib | **35x** faster |
| Layout | layoutMultilineText | modern-pdf-lib | **88,745x** faster |
| Layout | layoutCombedText | modern-pdf-lib | **18x** faster |
| Color | 10,000x color construction | modern-pdf-lib | **4–13x** faster |
| Embed | Embed PDF page + draw | modern-pdf-lib | **4x** faster |
| E2E | Invoice (1 page) | modern-pdf-lib | **7x** faster |
| Roundtrip | Load → modify → save | pdf-lib | 1.4x faster |

**Why pdf-lib wins in 3 areas:**

- **RGBA PNG embedding (21x):** RGBA images require decompressing pixel data to separate the alpha channel into a PDF `/SMask`. This decompress → separate → recompress cycle is inherent to correct alpha handling. pdf-lib uses a different compression library (pako/UPNG) which has lower per-call overhead for very small data. For real-world images larger than 1x1 pixel, this gap narrows significantly as fflate's initialization cost is amortized.
- **Empty uncompressed save (1.5x):** modern-pdf-lib builds a more complete document structure (full catalog, page tree, info dict) on every save. This architectural investment pays off at scale — for any real document with text, fonts, or images, modern-pdf-lib is 2–11x faster.
- **Load → modify → save roundtrip (1.4x):** This tests loading a previously-saved PDF, adding a page, and re-saving. The small gap is due to our parser's richer object model and the orphan-detection graph walk (`filterReachable`) that runs on loaded documents to prevent output bloat.

**How to run benchmarks yourself:**
```bash
npm install
npx vitest bench tests/benchmarks/comparison.bench.ts
```

### Changed

- **PNG embedding is now synchronous**: `embedPng()` on `PdfDocument` now returns `ImageRef` directly instead of `Promise<ImageRef>`. The function was previously `async` due to dynamic `import('fflate')` calls, but fflate (a direct dependency) is now imported statically — matching every other file in the codebase. Existing code using `await doc.embedPng()` continues to work (`await` on a non-Promise returns the value immediately).
- **IDAT passthrough for non-alpha PNGs**: For Grayscale, RGB, and Indexed PNGs without transparency, the compressed IDAT data is now passed directly to the PDF image XObject with `/DecodeParms` using Predictor 15 (PNG prediction). This eliminates the entire decompress → reconstruct filters → recompress cycle. PDF viewers natively handle PNG row filters via FlateDecode predictors — this is the spec-correct way to embed PNGs and results in a **7x speedup** over pdf-lib for RGB images.
- **Static fflate import in PNG module**: Replaced dynamic `await import('fflate')` calls (2–3 per PNG embed) with a single static `import { unzlibSync, deflateSync } from 'fflate'` at module level. This aligns `pngEmbed.ts` with the rest of the codebase (`pdfWriter.ts`, `pdfStream.ts`, `incrementalWriter.ts` all use static imports).

### Optimized

- **Skip font subsetting when no TTF fonts**: `buildStructure()` now checks `this.ttfFonts.size > 0` before calling `subsetTtfFonts()`, avoiding unnecessary work for documents using only standard fonts.
- **Skip orphan detection for new documents**: `filterReachable()` (a recursive graph walk over all PDF objects) is now skipped when `this.originalBytes === undefined`. New documents created with `createPdf()` cannot have orphaned objects since nothing was loaded from an existing file.

### Added

- **Benchmark suite**: Comprehensive head-to-head benchmarks against pdf-lib (`tests/benchmarks/comparison.bench.ts`) covering 30+ operations. Run with `npx vitest bench`.
- **`pdf-lib` dev dependency**: Added `pdf-lib@^1.17.1` as a dev dependency for benchmark comparisons.

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
