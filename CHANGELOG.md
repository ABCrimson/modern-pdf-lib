# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
See [VERSIONING.md](./VERSIONING.md) for this project's versioning policy.

## [0.26.0] - 2026-03-08

### Added

- **PDF form flattening** (`src/form/formFlatten.ts`):
  - `flattenForm()` — burn all form fields into page content, remove AcroForm
  - `flattenField()` / `flattenFields()` — flatten specific fields by name
  - `FlattenOptions` with `preserveReadOnly` support

- **Bookmarks / Outlines API** (`src/core/outlines.ts`):
  - `addBookmark()` — add nested bookmarks with bold/italic/color/position
  - `getBookmarks()` — return the full bookmark tree
  - `removeBookmark()` / `removeAllBookmarks()` — bookmark management

- **Page labels** (`src/core/pageLabels.ts`):
  - `setPageLabels()` — set label ranges (decimal, roman, alpha, custom prefix)
  - `getPageLabels()` / `removePageLabels()` — label management
  - Catalog integration with `/PageLabels` number tree

- **AES-256 encryption** (PDF 2.0, V=5 R=6):
  - Full writer integration — `doc.encrypt({ algorithm: 'aes-256' })` now works end-to-end
  - Algorithm 2.B key derivation (ISO 32000-2), SASLprep password normalization
  - `%PDF-2.0` header for AES-256 encrypted documents
  - Trailer `/Encrypt` and `/ID` dictionary generation

- **SVG-to-PDF vector conversion** (enhanced):
  - Text rendering with standard font resolution (Helvetica/Times/Courier families)
  - Fill-rule support (nonzero/evenodd → `f`/`f*`/`B`/`B*`)
  - Stroke properties: linecap, linejoin, miterlimit, dasharray, dashoffset
  - 60 new SVG conversion tests

- **Redaction application** (`src/annotation/applyRedactions.ts`):
  - `applyRedactions()` — apply all redaction annotations (fill area, overlay text, remove annotation)
  - `applyRedaction()` — apply a single redaction by page/annotation index

- **Batch processing** (`src/batch/batchProcessor.ts`):
  - `processBatch()` — process multiple PDFs with bounded concurrency
  - `batchMerge()` / `batchFlatten()` — parallel merge and flatten operations
  - Progress callbacks, error isolation, runtime-aware concurrency

- **PDF linearization** (fast web view) — complete rewrite:
  - `linearizePdf()` — full page classification, hint tables, xref streams
  - `delinearizePdf()` — convert linearized PDF back to normal
  - `getLinearizationInfo()` — extract linearization parameters
  - Page offset and shared object hint tables per PDF spec §F

- **PDF/UA accessibility validation** (`src/accessibility/pdfUaValidator.ts`):
  - `validatePdfUa()` — 12 checks: structure tree, language, title, headings, alt text, tables, lists, reading order, fonts, contrast, bookmarks, tab order
  - `enforcePdfUa()` — auto-fix language, title, structure tree, tab order
  - Page tab order API (`setTabOrder()`)

- **WASM-by-default infrastructure**:
  - `getInlineWasmBytes()` — decode base64-embedded WASM at runtime
  - `scripts/generate-inline-wasm.ts` — build-time code generation for inline WASM
  - `generate:wasm-inline` npm script

- **586 new tests** across 20+ test files:
  - Form flattening (26), outlines (24), page labels (31), AES-256 (55)
  - SVG conversion (60 new), redaction (17), batch processing (18)
  - Linearization (44), PDF/UA validation (51), inline WASM (17)
  - PDF/A enforcement (24), sRGB ICC profile (20), transparency flattener (18)
  - JPEG2000 tiles (25), JPEG2000 bit depth (41)
  - Object pool (26), PDF value helpers (24), validation (60)

### Changed

- **WASM loader** — now resolves `dist/wasm/` layout first (npm consumers), falls back to dev `src/wasm/` layout
- **tsdown config** — removed duplicate IIFE config (esbuild script handles it)
- **Coverage threshold** — branch coverage raised from 80% to 85%
- **Modernization audit** — 32 changes across 14 source files:
  - 22× `isNaN()` → `Number.isNaN()`, `isFinite()` → `Number.isFinite()`
  - `.indexOf() >= 0` → `.includes()` in generated Acrobat JS
  - Removed 4 `as unknown` casts via proper typing
  - `.split('')` → `[...str]` spread for string iteration
- **PdfWriter** — now async with full AES-256 encryption integration
- **API audit** — comprehensive audit doc at `docs/plans/api-audit-results.md`
- Test count: **5,135 tests** passing across **227 test suites**

### Fixed

- IIFE test failures from tsdown config removal
- `fieldVisibility` test updated for `.includes()` modernization

## [0.25.0] - 2026-03-08

### Added

- **267 new tests** — comprehensive coverage for previously untested security-critical and core modules:
  - `signatureVerifier.test.ts` (23 tests) — digital signature verification with tamper detection, multi-sig, hash algorithms
  - `sha256.test.ts` (28 tests) — NIST FIPS 180-4 test vectors for SHA-256/384/512
  - `textShaper.test.ts` (32 tests) — Unicode text shaping, RTL, glyph mapping, WASM fallback
  - `jpegEmbed.test.ts` (42 tests) — SOF parsing, color space detection, Adobe APP14, error handling
  - `cffEmbed.test.ts` (36 tests) — OpenType table directory parsing, tag matching, all standard tags
  - `freeTextAnnotation.test.ts` (16 tests) — creation, parsing, alignment, font size
  - `inkAnnotation.test.ts` (12 tests) — ink list management, multi-path, clear workflow
  - `redactAnnotation.test.ts` (13 tests) — overlay text, interior color, quad points
  - `stampAnnotation.test.ts` (13 tests) — all 14 standard stamp names, custom stamps
  - `detect.test.ts` (16 tests) — runtime detection for Node/Deno/Bun, caching, adapter creation
  - `adapter.test.ts` (18 tests) — runtime adapter interface, override, stream creation
  - `cli.test.ts` (18 tests) — help text, argument parsing, validation, optimize command

- **Complete sub-entry point exports**:
  - `modern-pdf-lib/create` — added ~30 missing exports: gradients, patterns, page manipulation, PDF embedding, QR code options, transparency, document metadata
  - `modern-pdf-lib/parse` — added `Operand` type, `AnalyzeImagesOptions`, `PdfParseError`, `formatHexContext`
  - `modern-pdf-lib/forms` — added 7 appearance generators + 9 option types for complete form appearance API

### Fixed

- **CI/CD branch mismatch** — `.github/workflows/ci.yml` triggered on `main` but repo uses `master`; CI was never running on pushes or PRs
- **Missing sidebar entries** — `Image Formats` and `Multi-Party Signing` guides were invisible in VitePress navigation
- **CI WASM build missing crates** — `build-wasm-ci.sh` was missing `jbig2` and `jpeg` modules (only had 4/6)
- **WASM binaries excluded from npm package** — added `dist/wasm/**` to `package.json` files field
- **No WASM copy step in build pipeline** — added `copy:wasm` script to copy built WASM from `src/wasm/*/pkg/` to `dist/wasm/`
- **IIFE bundle not in build pipeline** — added `build:iife` to `build:all` script chain

### Changed

- **Code deduplication** — inlined `.toHex()` at 8 call sites, removed 3 identical wrapper functions from `ocsp.ts`, `crl.ts`, `chainValidator.ts`
- Test count: **4,549 tests** passing across **211 test suites** (up from 4,282 across 199)

## [0.24.10] - 2026-03-07

### Added

- **Incremental save with signature preservation** (`src/signature/incrementalSave.ts`):
  - `saveIncrementalWithSignaturePreservation()` — preserves all existing signature byte ranges
  - `appendIncrementalUpdate()` — pure append-only incremental updates
  - `parseExistingTrailer()` — parse trailer info from existing PDF
  - `findExistingSignatures()` / `validateByteRangeIntegrity()` — signature detection and validation

- **Multi-signature chain validation** (`src/signature/multiSignatureValidator.ts`):
  - `validateSignatureChain()` — validates ordered chain of signatures and byte range coverage

- **MDP certification policy** (`src/signature/mdpPolicy.ts`):
  - `MdpPermission` enum (NoChanges, FormFillAndSign, FormFillSignAnnotate)
  - `setCertificationLevel()` / `getCertificationLevel()` — DocMDP transform methods

- **Modification detection** (`src/signature/modificationDetector.ts`):
  - `detectModifications()` — checks if modifications exceed MDP-permitted level

- **Signature field locking** (`src/signature/fieldLock.ts`):
  - `addFieldLock()` / `getFieldLocks()` — lock specific fields after signing

- **Document diff** (`src/signature/documentDiff.ts`):
  - `diffSignedContent()` — compares signed version vs current content

- **Counter-signatures** (`src/signature/counterSignature.ts`):
  - `addCounterSignature()` / `getCounterSignatures()` — sign existing signatures

- **LTV embedding** (`src/signature/ltvEmbed.ts`):
  - `embedLtvData()` — embeds CRL + OCSP + certs in Document Security Store (DSS)
  - `hasLtvData()` / `buildDssDictionary()` — LTV data detection and building

- **Incremental save optimization** (`src/signature/incrementalOptimizer.ts`):
  - `optimizeIncrementalSave()` — FNV-1a object hashing, only append changed objects
  - `findChangedObjects()` / `computeObjectHash()` — object-level diff detection

- **WebP image embedding** (`src/assets/image/webpDecode.ts`):
  - `decodeWebP()` — pure TypeScript VP8 (lossy) and VP8L (lossless) decoder
  - Alpha channel support via ALPH chunk parsing
  - DCT coefficient decoding, YUV420→RGB, macroblock processing
  - LZ77, Huffman coding, spatial prediction (13 modes) for lossless

- **TIFF image embedding** (`src/assets/image/tiffDecode.ts`):
  - `decodeTiff()` / `decodeTiffPage()` / `decodeTiffAll()` — full TIFF decoder
  - Uncompressed, PackBits, LZW, Deflate, JPEG-in-TIFF compression support
  - Multi-page TIFF (IFD chain following)
  - `getTiffPageCount()` / `parseTiffIfd()` — TIFF introspection

- **TIFF CMYK support** (`src/assets/image/tiffCmyk.ts`):
  - `embedTiffCmyk()` — native DeviceCMYK embedding (no RGB conversion)
  - `convertTiffCmykToRgb()` — CMYK→RGB conversion when needed

- **Image format auto-detection** (`src/assets/image/formatDetect.ts`):
  - `detectImageFormat()` — detects PNG/JPEG/WebP/TIFF from magic bytes
  - Updated `embedImage()` to support all 4 formats automatically

- **WebP optimization** (`src/assets/image/webpOptimize.ts`):
  - `webpToJpeg()` / `webpToPng()` — format conversion
  - `recompressWebP()` — decode → JPEG/PNG re-encode pipeline

- **TIFF direct embedding** (`src/assets/image/tiffDirectEmbed.ts`):
  - `embedTiffDirect()` — direct strip/tile mapping (skip decode/re-encode)
  - `canDirectEmbed()` — format compatibility check

- **Documentation**:
  - Multi-signature workflow guide (`docs/guide/multi-sign.md`)
  - Image format support guide (`docs/guide/image-formats.md`)

### Stats

- 4,282 tests passing across 199 suites (+285 new tests)
- Zero TypeScript errors (strict mode + exactOptionalPropertyTypes)
- 15 new source files, 15 new test files, 2 new guides

## [0.22.9] - 2026-03-07

### Added

- **CRL/OCSP revocation checking** (`src/signature/`):
  - OCSP request building, response parsing, and certificate status checking
  - CRL parsing, download, and revocation checking with distribution points
  - Certificate chain building and validation with Web Crypto signature verification
  - TTL-based OCSP/CRL response caching with automatic expiry
  - OCSP stapling — embed/extract OCSP responses in PKCS#7 signatures
  - Delta CRL parsing and merging with base CRLs (RFC 5280)
  - Enhanced verification with structured results (chain, revocation, timestamps)
  - Offline revocation data extraction and verification without network
  - Custom trust store class for enterprise PKI certificate management
  - Key usage, extended key usage, and certificate policy validation
  - New guide: `docs/guide/verification.md`

- **JPEG2000 (JPXDecode) decoder** (`src/parser/`):
  - Full JP2/J2K decoder with MQ arithmetic coder and discrete wavelet transform
  - JPXDecode filter integration in the stream decoder pipeline
  - JP2 container vs J2K codestream detection and parsing
  - Alpha channel detection, separation, and premultiplication
  - JP2-to-JPEG transcoding for downstream JPEG workflows
  - 16-bit to 8-bit bit depth normalization
  - Tiled and region-of-interest decoding for large images
  - WASM bridge with automatic JS fallback
  - New guide: `docs/guide/jpeg2000.md`

- **Form field JavaScript evaluation** (`src/form/`):
  - Arithmetic expression evaluator and AFSimple_Calculate parser
  - Field calculation order with dependency graphs and topological sort
  - AFNumber_Format/Keystroke and AFDate_FormatEx/KeystrokeEx builtins
  - Field validation: email, phone, range, regex, and length constraints
  - AFPercent_Format, AFSpecial_Format (ZIP, SSN, phone number)
  - Field visibility toggle with condition-based show/hide
  - getField() cross-field references with field proxy objects
  - Document-level scripts: open, close, print, and save actions
  - Sandboxed script execution with reserved word filtering and strict mode
  - New guide: `docs/guide/form-scripts.md`

### Changed

- **Test count**: 3,260 → 3,997 across 184 test suites (was 158).

## [0.19.9] - 2026-03-07

### Added

- **Table layout engine** (`src/layout/`): Full-featured table rendering with PDF operators.
  - `renderTable()` — single-page table rendering to content-stream operators
  - `renderMultiPageTable()` — automatic page breaks with header row repetition
  - Column width modes: fixed, percentage, flex (weighted), auto-fit (content-based)
  - Cell padding (per-cell or table-wide, four-sided or uniform)
  - Horizontal alignment (left, center, right) and vertical alignment (top, middle, bottom)
  - Colspan and rowspan with 2D occupation grid tracking
  - Alternating row colors, header background/text color
  - Nested tables as cell content (recursive rendering)
  - Rich cell content with `TextRun[]` (per-run font, color, size)
  - Text overflow modes: wrap, truncate, ellipsis, shrink-to-fit
  - Styling presets: `minimalPreset()`, `stripedPreset()`, `borderedPreset()`, `professionalPreset()`
  - `applyPreset()` and `applyTablePreset()` for named preset selection
  - `PdfPage.drawTable()` convenience method
  - Overflow utilities: `estimateTextWidth()`, `wrapText()`, `truncateText()`, `ellipsisText()`, `shrinkFontSize()`
  - 200 tests across 11 test files

- **QR code & barcode engine** (`src/barcode/`): 9 barcode formats with full encoding.
  - QR code (ISO 18004): versions 1–40, all EC levels (L/M/Q/H), 8 mask patterns, GF(256) Reed-Solomon
  - Code 128 (A/B/C auto-switching, mod-103 check digit)
  - EAN-13 / EAN-8 with L/G/R patterns and parity tables
  - UPC-A (delegates to EAN-13 with leading zero)
  - Code 39 with optional mod-43 check digit
  - ITF (Interleaved 2 of 5) with bearer bars
  - PDF417 (text/byte compaction, RS over GF(929), clusters 0/3/6)
  - Data Matrix ECC200 (RS over GF(256), Utah placement algorithm)
  - `renderStyledBarcode()` for styled rendering with text, borders, colors
  - `readBarcode()` / `readCode128()` / `readEan13()` for round-trip verification
  - `PdfPage.drawQrCode()` convenience method
  - 204 tests across 10 test files

- **Browser utilities** (`src/browser/`):
  - `saveAsDownload()`, `saveAsBlob()`, `saveAsDataUrl()`, `openInNewTab()`
  - Service Worker helpers: `handlePdfRequest()`, `createPdfResponse()`, `isCacheAvailable()`
  - `PdfWorker` class for Web Worker PDF generation
  - CSP compatibility: `disableWasm` option, `isWasmDisabled()`, runtime detection
  - WASM streaming: `loadWasmModuleStreaming()`, `instantiateWasmModuleStreaming()`

- **PDF/A full enforcement** (`src/compliance/`):
  - `enforcePdfAFull()` — complete pipeline chaining all PDF/A fixes
  - sRGB ICC profile generation (~3KB ICC v2 profile)
  - OutputIntent builder with OutputIntentOptions
  - ToUnicode CMap generation (WinAnsi, Symbol, ZapfDingbats)
  - Transparency detection and flattening
  - XMP metadata validation and generation for PDF/A conformance
  - PDF/A profile definitions (1a/1b, 2a/2b/2u, 3a/3b/3u)
  - Associated files for PDF/A-3 (/AF key)
  - Prohibited feature stripping (JavaScript, Launch, Sound, Movie, RichMedia)
  - veraPDF CLI wrapper for CI validation

- **Documentation**: New guides for tables, barcodes, PDF/A, CSP, and browser integration.

### Changed

- **Test count**: 2,323 → 3,260 across 158 test suites (was 110).

## [0.15.1] - 2026-02-28

### Fixed

- **CLI build**: Added `src/cli/index.ts` as a tsdown entry point so `dist/cli/index.mjs` is produced during build. Previously, `npx modern-pdf optimize` would fail because the CLI file was never emitted.
- **CJS compatibility**: Replaced top-level `await` in CLI entry with an `async main()` wrapper to avoid `Top-level await is not supported with CJS output` build errors.

## [0.15.0] - 2026-02-28

### Added

- **JPEG WASM module**: New Rust WASM crate (`src/wasm/jpeg/`) using `jpeg-encoder` 0.7 + `jpeg-decoder` 0.3 for high-performance JPEG encoding and decoding. TypeScript bridge (`initJpegWasm()`, `encodeJpegWasm()`, `decodeJpegWasm()`) with graceful JS fallback when WASM is unavailable.
- **JPEG quality auto-detection**: `estimateJpegQuality(jpegBytes)` analyzes DQT (quantization table) markers to reverse-engineer the original JPEG quality level (1–100). Pure TypeScript — no WASM required.
- **Progressive JPEG support**: `progressive` option for JPEG encoding produces progressive scan-order JPEGs (better for web delivery).
- **Chroma subsampling control**: `chromaSubsampling` option (`'4:4:4'` | `'4:2:2'` | `'4:2:0'`) for JPEG encoding. Default `'4:2:0'` matches industry standard for smallest files.
- **CMYK JPEG handling**: Automatic CMYK→RGB conversion before JPEG encoding using the standard formula `R = 255 × (1 − C/255) × (1 − K/255)`.
- **Batch image optimization API**: `optimizeAllImages(doc, options)` walks all image XObjects in a parsed PDF, recompresses them as JPEG, and replaces stream data in-place. Returns detailed `OptimizationReport` with per-image breakdown. Options: `quality`, `maxDpi`, `progressive`, `chromaSubsampling`, `skipSmallImages`, `minSavingsPercent`, `autoGrayscale`.
- **Image extraction API**: `extractImages(doc)` collects metadata for all image XObjects across all pages. `decodeImageStream(imageInfo)` decodes stream data for further processing.
- **Image deduplication**: `deduplicateImages(doc)` detects identical images by FNV-1a hashing and replaces duplicate references with a single canonical copy. Returns `DeduplicationReport` with bytes-saved statistics.
- **Grayscale auto-detection**: `isGrayscaleImage()` detects RGB images where all pixels are effectively grayscale (R ≈ G ≈ B within tolerance). `convertToGrayscale()` converts using ITU-R BT.601 luma formula, saving ~66% for RGB→grayscale.
- **DPI-aware downscaling**: `computeImageDpi()` and `computeTargetDimensions()` calculate effective DPI from pixel dimensions and display size in points. Used by batch optimizer for automatic DPI-based downscaling.
- **CLI tool**: `npx modern-pdf optimize input.pdf output.pdf [options]` — command-line interface for image optimization with `--quality`, `--progressive`, `--grayscale`, `--dedup`, `--chroma`, `--verbose` options.
- **Image optimization VitePress guide** (`docs/guide/image-optimization.md`): Comprehensive guide covering the full image optimization API, CLI usage, and options reference.

### Changed

- **WASM modules**: 5 → 6 (added `jpeg` for JPEG encode/decode).
- **Test count**: 2,243 → 2,323 across 110 test suites (was 103).
- **package.json**: Added `"bin": { "modern-pdf": "./dist/cli/index.mjs" }` for CLI support.

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
