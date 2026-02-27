# modern-pdf Complete Expansion Design

**Date**: 2026-02-25
**Status**: Approved
**Goal**: Transform modern-pdf from a creation-only library into the most complete PDF library in the JavaScript ecosystem — covering read, write, modify, forms, annotations, encryption, signatures, accessibility, and every major PDF feature across PDF 1.0–2.0.

---

## Architecture

### Three-Layer Design

```
┌──────────────────────────────────────────────────────────┐
│  PUBLIC API                                               │
│  createPdf() · loadPdf() · mergePdfs() · splitPdf()      │
│  page.drawText() · page.extractText()                     │
│  doc.getForm() · doc.encrypt() · doc.sign()               │
│  doc.getOutlines() · doc.getAnnotations()                 │
├──────────────────────────────────────────────────────────┤
│  DOCUMENT MODEL                                           │
│  PdfDocument (mutable, round-trip capable)                │
│  PdfPage · PdfField · PdfAnnotation · PdfOutlineItem      │
│  PdfSignatureField · PdfEncryptionDict · PdfStructureTree │
├──────────────────────────────────────────────────────────┤
│  LOW-LEVEL ENGINE                                         │
│  PdfParser    — bytes → object tree (lazy resolution)     │
│  PdfWriter    — object tree → bytes (full + incremental)  │
│  XrefParser   — traditional tables + xref streams + /Prev │
│  CryptoEngine — RC4, AES-128, AES-256, MD5, SHA-256      │
│  ContentStreamParser — operator bytes → AST               │
│  ContentStreamBuilder — AST → operator bytes              │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Single object model for read and write**. Parsed objects use the same `PdfDict`, `PdfArray`, `PdfStream`, `PdfRef` classes as created objects. No separate "parsed" type system. This enables true round-trip: load → modify → save.

2. **Lazy object resolution**. The parser reads the xref table first, then resolves indirect objects on-demand. A 500-page PDF doesn't load all 500 pages into memory at construction — only when accessed. This enables multi-GB file handling.

3. **Incremental saves**. Appending a new xref section + trailer with `/Prev` pointing to the previous xref offset. Critical for: (a) digital signature preservation, (b) performance on large files, (c) undo history.

4. **Web Crypto for AES**. Hardware-accelerated in all modern runtimes (Node, browsers, Deno, Workers). Pure-JS fallback for RC4/MD5 (deprecated algorithms with no native support). Optional WASM acceleration.

5. **Content stream round-trip**. Parse operators into an AST (array of `{operator, operands}`), allow programmatic modification, re-serialize. Enables text replacement, redaction, watermarking on existing pages.

6. **Form field class hierarchy**. `PdfField` base → `PdfTextField`, `PdfCheckboxField`, `PdfRadioGroup`, `PdfDropdownField`, `PdfListboxField`, `PdfButtonField`, `PdfSignatureField`. Each backed by underlying AcroForm dict + widget annotation.

---

## Phase 1 — PDF Parser + Read Support

**New files:**
- `src/parser/lexer.ts` — PDF tokenizer (numbers, strings, hex strings, names, keywords, comments)
- `src/parser/objectParser.ts` — Parse tokens into PdfDict, PdfArray, PdfStream, etc.
- `src/parser/xrefParser.ts` — Parse traditional xref tables + xref streams + `/Prev` chains
- `src/parser/documentParser.ts` — High-level: bytes → trailer → catalog → page tree → PdfDocument
- `src/parser/streamDecode.ts` — Decompress streams (Flate, ASCII85, ASCIIHex, RunLength, LZW)
- `src/parser/contentStreamParser.ts` — Tokenize content stream operators into AST
- `src/parser/textExtractor.ts` — Walk content stream AST, extract text with positions

**Public API additions:**
```ts
export async function loadPdf(bytes: Uint8Array, options?: LoadPdfOptions): Promise<PdfDocument>;
export interface LoadPdfOptions {
  password?: string;          // for encrypted PDFs (Phase 5)
  ignoreEncryption?: boolean; // skip decryption
  updateMetadata?: boolean;   // update /ModDate on save
}
```

**PdfDocument additions:**
```ts
class PdfDocument {
  // Existing creation methods stay unchanged
  static async load(bytes: Uint8Array, options?: LoadPdfOptions): Promise<PdfDocument>;
  getPage(index: number): PdfPage;
  getPages(): PdfPage[];
  getPageCount(): number;
}
```

**PdfPage additions:**
```ts
class PdfPage {
  extractText(): string;
  extractTextWithPositions(): TextItem[];
  getContentStream(): ContentStreamAST;
  getRotation(): number;
  getMediaBox(): [number, number, number, number];
  getCropBox(): [number, number, number, number] | undefined;
}
```

**Version coverage:** Reads PDF 1.0–2.0. Parser must handle all xref formats, all stream filters, all object types.

---

## Phase 2 — Page Manipulation + Merge/Split

**PdfDocument additions:**
```ts
class PdfDocument {
  insertPage(index: number, page?: PageSize): PdfPage;
  removePage(index: number): void;
  movePage(fromIndex: number, toIndex: number): void;
  copyPages(sourceDoc: PdfDocument, indices: number[]): Promise<PdfPage[]>;
  addPage(sizeOrPage?: PageSize | PdfPage): PdfPage;  // accept imported page
}
```

**Top-level functions:**
```ts
export async function mergePdfs(documents: PdfDocument[]): Promise<PdfDocument>;
export async function splitPdf(document: PdfDocument, ranges: [number, number][]): Promise<PdfDocument[]>;
```

**New files:**
- `src/core/pageManipulation.ts` — insert, remove, move, rotate, crop
- `src/core/documentMerge.ts` — cross-document page copy with resource deduplication
- `src/core/incrementalWriter.ts` — append-only save preserving original bytes

**Key complexity:** Resource deduplication when merging — fonts, images, and ExtGState from source documents must be re-registered in the target document without duplication.

---

## Phase 3 — Forms (AcroForm)

**New files:**
- `src/form/pdfForm.ts` — `PdfForm` class: field tree traversal, fill, flatten, create
- `src/form/fields/textField.ts` — `PdfTextField`
- `src/form/fields/checkboxField.ts` — `PdfCheckboxField`
- `src/form/fields/radioGroup.ts` — `PdfRadioGroup`
- `src/form/fields/dropdownField.ts` — `PdfDropdownField`
- `src/form/fields/listboxField.ts` — `PdfListboxField`
- `src/form/fields/buttonField.ts` — `PdfButtonField`
- `src/form/fields/signatureField.ts` — `PdfSignatureField`
- `src/form/fieldAppearance.ts` — Generate appearance streams for filled fields
- `src/form/fdfExport.ts` — Export/import FDF and XFDF data

**Public API:**
```ts
class PdfDocument {
  getForm(): PdfForm;
}

class PdfForm {
  getFields(): PdfField[];
  getField(name: string): PdfField;
  getTextField(name: string): PdfTextField;
  getCheckbox(name: string): PdfCheckboxField;
  getRadioGroup(name: string): PdfRadioGroup;
  getDropdown(name: string): PdfDropdownField;
  fill(values: Record<string, string | boolean>): void;
  flatten(): void;
  exportFdf(): Uint8Array;
  importFdf(fdf: Uint8Array): void;
}

class PdfTextField extends PdfField {
  getText(): string;
  setText(value: string): void;
  setFontSize(size: number): void;
  setAlignment(align: 'left' | 'center' | 'right'): void;
  isMultiline(): boolean;
  isPassword(): boolean;
  isReadOnly(): boolean;
  getMaxLength(): number | undefined;
}
// Similar for other field types...
```

---

## Phase 4 — Annotations

**New files:**
- `src/annotation/pdfAnnotation.ts` — Base `PdfAnnotation` class
- `src/annotation/types/` — One file per annotation type (text, link, highlight, freetext, line, square, circle, polygon, polyline, underline, squiggly, strikeout, stamp, caret, ink, popup, fileAttachment, redact, watermark, etc.)
- `src/annotation/appearanceGenerator.ts` — Generate `/AP` streams for visual rendering

**Public API:**
```ts
class PdfPage {
  getAnnotations(): PdfAnnotation[];
  addAnnotation(type: AnnotationType, options: AnnotationOptions): PdfAnnotation;
  removeAnnotation(annotation: PdfAnnotation): void;
  flattenAnnotations(): void;
}
```

**Priority annotation types (Phase 4a):**
- Text (sticky note), Link, FreeText, Highlight, Underline, StrikeOut, Squiggly, Line, Square, Circle, Ink, Stamp, Popup, Widget, FileAttachment, Redact

**Deferred types (Phase 4b):**
- Sound, Movie, RichMedia, PrinterMark, TrapNet, Watermark, 3D, Projection

---

## Phase 5 — Encryption + Decryption

**New files:**
- `src/crypto/engine.ts` — Unified crypto interface
- `src/crypto/rc4.ts` — RC4 cipher (pure JS, for legacy support)
- `src/crypto/aes.ts` — AES-128/256 CBC via Web Crypto API
- `src/crypto/md5.ts` — MD5 hash (pure JS)
- `src/crypto/sha256.ts` — SHA-256 via Web Crypto API (or SubtleCrypto)
- `src/crypto/keyDerivation.ts` — PDF key derivation algorithms (Alg 2, 2.A, 2.B per spec)
- `src/crypto/permissions.ts` — Permission flag encoding/decoding
- `src/crypto/encryptionHandler.ts` — Standard security handler (encrypt/decrypt objects)

**Encryption levels:**
| Level | Version | Key Length | Algorithm | PDF Version |
|-------|---------|-----------|-----------|-------------|
| 1 | V=1, R=2 | 40-bit | RC4 | 1.1 |
| 2 | V=2, R=3 | 128-bit | RC4 | 1.4 |
| 3 | V=4, R=4 | 128-bit | AES-CBC | 1.6 |
| 4 | V=5, R=6 | 256-bit | AES-CBC | 2.0 |

**Public API:**
```ts
class PdfDocument {
  encrypt(options: EncryptOptions): void;
  isEncrypted(): boolean;
  getPermissions(): PdfPermissions;
}

interface EncryptOptions {
  userPassword: string;
  ownerPassword: string;
  permissions?: PdfPermissionFlags;
  algorithm?: 'rc4-40' | 'rc4-128' | 'aes-128' | 'aes-256';
}

interface PdfPermissionFlags {
  printing?: boolean | 'lowResolution';
  modifying?: boolean;
  copying?: boolean;
  annotating?: boolean;
  fillingForms?: boolean;
  contentAccessibility?: boolean;
  documentAssembly?: boolean;
}
```

---

## Phase 6 — Digital Signatures

**New files:**
- `src/signature/signatureHandler.ts` — PKCS#7/CMS signature creation
- `src/signature/signatureVerifier.ts` — Signature validation
- `src/signature/byteRange.ts` — `/ByteRange` calculation for incremental signing
- `src/signature/timestamp.ts` — RFC 3161 timestamp authority client

**Public API:**
```ts
class PdfDocument {
  addSignatureField(page: PdfPage, rect: Rect, name: string): PdfSignatureField;
  sign(field: PdfSignatureField, options: SignOptions): Promise<Uint8Array>;
  getSignatures(): PdfSignatureInfo[];
  verifySignatures(): Promise<SignatureVerificationResult[]>;
}

interface SignOptions {
  certificate: Uint8Array;  // DER-encoded X.509
  privateKey: Uint8Array;   // PKCS#8 DER
  hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
  timestampUrl?: string;    // TSA URL for RFC 3161
  reason?: string;
  location?: string;
  contactInfo?: string;
}
```

**Requires:** Incremental save (Phase 2) — signatures are invalidated by full rewrites.

---

## Phase 7 — Bookmarks, Outlines, Metadata

**New files:**
- `src/outline/pdfOutline.ts` — Outline tree model
- `src/metadata/xmpMetadata.ts` — XMP metadata read/write
- `src/metadata/viewerPreferences.ts` — Viewer preference dictionary

**Public API:**
```ts
class PdfDocument {
  getOutlines(): PdfOutlineItem[];
  addOutline(title: string, destination: PdfPage | number, parent?: PdfOutlineItem): PdfOutlineItem;
  removeOutline(item: PdfOutlineItem): void;
  getMetadata(): DocumentMetadata;     // existing, now also reads
  getXmpMetadata(): string | undefined;
  setXmpMetadata(xmp: string): void;
  getViewerPreferences(): ViewerPreferences;
  setViewerPreferences(prefs: ViewerPreferences): void;
}
```

---

## Phase 8 — Tagged PDF / Accessibility

**New files:**
- `src/accessibility/structureTree.ts` — `/StructTreeRoot` model
- `src/accessibility/markedContent.ts` — BMC/BDC/EMC operators in content streams
- `src/accessibility/standardTypes.ts` — Standard structure types (Document, P, H1-H6, Table, TR, TD, Figure, etc.)

**Public API:**
```ts
class PdfPage {
  markContent(tag: StructureType, options?: MarkedContentOptions): MarkedContentScope;
  addAltText(image: ImageRef, altText: string): void;
}

class PdfDocument {
  getStructureTree(): PdfStructureTree | undefined;
  createStructureTree(): PdfStructureTree;
  setLanguage(lang: string): void;
  checkAccessibility(): AccessibilityReport;  // PDF/UA validation
}
```

---

## Phase 9 — Advanced Features

**SVG import:**
- `src/assets/svg/svgParser.ts` — Parse SVG XML into drawing commands
- `src/assets/svg/svgToPdf.ts` — Convert SVG elements to PDF operators
- `page.drawSvg(svgString, options)` and `doc.embedSvg(svgBytes)`

**Linearization:**
- `src/core/linearization.ts` — Produce linearized (fast web view) PDFs
- `doc.save({ linearize: true })`

**PDF/A compliance:**
- `src/compliance/pdfA.ts` — Validate and enforce PDF/A-1b, PDF/A-2b, PDF/A-3b
- `doc.save({ pdfA: '2b' })`

**Optional content groups (layers):**
- `src/layers/optionalContent.ts`
- `doc.addLayer(name)`, `page.drawText('...', { layer })`, `doc.getLayers()`

**Embedded files:**
- `doc.attachFile(name, bytes, mimeType)`
- `doc.getAttachments()`

**Redaction:**
- `page.redact(rect, options)` — Marks area for redaction
- `doc.applyRedactions()` — Permanently removes content under redaction annotations

**Watermark:**
- `doc.addWatermark(text, options)` — Applies to all/selected pages
- Options: text, font, size, color, opacity, rotation, position

---

## Phase 10 — Config Fixes + Polish

**Build config:**
- Add CJS output to `tsdown.config.ts`
- Enable sourcemaps
- Add `files` field to `package.json`

**Testing:**
- Coverage thresholds in `vitest.config.ts` (80% branches, 90% functions, 85% lines)
- E2E browser test harness (Vite dev server + test page)
- Cross-runtime CI (Node, Deno, Bun)
- Fuzz testing for parser (property-based tests with fast-check)
- Malformed input tests for parser

**Lint:**
- `no-restricted-globals: ['error', 'Buffer']` in `.eslintrc.cjs`

**Docs:**
- LICENSE (MIT)
- CHANGELOG.md
- CONTRIBUTING.md
- Generated TypeDoc API reference
- Update all guides for read/write API

**API polish:**
- `setKeywords(keywords: string | string[])` — accept both
- Audit all doc examples for correct `await` usage

---

## Output Versioning

- **Default output**: PDF 1.7 (`%PDF-1.7`)
- **When AES-256 encryption or 2.0 features used**: PDF 2.0 (`%PDF-2.0`)
- **Configurable**: `doc.save({ pdfVersion: '2.0' })`
- **Round-trip**: When loading an existing PDF, preserve its version unless features require upgrade

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| Parse 100-page PDF (cold) | < 50ms |
| Parse 1000-page PDF (lazy) | < 200ms |
| Fill 50 form fields + save | < 100ms |
| Merge 10 × 100-page docs | < 500ms |
| Encrypt 100-page doc (AES-256) | < 200ms |
| Extract text from 100 pages | < 300ms |
| Full round-trip (load → modify → save) | < 500ms for 100 pages |
| Bundle size (ESM, tree-shaken, gzipped) | < 80 KB core, < 150 KB with all features |

---

## File Count Estimate

| Area | New Files | Estimated Lines |
|------|-----------|-----------------|
| Parser (Phase 1) | ~8 | ~4,000 |
| Page manipulation (Phase 2) | ~3 | ~1,500 |
| Forms (Phase 3) | ~10 | ~3,000 |
| Annotations (Phase 4) | ~18 | ~4,000 |
| Encryption (Phase 5) | ~8 | ~2,500 |
| Signatures (Phase 6) | ~4 | ~2,000 |
| Bookmarks/metadata (Phase 7) | ~3 | ~1,000 |
| Accessibility (Phase 8) | ~3 | ~1,500 |
| Advanced (Phase 9) | ~8 | ~3,500 |
| Polish (Phase 10) | ~5 | ~500 |
| Tests for all phases | ~30 | ~8,000 |
| **Total** | **~100 new files** | **~31,500 new lines** |

Combined with existing codebase (~14,700 lines, ~95 files): **~46,200 lines across ~195 files**.
