# Stable API Audit Results

**Date**: 2026-03-08
**Version**: 0.25.0
**Purpose**: Evaluate the public API surface for consistency, type safety, documentation quality, and readiness for a 1.0 API freeze.

---

## 1. Public Export Inventory

### 1.1 Core Document API (`src/core/pdfDocument.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `createPdf` | function | Yes | Yes (`PdfDocument`) | Clean factory |
| `PdfDocument` | class | Yes | N/A | Well-documented, all public methods have JSDoc |
| `StandardFonts` | const | Yes | Yes | `as const satisfies` pattern |
| `StandardFontName` | type | N/A | N/A | Derived from `StandardFonts` |
| `EmbedFontOptions` | interface | Yes | N/A | All fields `| undefined` |
| `SetTitleOptions` | interface | Yes | N/A | Clean |

### 1.2 Page API (`src/core/pdfPage.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `PdfPage` | class | Yes | N/A | All public methods documented |
| `PageSizes` | const | Yes | Yes | `as const satisfies` pattern |
| `PageSize` | type | N/A | N/A | Union of tuple and object |
| `FontRef` | interface | Yes | N/A | **Issue**: `_isCIDFont`, `_encodeText` are `@internal` but exported publicly |
| `ImageRef` | interface | Yes | N/A | Clean |
| `DrawTextOptions` | interface | Yes | N/A | All fields documented |
| `DrawImageOptions` | interface | Yes | N/A | All fields documented |
| `DrawRectangleOptions` | interface | Yes | N/A | All fields documented |
| `DrawSquareOptions` | interface | Yes | N/A | All fields documented |
| `DrawLineOptions` | interface | Yes | N/A | **Issue**: `start`/`end` use inline `{ x, y }` objects |
| `DrawCircleOptions` | interface | Yes | N/A | **Issue**: `size` deprecated but still exported |
| `DrawEllipseOptions` | interface | Yes | N/A | Clean |
| `DrawSvgPathOptions` | interface | Yes | N/A | Clean |
| `DrawQrCodeOptions` | interface | Yes | N/A | Clean |
| `TransparencyGroupOptions` | interface | Yes | N/A | Clean |
| `SoftMaskBuilder` | interface | Yes | N/A | Clean |
| `SoftMaskRef` | interface | Yes | N/A | Uses `_tag` brand |

### 1.3 PDF Embedding (`src/core/pdfEmbed.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `embedPageAsFormXObject` | function | Yes | Yes (`EmbeddedPdfPage`) | Clean |
| `EmbeddedPdfPage` | interface | Yes | N/A | Clean |
| `DrawPageOptions` | interface | Yes | N/A | Uses inline `{ type, value }` for `rotate`, `xSkew`, `ySkew` instead of `Angle` |
| `EmbedPageOptions` | interface | Yes | N/A | Clean |

### 1.4 Colour Helpers (`src/core/operators/color.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `rgb` | function | Yes | Yes (`RgbColor`) | Clean |
| `cmyk` | function | Yes | Yes (`CmykColor`) | Clean |
| `grayscale` | function | Yes | Yes (`GrayscaleColor`) | Clean |
| `componentsToColor` | function | Yes | Yes (`Color`) | Clean |
| `colorToComponents` | function | Yes | Yes (`number[]`) | Clean |
| `setFillingColor` | const (alias) | Yes | N/A | Alias of `applyFillColor` |
| `setStrokingColor` | const (alias) | Yes | N/A | Alias of `applyStrokeColor` |
| `RgbColor` | interface | Yes | N/A | Discriminated union member |
| `CmykColor` | interface | Yes | N/A | Discriminated union member |
| `GrayscaleColor` | interface | Yes | N/A | Discriminated union member |
| `Color` | type | Yes | N/A | Union type |

### 1.5 Angle Helpers (`src/core/operators/state.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `degrees` | function | Yes | Yes | Clean |
| `radians` | function | Yes | Yes | Clean |
| `degreesToRadians` | function | Yes | Yes | Clean |
| `radiansToDegrees` | function | Yes | Yes | Clean |
| `Degrees` | interface | Yes | N/A | Branded type |
| `Radians` | interface | Yes | N/A | Branded type |
| `Angle` | type | N/A | N/A | Union |

### 1.6 PDF Value Helpers (`src/utils/pdfValueHelpers.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `asPDFName` | function | Yes | Yes (`PdfName`) | **Issue**: PascalCase "PDF" inconsistent with rest of API (camelCase) |
| `asPDFNumber` | function | Yes | Yes (`PdfNumber`) | Same naming issue |
| `asNumber` | function | Yes | Yes (`number \| undefined`) | Clean |

### 1.7 Enums (`src/core/enums.ts`)

| Export | Kind | Notes |
|--------|------|-------|
| `BlendMode` | enum | Clean |
| `TextRenderingMode` | enum | Clean |
| `LineCapStyle` | enum | Clean |
| `LineJoinStyle` | enum | Clean |
| `TextAlignment` | enum | Clean |
| `ImageAlignment` | enum | Clean |
| `ParseSpeeds` | enum | Clean |

### 1.8 Page Manipulation (`src/core/pageManipulation.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `insertPage` | function | Yes | Yes | Clean |
| `removePage` | function | Yes | Yes | Clean |
| `movePage` | function | Yes | Yes | Clean |
| `rotatePage` | function | Yes | Yes | Clean |
| `cropPage` | function | Yes | Yes | Clean |
| `getPageSize` | function | Yes | Yes | Clean |
| `resizePage` | function | Yes | Yes | Clean |
| `reversePages` | function | Yes | Yes | Clean |
| `removePages` | function | Yes | Yes | Clean |
| `rotateAllPages` | function | Yes | Yes | Clean |
| `CropBox` | type | N/A | N/A | Clean |

### 1.9 Document Merge (`src/core/documentMerge.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `mergePdfs` | function | Yes | Yes (`Promise<PdfDocument>`) | Clean |
| `splitPdf` | function | Yes | Yes | Clean |
| `copyPages` | function | Yes | Yes | Clean |
| `PageRange` | type | N/A | N/A | Clean |

### 1.10 Text Layout (`src/core/layout.ts`)

| Export | Kind | JSDoc | Return Annotated | Notes |
|--------|------|-------|------------------|-------|
| `layoutMultilineText` | function | Yes | Yes | Clean |
| `layoutCombedText` | function | Yes | Yes | Clean |
| `computeFontSize` | function | Yes | Yes | Clean |
| `layoutSinglelineText` | function | Yes | Yes | Clean |
| All option/result types | interface/type | Yes | N/A | Clean |

### 1.11 Incremental Save (`src/core/incrementalWriter.ts`)

| Export | Kind | JSDoc | Notes |
|--------|------|-------|-------|
| `saveIncremental` | function | Yes | Clean |
| `saveDocumentIncremental` | function | Yes | Clean |
| `ChangeTracker` | class | Yes | Clean |
| `IncrementalSaveResult` | type | N/A | Clean |

### 1.12 WASM Initialization (`src/index.ts`)

| Export | Kind | JSDoc | Notes |
|--------|------|-------|-------|
| `initWasm` | function | Yes | Clean, handles legacy signature |
| `InitWasmOptions` | interface | Yes | All fields documented |

### 1.13 Font Embedding (`src/assets/font/`)

| Export | Kind | JSDoc | Notes |
|--------|------|-------|-------|
| `EmbeddedFont` | class | Yes | Clean |
| `extractMetrics` | function | Yes | Clean |
| `isOpenTypeCFF` | function | Yes | Clean |
| `isTrueType` | function | Yes | Clean |
| All types | interface/type | Yes | Clean |

### 1.14 Low-Level Operator API (60+ functions)

All operators are well-documented with JSDoc and have explicit return types (`string`). The `PDFOperator` class provides a first-class wrapper.

**Aliases exported for pdf-lib compatibility:**
- `pushGraphicsState` (alias of `saveState`)
- `popGraphicsState` (alias of `restoreState`)
- `concatTransformationMatrix` (alias of `concatMatrix`)
- `setFontAndSize` (alias of `setFont`)
- `setLineHeight` (alias of `setLeading`)
- `setCharacterSqueeze` (alias of `setCharacterSpacing`)
- `drawObject` (alias of `drawXObject`)

### 1.15 Low-Level PDF Objects (`src/core/pdfObjects.ts`)

| Export | Kind | Notes |
|--------|------|-------|
| `PdfNull`, `PdfBool`, `PdfNumber`, `PdfString`, `PdfName` | class | Clean, immutable |
| `PdfArray`, `PdfDict`, `PdfStream`, `PdfRef` | class | Clean |
| `PdfObjectRegistry` | class | Clean |
| `ByteWriter`, `PdfObject`, `RegistryEntry` | type/interface | Clean |

### 1.16 Parser (`src/parser/index.ts`)

| Export | Kind | JSDoc | Notes |
|--------|------|-------|-------|
| `loadPdf` | function | Yes | Clean |
| `extractText` | function | Yes | Clean |
| `extractTextWithPositions` | function | Yes | Clean |
| `parseContentStream` | function | Yes | Clean |
| `decodeStream` | function | Yes | Clean |
| `PdfParseError` | class | Yes | Clean |
| `formatHexContext` | function | Yes | Clean |
| JBIG2/JPEG2000 functions | various | Yes | Clean |

### 1.17 Signatures (`src/signature/index.ts`)

Large module with 40+ exports covering signing, verification, incremental save, MDP, LTV, counter-signatures, field locks, and document diff. All functions have JSDoc and explicit return types. All option/result types use named interfaces.

### 1.18 Forms (`src/form/index.ts`)

| Export | Kind | Notes |
|--------|------|-------|
| `PdfForm` | class | Clean |
| `PdfField` | class | Clean |
| `FieldFlags` | const | Clean |
| 7 field type classes | class | Clean, all have JSDoc |
| 7 appearance generators | function | Clean |
| All option types | interface | Clean |

### 1.19 Annotations (`src/annotation/index.ts`)

19 annotation classes plus appearance generators and types. All have JSDoc and explicit types.

### 1.20 Remaining Modules

All remaining modules (SVG, linearization, PDF/A compliance, layers, embedded files, watermark, redaction, image optimization, barcode, table layout, errors, browser utilities, WASM loader, base64) follow the same patterns: JSDoc on all exports, explicit return types, named option interfaces.

---

## 2. Inconsistencies Found

### 2.1 CRITICAL — `FontRef` Leaks Internal Members

The `FontRef` interface exports `_isCIDFont` and `_encodeText` members marked `@internal`. These underscore-prefixed members are implementation details that should not be part of the public API.

**Impact**: Consumers could depend on these internal members, preventing future refactoring.

**Recommendation**: For 1.0, split `FontRef` into a public interface and an internal `FontRefInternal` extension:
```ts
// Public
export interface FontRef {
  readonly name: string;
  readonly ref: PdfRef;
  widthOfTextAtSize(text: string, size: number): number;
  heightAtSize(size: number): number;
  sizeAtHeight(height: number): number;
  getCharacterSet(): number[];
}

// Internal (not exported from index.ts)
export interface FontRefInternal extends FontRef {
  readonly _isCIDFont?: boolean;
  _encodeText?(text: string): string;
}
```

### 2.2 MODERATE — `FontRef.sizeAtHeight` and `getCharacterSet` Are Optional

These methods are optional (`sizeAtHeight?`, `getCharacterSet?`) on `FontRef`, but they are always implemented by both standard and TrueType/CFF font embedding. Making them optional forces consumers to null-check unnecessarily.

**Recommendation**: Make them required for 1.0.

### 2.3 MODERATE — `DrawLineOptions` Uses Inline Object Types

`DrawLineOptions.start` and `DrawLineOptions.end` are typed as `{ x: number; y: number }` inline rather than using a named `Point` interface.

**Recommendation**: Extract a `Point` interface and reuse it:
```ts
export interface Point {
  readonly x: number;
  readonly y: number;
}
```

### 2.4 MODERATE — `DrawPageOptions` Uses Inline Angle Types

`DrawPageOptions.rotate`, `.xSkew`, `.ySkew` are typed as `{ type: 'degrees' | 'radians'; value: number }` instead of using the `Angle` type from `state.ts`. This is inconsistent with `DrawTextOptions` and other draw options which use `Angle`.

**Recommendation**: Change to use `Angle` for consistency.

### 2.5 LOW — `asPDFName` / `asPDFNumber` Naming

These use `PDF` in all-caps, while the rest of the codebase uses `Pdf` in PascalCase (e.g., `PdfName`, `PdfDocument`). The helpers exist for pdf-lib compatibility.

**Recommendation**: Add `asPdfName` / `asPdfNumber` aliases and deprecate the `PDF` variants for 1.0.

### 2.6 LOW — `DrawCircleOptions.size` Deprecated But Still Exported

The `size` property on `DrawCircleOptions` is marked `@deprecated` in favor of `radius`, but is still part of the public type.

**Recommendation**: Remove in 1.0 (major version allows breaking changes).

### 2.7 LOW — `PdfDocument.embedPng` Sync vs `embedJpeg` Async Inconsistency

`embedPng()` is synchronous (returns `ImageRef`), while `embedJpeg()` is async (returns `Promise<ImageRef>`). While documented and intentional (JPEG parsing is deferred), this is a usability surprise.

**Recommendation**: Document clearly in 1.0 migration guide. Consider making both async for API uniformity, wrapping the sync return in `Promise.resolve()`.

### 2.8 LOW — `setFillingColor` / `setStrokingColor` Redundant Aliases

These are aliases of `applyFillColor` / `applyStrokeColor` for pdf-lib compatibility. Having two names for the same function is confusing.

**Recommendation**: Deprecate the aliases for 1.0 and document the canonical names.

### 2.9 LOW — Operator Re-export Alias Explosion

The `src/index.ts` re-exports ~60 operator functions with `as ...Op` suffixes to avoid name collisions (e.g., `rectangle as rectangleOp`, `fill as fillOp`). This creates a large flat namespace.

**Recommendation**: Consider a namespaced export for 1.0:
```ts
export * as operators from './core/operators/index.js';
```

### 2.10 INFO — `TransparencyGroupOptions` Fields Missing `| undefined`

Properties `isolated`, `knockout`, and `colorSpace` on `TransparencyGroupOptions` are typed as optional (`?`) but do not include explicit `| undefined`. While functionally equivalent in TypeScript, the rest of the codebase consistently uses `| undefined` for exactOptionalPropertyTypes support.

**Recommendation**: Add `| undefined` for consistency.

### 2.11 INFO — `copyPagesToTarget` Is Exported with `@internal`

`copyPagesToTarget` in `documentMerge.ts` is marked `@internal` but is `export function`. It is not re-exported from `index.ts`, so this is not a public API issue, but worth noting.

---

## 3. Type Safety Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| No `any` in public APIs | PASS | Zero `any` types found in exported signatures |
| No loose `object` types | PASS | No `object` type used |
| No `unknown` in return types | PASS | Only used in catch clauses |
| Explicit return annotations | PASS | All exported functions have explicit return types |
| Discriminated unions | PASS | `Color`, `Angle` use `type` discriminant |
| Options use `interface` | PASS | All option types are named interfaces |
| `readonly` on data interfaces | MOSTLY | `FontRef`, `ImageRef`, `EmbeddedPdfPage` use `readonly` |

---

## 4. Documentation Coverage

| Area | JSDoc Coverage | Notes |
|------|---------------|-------|
| Core classes | 100% | `PdfDocument`, `PdfPage`, `PdfObjectRegistry` |
| Factory functions | 100% | `createPdf`, `loadPdf`, `rgb`, `cmyk`, etc. |
| Drawing options | 100% | All fields documented |
| Operator functions | 100% | All 60+ operators documented |
| Enums | 100% | All values documented |
| Error classes | 100% | All constructors documented |
| Signature module | 100% | Complex but thorough |
| Form module | 100% | All 7 field types documented |
| Parser module | 100% | All functions documented |

---

## 5. Naming Consistency Assessment

| Convention | Status | Exceptions |
|------------|--------|------------|
| camelCase functions | PASS | `asPDFName`, `asPDFNumber` (pdf-lib compat) |
| PascalCase classes | PASS | None |
| PascalCase interfaces | PASS | None |
| PascalCase enums | PASS | None |
| camelCase properties | PASS | `_isCIDFont`, `_encodeText` (internal) |
| `Pdf` prefix for classes | PASS | `PDFOperator` (pdf-lib compat) |

---

## 6. Recommendations for 1.0 API Freeze

### Must Fix (Breaking Changes OK in 1.0)

1. **Split `FontRef` internal members** -- Remove `_isCIDFont` and `_encodeText` from the public interface
2. **Make `sizeAtHeight()` and `getCharacterSet()` required** on `FontRef`
3. **Remove `DrawCircleOptions.size`** (deprecated since v0.x)
4. **Align `DrawPageOptions` angle types** with the `Angle` union used everywhere else

### Should Fix

5. **Extract `Point` interface** for `{ x, y }` pairs used in `DrawLineOptions`
6. **Add `| undefined` to `TransparencyGroupOptions`** optional fields
7. **Add `asPdfName`/`asPdfNumber` aliases** and deprecate `asPDFName`/`asPDFNumber`
8. **Deprecate `setFillingColor`/`setStrokingColor`** in favor of `applyFillColor`/`applyStrokeColor`

### Consider for 1.0

9. **Namespace operator exports** under `operators.*` to reduce flat API surface
10. **Unify embed sync/async** -- make `embedPng` async for API consistency
11. **Rename `PDFOperator` to `PdfOperator`** for casing consistency
12. **Audit the 40+ signature exports** -- consider grouping under `signature.*` sub-export

### API Freeze Checklist

- [ ] All items in "Must Fix" resolved
- [ ] Deprecation warnings added for "Should Fix" items
- [ ] Semver policy documented in VERSIONING.md
- [ ] TypeDoc API reference regenerated
- [ ] Integration test suite covers all public exports
- [ ] CHANGELOG documents all breaking changes from 0.x
