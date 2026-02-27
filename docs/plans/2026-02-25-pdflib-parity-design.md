# pdf-lib Feature Parity — Design Document

Date: 2026-02-25
Goal: Implement all remaining features that pdf-lib has but modern-pdf lacks, achieving complete feature superiority.

## Items Already Implemented (removed from scope)

- `removeField()` — already exists in pdfForm.ts
- `createButton()` — already exists in pdfForm.ts
- `createListbox()` — already exists in pdfForm.ts
- Default font/size/color private fields — already exist on PdfPage

## Batch 1: Constants & Enums

### 1a. Complete PageSizes

Add to existing `PageSizes` in `pdfPage.ts`:

- ISO A series gaps: `4A0`, `2A0`, `A7`, `A8`, `A9`, `A10`
- ISO B series gaps: `B0`, `B1`, `B2`, `B3`, `B6`, `B7`, `B8`, `B9`, `B10`
- US: `Folio` [612, 936]

All values in PDF points (72 pts = 1 inch).

### 1b. BlendMode enum

New file `src/core/blendMode.ts`:

```typescript
export const BlendMode = {
  Normal: 'Normal',
  Multiply: 'Multiply',
  Screen: 'Screen',
  Overlay: 'Overlay',
  Darken: 'Darken',
  Lighten: 'Lighten',
  ColorDodge: 'ColorDodge',
  ColorBurn: 'ColorBurn',
  HardLight: 'HardLight',
  SoftLight: 'SoftLight',
  Difference: 'Difference',
  Exclusion: 'Exclusion',
} as const;
export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];
```

Applied via ExtGState `/BM` key. Extend `getOrCreateExtGState()` to accept optional blend mode. Cache key changes to `${opacity}:${blendMode}`.

### 1c. TextRenderingMode enum

In `src/core/blendMode.ts` (or own file):

```typescript
export const TextRenderingMode = {
  Fill: 0,
  Outline: 1,
  FillAndOutline: 2,
  Invisible: 3,
  FillAndClip: 4,
  OutlineAndClip: 5,
  FillAndOutlineAndClip: 6,
  Clip: 7,
} as const;
export type TextRenderingMode = (typeof TextRenderingMode)[keyof typeof TextRenderingMode];
```

Applied via `Tr` operator in drawText().

## Batch 2: PdfPage Drawing Enhancements

### 2a. drawSquare()

```typescript
interface DrawSquareOptions {
  x?: number | undefined;
  y?: number | undefined;
  size?: number | undefined;  // default 100
  color?: Color | undefined;
  borderColor?: Color | undefined;
  borderWidth?: number | undefined;
  rotate?: Angle | undefined;
  opacity?: number | undefined;
  blendMode?: BlendMode | undefined;
}
```

Delegates to `drawRectangle({ ...options, width: size, height: size })`.

### 2b. Text skew

Add `xSkew?: Angle`, `ySkew?: Angle` to `DrawTextOptions`. In drawText(), when rotation or skew is present, compute full affine text matrix incorporating `tan(xSkew)` and `tan(ySkew)`.

### 2c. BlendMode on all draw options

Add `blendMode?: BlendMode | undefined` to: DrawTextOptions, DrawImageOptions, DrawRectangleOptions, DrawLineOptions, DrawCircleOptions, DrawEllipseOptions, DrawSvgPathOptions, DrawPageOptions.

## Batch 3: PdfPage State & Transforms

### 3a. Cursor position system

Private state: `_cursorX = 0`, `_cursorY = 0`.

Methods: `getPosition()`, `getX()`, `getY()`, `moveTo(x, y)`, `moveUp(amount)`, `moveDown(amount)`, `moveLeft(amount)`, `moveRight(amount)`, `resetPosition()`.

Drawing methods use cursor as fallback: `options.x ?? this._cursorX`.

### 3b. Public setters for defaults

Verify `setFont()`, `setFontSize()`, `setFontColor()`, `setLineHeight()` are public. Add if missing.

### 3c. resetSize()

Store `_originalWidth`/`_originalHeight` in constructor. `resetSize()` restores them.

### 3d. translateContent(x, y)

Prepend `concatMatrix(1, 0, 0, 1, x, y)` to `this.ops`.

### 3e. scale(), scaleContent(), scaleAnnotations()

- `scaleContent(x, y)` — prepend scale matrix to ops
- `scaleAnnotations(x, y)` — multiply annotation rects by factors
- `scale(x, y)` — resize page + scaleContent + scaleAnnotations

## Batch 4: PdfDocument Enhancements

### 4a. Data URI input

In `loadPdf()`, strip `data:[mime];base64,` prefix before base64 decode.

### 4b. embedPages() batch

```typescript
async embedPages(pages: PdfPage[]): Promise<EmbeddedPdfPage[]>
```

Maps over `embedPage()`.

### 4c. addDefaultPage on save

Add `addDefaultPage?: boolean` (default true) to `PdfSaveOptions`. If true and pageCount === 0, add a blank page before serialization.

### 4d. parseSpeed / yield throttling

Add `objectsPerTick?: number` (default Infinity) to `LoadPdfOptions`. Yield to event loop every N objects during parsing.

## Batch 5: Forms

### 5a. updateFieldAppearances auto on save

Add `updateFieldAppearances?: boolean` (default true) to `PdfSaveOptions`. Before building structure, regenerate all field appearances if enabled.

## Batch 6: Text Layout

### 6a. Custom word breaks

Add `wordBreaks?: string[]` to `DrawTextOptions`. Pass through to `wrapText()`.

### 6b. Layout helpers (`src/core/layout.ts`)

Three functions:
- `layoutMultilineText(text, { font, fontSize, maxWidth, lineHeight?, wordBreaks? })` — returns `{ lines: Array<{ text, width }>, height }`
- `layoutCombedText(text, { font, fontSize, cellCount, cellWidth })` — returns `Array<{ char, x, width }>`
- `computeFontSize(text, { font, maxWidth, maxHeight?, lineHeight?, minSize?, maxSize?, wordBreaks? })` — binary search for largest fitting size

## Batch 7: Fonts

### 7a. OTF (CFF-based OpenType) embedding

New files: `src/assets/font/cffEmbed.ts`, `src/assets/font/otfDetect.ts`.

Detect CFF via `OTTO` magic bytes. Parse shared OpenType tables (cmap, head, hhea, hmtx, etc.). Extract raw CFF table. Create CIDFont Type0 with `/FontFile3 /Subtype /CIDFontType0C`. Full CFF subsetting deferred to WASM acceleration.

### 7b. OpenType feature flags

Add `EmbedFontOptions` to `embedFont()`:

```typescript
interface EmbedFontOptions {
  subset?: boolean;
  features?: Record<string, boolean>;  // e.g. { liga: true, kern: true }
}
```

Basic kern support via `kern`/`GPOS` table parsing. Basic liga support via `GSUB` standard ligature lookup. Full shaping deferred to WASM.

## Batch 8: Viewer Preferences Class

New file: `src/metadata/pdfViewerPreferences.ts`.

`PdfViewerPreferences` class with 14 getter/setter pairs: hideToolbar, hideMenubar, hideWindowUI, fitWindow, centerWindow, displayDocTitle, nonFullScreenPageMode, direction, printScaling, duplex, numCopies, pickTrayByPDFSize, printPageRange.

PdfDocument.getViewerPreferences() returns class instance. setViewerPreferences() accepts plain object or class instance.

## File Impact Summary

| Batch | New Files | Modified Files |
|-------|-----------|----------------|
| 1 | `src/core/blendMode.ts` | `pdfPage.ts`, `index.ts` |
| 2 | — | `pdfPage.ts`, `index.ts` |
| 3 | — | `pdfPage.ts` |
| 4 | — | `pdfDocument.ts`, `documentParser.ts`, `pdfWriter.ts` |
| 5 | — | `pdfDocument.ts` |
| 6 | `src/core/layout.ts` | `pdfPage.ts`, `index.ts` |
| 7 | `cffEmbed.ts`, `otfDetect.ts` | `fontEmbed.ts`, `fontMetrics.ts`, `pdfDocument.ts` |
| 8 | `pdfViewerPreferences.ts` | `viewerPreferences.ts`, `pdfDocument.ts`, `index.ts` |
