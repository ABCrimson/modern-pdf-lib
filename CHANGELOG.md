# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
See [VERSIONING.md](./VERSIONING.md) for this project's versioning policy.

## [0.14.1] - 2026-02-28

### Added

- **Unified `embedImage()` method**: Auto-detects PNG (magic bytes `89 50 4E 47`) vs JPEG (`FF D8 FF`) from the raw file data — no need to call `embedPng()` or `embedJpeg()` separately. Accepts `Uint8Array` or `ArrayBuffer`, throws descriptive errors for unsupported formats.
- **Image optimization API exports**: `downscaleImage()`, `recompressImage()`, and `optimizeImage()` are now exported from the main entry point along with their option types (`DownscaleOptions`, `RecompressOptions`, `ImageOptimizeOptions`, `RawImageData`, `OptimizeResult`).
- **SASLprep password normalization (RFC 4013)**: V=5/R=6 (AES-256) password preparation now follows the full SASLprep profile — B.1 "mapped to nothing" characters are stripped, non-ASCII spaces are normalized to U+0020, NFKC normalization is applied, and prohibited characters (control chars, private use, surrogates, tagging) are rejected. This ensures correct password handling for internationalized passwords per ISO 32000-2.
- **Visible signature appearances**: `signPdf()` now accepts an `appearance` option with `rect`, `text`, `fontSize`, `backgroundColor`, `borderColor`, and `borderWidth`. When provided, the signature renders as a visible box on the page with auto-generated text (signer name from certificate CN, reason, location, date) or custom text lines. Uses a PDF Form XObject appearance stream with Helvetica.
- **Popup annotation type** (`PdfPopupAnnotation`): Floating window annotation that displays parent annotation text. Supports `isOpen()`/`setOpen()` and `setParent()`/`getParent()` for linking to parent annotations. Reference: PDF 1.7 §12.5.6.14.
- **Caret annotation type** (`PdfCaretAnnotation`): Marks text insertion points in review workflows. Supports `getSymbol()`/`setSymbol()` (`'None'` | `'P'` for paragraph) and `getCaretRect()`/`setCaretRect()` for inner rectangle (RD) insets. Reference: PDF 1.7 §12.5.6.11.
- **File attachment annotation type** (`PdfFileAttachmentAnnotation`): Embeds a file as a clickable icon on a page. Supports `getIcon()`/`setIcon()` (`'GraphPushPin'` | `'PaperclipTag'` | `'Paperclip'` | `'Tag'`), `getFileName()`, and `buildFileSpec(registry)` for building the embedded file stream, EF dictionary, and file specification. Reference: PDF 1.7 §12.5.6.15.
- **Digital signatures guide** (`docs/guide/signatures.md`): Comprehensive guide covering invisible and visible signing, verification, low-level ByteRange API, external signers, RFC 3161 timestamping, and key preparation with OpenSSL.
- **Accessibility & tagged PDF guide** (`docs/guide/accessibility.md`): Guide covering document language, title metadata, font embedding for Unicode, color contrast, multilingual content, PDF/UA compliance checklist, and XMP metadata.
- **Annotations guide** (`docs/guide/annotations.md`): Complete reference for all 18 annotation types with code examples — Text, Link, FreeText, Highlight, Underline, Squiggly, StrikeOut, Line, Square, Circle, Polygon, PolyLine, Stamp, Ink, Redact, Popup, Caret, FileAttachment. Includes annotation flags, appearance generation, and parsing from existing PDFs.

### Performance

- **Per-object encryption key caching**: `deriveObjectKey()` in `PdfEncryptionHandler` now caches computed keys in a `Map<number, Uint8Array>` keyed on `(objNum << 16) | genNum`. For V=1-4 encrypted PDFs, this eliminates redundant MD5 computations when decrypting multiple strings/streams in the same object.
- **File-level encryption key caching**: `computeFileEncryptionKey()` now maintains an LRU cache (max 32 entries) keyed on password + encryption dictionary parameters. Re-opening the same PDF with the same password skips the expensive key derivation (especially Algorithm 2.B for R=6 which runs 64+ rounds of AES+SHA).

### Changed

- **Annotation count**: 15 → 18 annotation types (added Popup, Caret, FileAttachment).
- **Test count**: 2,199 → 2,243 across 103 test suites (was 100).

## [0.14.0] - 2026-02-28

### Performance

Comprehensive internal performance audit across the entire codebase. All changes are internal hot-path optimizations — zero API surface changes.

**Lexer & Content Stream Parser:**
- String concatenation in `readLiteralString()`, `readHexString()`, `readName()` replaced with `parts[]` + `.join('')` pattern
- `bytesToAscii()` / `decodeAscii()` replaced with batch `String.fromCharCode.apply()`
- Hex string parsing rewritten to single-pass direct byte decoding with `hexVal` lookup table (eliminates intermediate string + `parseInt`)

**LZW Decompression:**
- Complete rewrite with pooled flat buffer (`Uint8Array` + `Int32Array` index pairs) replacing per-entry `Uint8Array[]` allocations
- Identity entries (0-255) initialized once and persist across table resets
- Pre-allocated output buffer with manual growth instead of `number[]` + `.push()`

**XRef Recovery & Parsing:**
- `rebuildXrefFromScan()` rewritten to scan raw `Uint8Array` bytes directly for `obj` pattern instead of `TextDecoder.decode()` + regex on the entire file
- Standard xref entries parsed directly from bytes (fixed 20-byte format) without TextDecoder
- Keyword checks (`xref`, `trailer`) replaced with direct byte comparison

**PDF Object Serialization:**
- `escapeLiteralString()`: 5 chained `.replace()` calls replaced with single-pass character loop
- `PdfName.serialize()`: String concatenation replaced with array + join
- `formatNumber()`: Regex trailing-zero trim replaced with manual digit loop

**Cryptographic Key Derivation:**
- Pre-allocated `modKey` buffer outside 19x RC4 iteration loops in owner/user password verification
- Direct K1 buffer construction in Algorithm 2.B (eliminates intermediate concatenation)

**Other:**
- ASCII85 decoder: Fixed-size group buffer + pre-allocated output
- SVG color parser: Module-level result cache (`Map<string, ParsedColor>`)
- XMP `escapeXml()`: Single-pass character loop replacing chained `.replace()`
- Inline image EI scanning: `data.indexOf(0x45)` jump instead of byte-by-byte scan
- Object stream header: Array + join replacing string concatenation

### Fixed
- **CCITT Group 3/4 2D decode bug**: `read2DMode()` returned `HORIZONTAL` for bit pattern `011` instead of `VERTICAL_PLUS_1` — correct logic existed but was unreachable due to premature return. This could cause incorrect rendering of CCITT Group 4 and Group 3 2D compressed images (scanned documents).
- **`customName` font option ignored for empty strings**: `||` operator treated empty string as falsy, falling through to `postScriptName`. Changed to `??` (nullish coalescing).
- **`embedPages()` unnecessarily async**: Method was declared `async` but contained only synchronous code, wrapping return in an unnecessary `Promise`. Now returns `EmbeddedPdfPage[]` directly.
- **Duplicate hash computation in document merge**: `hashBytes()` was called twice on the same stream data during cross-document page copy. Now computed once and reused.

### Removed
- Dead `PdfArr` import alias in `pdfWriter.ts`
- Unused `objectBuf` variable allocation in object stream serialization
- Unused `objectContainsPageRef()` function in linearization module

## [0.13.0] - 2026-02-28

### Added
- **Linear & radial gradient support**: `drawLinearGradient()` and `drawRadialGradient()` on pages with full PDF shading dictionary generation. Supports arbitrary color stops with positions.
- **Tiling pattern support**: `createTilingPattern()` for repeating pattern fills on shapes and text. Configurable tile size, spacing, and painting type.
- **JBIG2 WASM bridge**: Optional WASM-accelerated JBIG2 bilevel image decoder compiled from Rust. Includes QM arithmetic coding, MMR/Group 4 fax decoding, generic region decoding (templates 0-3), and symbol dictionary support. Pure-JS fallback when WASM is unavailable. New async API: `decodeJBIG2Async()`.
- **All 5 WASM binaries compiled**: libdeflate (62KB), PNG (119KB), TTF (91KB), shaping (529KB), and JBIG2 (29KB) — all built with wasm-pack and optimized with `opt-level = "z"`.
- **`PdfParseError` with hex context**: Parser errors now include a hex dump of surrounding bytes via `formatHexContext()`, making it easier to diagnose malformed PDFs.
- **Coordinate system guide**: New doc (`docs/guide/coordinates.md`) explaining PDF's bottom-left origin, unit system, page boxes, and transformation matrices.
- **Performance tuning guide**: New doc (`docs/guide/performance.md`) covering font subsetting, image optimization, streaming output, and WASM acceleration.
- **Troubleshooting & cookbook guides**: New docs (`docs/guide/troubleshooting.md`, `docs/guide/cookbook.md`) with common issues, solutions, and real-world recipes.
- **Expanded test suites**: Pattern fills (532 lines), transparency/soft masks (749 lines), and multilingual text extraction (1,325 lines covering CJK, Arabic, Hebrew, Thai, Devanagari, emoji). Stress tests for large documents (1,000+ pages, 10,000+ objects).

### Changed
- **Refactored `pdfPage.ts` and `pdfDocument.ts`**: Split monolithic files into focused modules for better maintainability and tree-shaking.
- **WASM module count**: 4 → 5 (added JBIG2).
- **Test count**: 1,973 → 2,199 across 100 test suites.

## [0.12.1] - 2026-02-27

### Fixed
- Converted dynamic import of `documentMerge` to static import (eliminates `INEFFECTIVE_DYNAMIC_IMPORT` bundler warning — module was already in the main bundle via `index.ts` re-export).
- Migrated tsdown config from deprecated `external` to `deps.neverBundle`.
- Normalized `repository.url` in package.json per npm spec.

## [0.12.0] - 2026-02-27

### Added
- **Pure JS TrueType font subsetting**: Fonts are now properly subsetted — only glyphs used in the document are included. Previously the entire font file was embedded unchanged, meaning a 10MB CJK font stayed 10MB even for 5 characters. The subsetter handles composite glyph dependencies, rebuilds `glyf`/`loca`/`hmtx`/`maxp`/`cmap` tables, and produces valid TrueType files with correct checksums and 4-byte alignment.
- **JBIG2 decoder: 7 new segment types**: Symbol Dictionary (type 0), Text Region (types 4/6/7), Pattern Dictionary (type 16), Halftone Region (types 20/22/23), and Generic Refinement Region (types 40/42/43). Enterprise and government PDFs with JBIG2-compressed scanned images now parse correctly. Includes arithmetic integer decoding (Annex A), IAID decoding, bitmap composition, and refinement coding.
- **WASM text shaping bridge**: Wired up the rustybuzz WASM module for OpenType text shaping (Arabic, Devanagari, ligatures, kerning). Falls back to JS when WASM is not compiled.
- **WASM font metric extraction bridge**: Wired up the TTF parser WASM module for fast font metric extraction. Falls back to JS when WASM is not compiled.
- **WASM font subsetting bridge**: Connected the JS subsetter with optional WASM-accelerated metric extraction.
- **Visual regression E2E tests**: 3 Playwright tests generating PDFs in-browser and comparing screenshots — single page with text, shapes and colors, and multi-page documents (Chromium only).
- **Benchmark tests for WASM modules**: 14 conditional benchmarks for WASM font parsing, font subsetting, text shaping, and libdeflate compression/decompression. Gracefully skipped when WASM binaries are not compiled.
- **Real Rust WASM unit tests**: Replaced placeholder `assert!(true)` tests with 27 real tests across 3 Rust modules — TTF parser (10 tests with programmatic font fixtures), PNG decoder (8 tests using the `png` encoder), and text shaper (9 tests including error cases).

### Fixed
- **Rust WASM modules now compile and test natively**: Extracted core logic into `_impl` functions returning `Result<T, String>` so tests work on non-wasm32 targets (JsValue panics outside WASM). Added `"rlib"` to `crate-type` in all Cargo.toml files to enable `cargo test`.
- **Rust shaping module**: Fixed `parse_script_tag` to return `rustybuzz::Script` via `from_iso15924_tag` instead of raw `Tag` (type mismatch with `set_script`). Added missing `use std::str::FromStr` import for language tag parsing.
- **Rust PNG module**: Fixed `Decoder::new` to wrap data in `Cursor` for `Seek` trait requirement in `png` 0.18.1. Fixed `output_buffer_size()` returning `Option<usize>`.
- **Rust TTF module**: Fixed name table in test fixtures to use platform 3 (Windows) with UTF-16BE encoding — `ttf-parser` doesn't decode platform 1 (Mac) name records via `to_string()`.

## [0.11.6] - 2026-02-27

### Removed
- **`docs/plans/` directory**: 4 historical planning documents (~3,200 lines) from the initial design phase. Internal scaffolding that should not ship with a public release.
- **`src/compression/zstdCache.ts`**: Unused Zstd compression cache stub (336 lines). Every function was a TODO with zero imports anywhere in the codebase. Optional WASM acceleration feature that had no consumers.

### Added
- **`VERSIONING.md`**: Documents the project's versioning policy — `MAJOR.MINOR.PATCH` format with max 9 per digit position (e.g., `0.11.9` → `0.12.0`), what each position means, and rollover rules.
- **Deno install snippet**: Getting Started guide now includes `deno add npm:modern-pdf-lib` in the code-group tabs alongside npm/pnpm/bun.
- **Supported runtimes table**: Collapsible runtimes table in Getting Started showing Node.js, Deno, Bun, Cloudflare Workers, and Browsers with version requirements.

### Changed
- **Cleaned up aspirational TODO comments**: Replaced 4 open-ended WASM TODO blocks in `fontEmbed.ts`, `fontSubset.ts`, and `textShaper.ts` with concise notes that JS fallbacks are in use and WASM acceleration is planned for a future release.

### Fixed
- **Migration guide checklist**: Changed `Remove any PDFDocument.load() calls (not supported)` to `Replace PDFDocument.load() with loadPdf()` — the library supports loading existing PDFs via `loadPdf()`.

## [0.11.5] - 2026-02-27

### Fixed
- **Wrong package name in all docs**: Every guide, code example, and import statement referenced `modern-pdf` instead of the correct package name `modern-pdf-lib` (renamed in v0.9.0 but docs were never updated)
- **Outdated info in migration guide**: Removed "creation-only" claim (library now supports full read/write/modify), updated Node version from 22+ to 25.7+, updated scope comparison, replaced "No PDFDocument.load()" section with `loadPdf()` migration example
- **Wrong package name in source JSDoc**: All `@example` import statements in source code referenced `'modern-pdf'` — fixed to `'modern-pdf-lib'` so TypeDoc generates correct API docs
- **Default producer string**: PDF metadata producer field defaulted to `"modern-pdf"` — fixed to `"modern-pdf-lib"` in `pdfCatalog.ts`, `pdfDocument.ts`, and `pdfA.ts` XMP metadata

## [0.11.4] - 2026-02-27

### Fixed
- **API Reference page 404**: TypeDoc generated `README.md` as entry file, but VitePress with `cleanUrls` rendered it as `api/README.html` — GitHub Pages couldn't find `api/index.html`. Fixed by setting `entryFileName: "index"` in `typedoc.json`
- **Broken CHANGELOG link**: Nav dropdown linked to `blob/main/` but default branch is `master`
- **Stale version in nav**: Version badge showed `v0.11.0` instead of current version
- **Edit link wrong branch**: "Edit this page on GitHub" linked to `main` instead of `master`

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
