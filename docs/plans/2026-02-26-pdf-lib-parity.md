# pdf-lib Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 39 features that pdf-lib has but modern-pdf lacks, achieving full API parity.

**Architecture:** Extend existing patterns — options interfaces, operator functions, typed enums. All changes are additive (no breaking changes). Files touched: `pdfPage.ts`, `pdfDocument.ts`, `pdfEmbed.ts`, `enums.ts`, `operators/*.ts`, `pdfForm.ts`, `form/fields/*.ts`, `pdfField.ts`, `layout.ts`, `index.ts`, `options.ts`, plus new files for errors and operator exports.

**Tech Stack:** TypeScript, ESM-only, no external dependencies.

---

## Pre-existing (already done — verify only)

- Item 23: `setLanguage()` / `getLanguage()` — already on PdfDocument
- Item 34: `updateMetadata` — already in LoadPdfOptions
- Item 21 (partial): `isNoExport()` flag — exists on PdfField base class
- Item 22 (partial): `deleteXFA()` — exists on PdfForm

---

### Task 1: Constants & Enums (Items 8–14)

**Files:**
- Modify: `src/core/pdfPage.ts` (PageSizes)
- Modify: `src/core/enums.ts` (new enums)
- Modify: `src/types/options.ts` (PredefinedPageSize)
- Modify: `src/index.ts` (exports)

**Changes:**
1. Add ISO C series (C0–C10), RA series (RA0–RA4), SRA series (SRA0–SRA4) to `PageSizes`
2. Add `LineCapStyle` enum: `{ Butt: 0, Round: 1, Projecting: 2 }`
3. Add `LineJoinStyle` enum: `{ Miter: 0, Round: 1, Bevel: 2 }`
4. Add `TextAlignment` enum: `{ Left: 0, Center: 1, Right: 2 }`
5. Add `ImageAlignment` enum: `{ Left: 0, Center: 1, Right: 2 }`
6. Add `ParseSpeeds` preset: `{ Fastest: Infinity, Fast: 500, Medium: 100, Slow: 10 }`
7. Update `PredefinedPageSize` type to include new sizes
8. Export all from `index.ts`

---

### Task 2: Utility Functions (Items 27, 29–32)

**Files:**
- Modify: `src/core/operators/color.ts` (color utils)
- Modify: `src/core/operators/state.ts` (angle utils)
- Create: `src/utils/pdfValueHelpers.ts` (asPDFName, etc.)
- Modify: `src/index.ts` (exports)

**Changes:**
1. Add `componentsToColor(comps: number[]): Color` — [g] → grayscale, [r,g,b] → rgb, [c,m,y,k] → cmyk
2. Add `colorToComponents(color: Color): number[]` — inverse
3. Export `setFillColor` and `setStrokeColor` under pdf-lib-compatible aliases `setFillingColor` / `setStrokingColor`
4. Export `degreesToRadians(deg)` and `radiansToDegrees(rad)` convenience functions
5. Add `asPDFName(value: string): PdfName`, `asPDFNumber(value: number): PdfNumber`, `asNumber(obj: PdfObject): number | undefined`

---

### Task 3: Drawing Enhancements (Items 1–7)

**Files:**
- Modify: `src/core/pdfPage.ts` (options interfaces + draw methods)

**Changes:**
1. Add to `DrawImageOptions`: `xSkew?: Angle`, `ySkew?: Angle`
2. Add to `DrawRectangleOptions`: `xSkew?: Angle`, `ySkew?: Angle`, `borderDashArray?: number[]`, `borderDashPhase?: number`, `borderLineCap?: 0|1|2`, `borderOpacity?: number`
3. Add to `DrawSquareOptions`: same as rectangle
4. Add to `DrawCircleOptions`: `borderDashArray?: number[]`, `borderDashPhase?: number`, `borderLineCap?: 0|1|2`, `borderOpacity?: number`
5. Add to `DrawEllipseOptions`: same as circle
6. Add to `DrawSvgPathOptions`: `borderDashArray?: number[]`, `borderDashPhase?: number`, `borderLineCap?: 0|1|2`, `borderOpacity?: number`
7. Add to `DrawPageOptions` (in pdfEmbed.ts): `xSkew?: Angle`, `ySkew?: Angle`
8. Update `drawImage()`: build skew matrix when xSkew/ySkew present
9. Update `drawRectangle()`: apply dash pattern, line cap, separate border opacity via split ExtGState
10. Update `drawSquare()`: pass through new options
11. Update `drawCircle()`: apply dash pattern, line cap, border opacity
12. Update `drawEllipse()`: same
13. Update `drawSvgPath()`: same
14. Update `drawPage()`: build skew matrix when xSkew/ySkew present
15. Update `getOrCreateExtGState()`: support separate fill opacity (`/ca`) vs stroke opacity (`/CA`)

---

### Task 4: Font API (Items 15–17)

**Files:**
- Modify: `src/core/pdfPage.ts` (FontRef interface)
- Modify: `src/core/pdfDocument.ts` (embedFont, EmbedFontOptions)
- Modify: `src/assets/font/fontEmbed.ts` (EmbeddedFont)

**Changes:**
1. Add `sizeAtHeight(height: number): number` to FontRef — inverse of heightAtSize (binary search)
2. Add `getCharacterSet(): number[]` to FontRef — returns supported Unicode codepoints
3. Add `customName?: string` to `EmbedFontOptions` — overrides PostScript name in font dictionary

---

### Task 5: Text Layout (Item 18)

**Files:**
- Modify: `src/core/layout.ts`
- Modify: `src/index.ts`

**Changes:**
1. Add `layoutSinglelineText(text, options)` returning `{ line: { text, width, height }, baselines: { ... } }`
2. Export from index.ts

---

### Task 6: Metadata (Item 24)

**Files:**
- Modify: `src/core/pdfDocument.ts` (setTitle signature)

**Changes:**
1. Add `SetTitleOptions` interface with `showInWindowTitleBar?: boolean`
2. Update `setTitle()` to accept optional second parameter `options?: SetTitleOptions`
3. When `showInWindowTitleBar` is true, auto-set ViewerPreferences.DisplayDocTitle = true

---

### Task 7: Load Options (Items 33, 35)

**Files:**
- Modify: `src/parser/documentParser.ts` (LoadPdfOptions)
- Modify parser implementation

**Changes:**
1. Add `throwOnInvalidObject?: boolean` to LoadPdfOptions
2. Add `capNumbers?: boolean` to LoadPdfOptions
3. Wire into parser: throw on malformed objects when flag is set, clamp extreme floats when capNumbers is set

---

### Task 8: Typed Error Classes (Item 28)

**Files:**
- Create: `src/errors.ts`
- Modify: `src/index.ts`

**Changes:**
1. Create 13 typed error classes extending Error:
   - `EncryptedPdfError`
   - `FontNotEmbeddedError`
   - `ForeignPageError`
   - `RemovePageFromEmptyDocumentError`
   - `NoSuchFieldError`
   - `UnexpectedFieldTypeError`
   - `MissingOnValueCheckError`
   - `FieldAlreadyExistsError`
   - `InvalidFieldNamePartError`
   - `FieldExistsAsNonTerminalError`
   - `RichTextFieldReadError`
   - `CombedTextLayoutError`
   - `ExceededMaxLengthError`
2. Export all from index.ts
3. Use them in relevant locations (forms, parser, etc.)

---

### Task 9: Low-Level Operator API (Items 25–26)

**Files:**
- Create: `src/core/operators/index.ts` (barrel export)
- Modify: `src/index.ts`

**Changes:**
1. Create barrel export re-exporting all 60+ operator functions from graphics.ts, color.ts, state.ts, text.ts, image.ts
2. Create `PDFOperator` class wrapping operator name + operands
3. Add `PDFOperator.of(name, ...operands)` factory
4. Export everything from index.ts

---

### Task 10: Forms — addToPage, appearance providers, hasXFA, isExported (Items 19–22)

**Files:**
- Modify: `src/form/pdfField.ts` (isExported/enableExporting/disableExporting)
- Modify: `src/form/pdfForm.ts` (hasXFA, createField methods with addToPage)
- Modify: `src/form/fields/*.ts` (addToPage on each field type)
- Modify: `src/index.ts`

**Changes:**
1. Add `isExported()`, `enableExporting()`, `disableExporting()` to PdfField
2. Add `hasXFA(): boolean` to PdfForm
3. Add `addToPage(page, options)` to each field type: PdfTextField, PdfCheckboxField, PdfDropdownField, PdfListboxField, PdfRadioGroup, PdfButtonField
4. Add `AppearanceProviderFor<T>` type — callback `(field: T, widget: PdfDict) => PdfStream`
5. Add `updateAppearances(provider?)` method accepting optional custom provider

---

### Task 11: Page Embedding (Items 36–37)

**Files:**
- Modify: `src/core/pdfEmbed.ts` (EmbeddedPdfPage, embedPageAsFormXObject)
- Modify: `src/core/pdfDocument.ts` (embedPdf/embedPage signatures)

**Changes:**
1. Add `boundingBox?: { x, y, width, height }` to embed options — clips Form XObject to sub-region
2. Add `transformationMatrix?: [number, number, number, number, number, number]` — applies affine transform to Form XObject's /Matrix

---

### Task 12: Image on Form Fields (Items 38–39)

**Files:**
- Modify: `src/form/fields/buttonField.ts`
- Modify: `src/form/fields/textField.ts`

**Changes:**
1. Add `setImage(image: ImageRef)` to PdfButtonField — sets image in /AP /N appearance stream
2. Add `setImage(image: ImageRef)` to PdfTextField — sets image in /AP /N appearance stream

---

## Execution Order

Tasks 1–2 are independent foundations → can run in parallel.
Task 3 depends on Task 1 (uses new enums).
Tasks 4–9 are mostly independent of each other.
Task 10 depends on Task 8 (uses error classes).
Tasks 11–12 are independent.

All tasks end with: run tests, commit.
