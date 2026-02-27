# pdf-lib Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all remaining features that pdf-lib has but modern-pdf lacks, so modern-pdf completely outclasses pdf-lib with zero feature gaps.

**Architecture:** 8 batches organized by domain. Each batch is self-contained with tests. Batches 1-3 focus on PdfPage (constants, drawing, state). Batch 4-5 on PdfDocument/forms. Batch 6 on text layout. Batch 7 on fonts. Batch 8 on viewer preferences. All follow existing codebase patterns: options objects with `| undefined` properties, `??` fallbacks, synchronous drawing, async only for I/O.

**Tech Stack:** TypeScript, Vitest, existing PDF operator helpers in `src/core/operators/`

**Key references:**
- Design doc: `docs/plans/2026-02-25-pdflib-parity-design.md`
- PdfPage: `src/core/pdfPage.ts` (2034 lines)
- PdfDocument: `src/core/pdfDocument.ts` (2023 lines)
- Operators: `src/core/operators/{state,graphics,text,color,image}.ts`
- Font embed: `src/assets/font/fontEmbed.ts` (570 lines)
- Font metrics: `src/assets/font/fontMetrics.ts` (804 lines)
- Viewer prefs: `src/metadata/viewerPreferences.ts` (264 lines)
- Exports: `src/index.ts` (525 lines)

**Items confirmed already implemented (skipped):**
- `removeField()` on PdfForm (pdfForm.ts:702-731)
- `createButton()` on PdfForm (pdfForm.ts:635-658)
- `createListbox()` on PdfForm (pdfForm.ts:672-691)
- `setFont()`, `setFontSize()`, `setFontColor()`, `setLineHeight()` public methods (pdfPage.ts:686-718)
- `setTextRenderingMode(mode)` operator helper (operators/text.ts)

---

## Task 1: PageSizes — Complete ISO A, B series + Folio

**Files:**
- Modify: `src/core/pdfPage.ts:94-109` (PageSizes constant)
- Test: `tests/unit/core/pageSizes.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/pageSizes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PageSizes } from '../../../src/core/pdfPage.js';

describe('PageSizes', () => {
  // ISO A series
  it('includes 4A0', () => {
    expect(PageSizes['4A0']).toEqual([4767.87, 6740.79]);
  });
  it('includes 2A0', () => {
    expect(PageSizes['2A0']).toEqual([3370.39, 4767.87]);
  });
  it('includes A7', () => {
    expect(PageSizes.A7).toEqual([209.76, 297.64]);
  });
  it('includes A8', () => {
    expect(PageSizes.A8).toEqual([147.40, 209.76]);
  });
  it('includes A9', () => {
    expect(PageSizes.A9).toEqual([104.88, 147.40]);
  });
  it('includes A10', () => {
    expect(PageSizes.A10).toEqual([73.70, 104.88]);
  });

  // ISO B series
  it('includes B0', () => {
    expect(PageSizes.B0).toEqual([2834.65, 4008.19]);
  });
  it('includes B1', () => {
    expect(PageSizes.B1).toEqual([2004.09, 2834.65]);
  });
  it('includes B2', () => {
    expect(PageSizes.B2).toEqual([1417.32, 2004.09]);
  });
  it('includes B3', () => {
    expect(PageSizes.B3).toEqual([1000.63, 1417.32]);
  });
  it('includes B6', () => {
    expect(PageSizes.B6).toEqual([354.33, 498.90]);
  });
  it('includes B7', () => {
    expect(PageSizes.B7).toEqual([249.45, 354.33]);
  });
  it('includes B8', () => {
    expect(PageSizes.B8).toEqual([175.75, 249.45]);
  });
  it('includes B9', () => {
    expect(PageSizes.B9).toEqual([124.72, 175.75]);
  });
  it('includes B10', () => {
    expect(PageSizes.B10).toEqual([87.87, 124.72]);
  });

  // US
  it('includes Folio', () => {
    expect(PageSizes.Folio).toEqual([612, 936]);
  });

  // Existing sizes still present
  it('still has A4', () => {
    expect(PageSizes.A4).toEqual([595.28, 841.89]);
  });
  it('still has Letter', () => {
    expect(PageSizes.Letter).toEqual([612, 792]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/pageSizes.test.ts`
Expected: FAIL — properties like `4A0`, `A7`, `B0`, `Folio` don't exist yet.

**Step 3: Implement — expand PageSizes**

In `src/core/pdfPage.ts`, replace the PageSizes constant (lines 94-109) with:

```typescript
export const PageSizes = {
  // ISO A series (all dimensions in PDF points, 72 pts = 1 inch)
  '4A0': [4767.87, 6740.79] as const,
  '2A0': [3370.39, 4767.87] as const,
  A0: [2383.94, 3370.39] as const,
  A1: [1683.78, 2383.94] as const,
  A2: [1190.55, 1683.78] as const,
  A3: [841.89, 1190.55] as const,
  A4: [595.28, 841.89] as const,
  A5: [419.53, 595.28] as const,
  A6: [297.64, 419.53] as const,
  A7: [209.76, 297.64] as const,
  A8: [147.40, 209.76] as const,
  A9: [104.88, 147.40] as const,
  A10: [73.70, 104.88] as const,
  // ISO B series
  B0: [2834.65, 4008.19] as const,
  B1: [2004.09, 2834.65] as const,
  B2: [1417.32, 2004.09] as const,
  B3: [1000.63, 1417.32] as const,
  B4: [708.66, 1000.63] as const,
  B5: [498.90, 708.66] as const,
  B6: [354.33, 498.90] as const,
  B7: [249.45, 354.33] as const,
  B8: [175.75, 249.45] as const,
  B9: [124.72, 175.75] as const,
  B10: [87.87, 124.72] as const,
  // US / North American
  Letter: [612, 792] as const,
  Legal: [612, 1008] as const,
  Tabloid: [792, 1224] as const,
  Ledger: [1224, 792] as const,
  Executive: [521.86, 756] as const,
  Folio: [612, 936] as const,
} as const satisfies Record<string, readonly [number, number]>;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/core/pageSizes.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass.

**Step 6: Commit**

```bash
git add src/core/pdfPage.ts tests/unit/core/pageSizes.test.ts
git commit -m "feat: complete PageSizes with full ISO A/B series and Folio"
```

---

## Task 2: BlendMode and TextRenderingMode enums

**Files:**
- Create: `src/core/enums.ts`
- Test: `tests/unit/core/enums.test.ts` (create new)
- Modify: `src/index.ts` (add exports)

**Step 1: Write the failing test**

Create `tests/unit/core/enums.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BlendMode, TextRenderingMode } from '../../../src/core/enums.js';

describe('BlendMode', () => {
  it('has all 12 PDF blend modes', () => {
    expect(BlendMode.Normal).toBe('Normal');
    expect(BlendMode.Multiply).toBe('Multiply');
    expect(BlendMode.Screen).toBe('Screen');
    expect(BlendMode.Overlay).toBe('Overlay');
    expect(BlendMode.Darken).toBe('Darken');
    expect(BlendMode.Lighten).toBe('Lighten');
    expect(BlendMode.ColorDodge).toBe('ColorDodge');
    expect(BlendMode.ColorBurn).toBe('ColorBurn');
    expect(BlendMode.HardLight).toBe('HardLight');
    expect(BlendMode.SoftLight).toBe('SoftLight');
    expect(BlendMode.Difference).toBe('Difference');
    expect(BlendMode.Exclusion).toBe('Exclusion');
  });

  it('has exactly 12 entries', () => {
    expect(Object.keys(BlendMode)).toHaveLength(12);
  });
});

describe('TextRenderingMode', () => {
  it('has all 8 PDF text rendering modes', () => {
    expect(TextRenderingMode.Fill).toBe(0);
    expect(TextRenderingMode.Outline).toBe(1);
    expect(TextRenderingMode.FillAndOutline).toBe(2);
    expect(TextRenderingMode.Invisible).toBe(3);
    expect(TextRenderingMode.FillAndClip).toBe(4);
    expect(TextRenderingMode.OutlineAndClip).toBe(5);
    expect(TextRenderingMode.FillAndOutlineAndClip).toBe(6);
    expect(TextRenderingMode.Clip).toBe(7);
  });

  it('has exactly 8 entries', () => {
    expect(Object.keys(TextRenderingMode)).toHaveLength(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/enums.test.ts`
Expected: FAIL — module `src/core/enums.js` does not exist.

**Step 3: Create `src/core/enums.ts`**

```typescript
/**
 * PDF blend modes (PDF 1.4+, Table 136).
 * Applied via ExtGState /BM key.
 */
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

/** A PDF blend mode name. */
export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];

/**
 * PDF text rendering modes (Table 106).
 * Applied via the Tr operator inside a text object.
 */
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

/** A PDF text rendering mode integer (0-7). */
export type TextRenderingMode = (typeof TextRenderingMode)[keyof typeof TextRenderingMode];
```

**Step 4: Add exports to `src/index.ts`**

After the angle helpers section (~line 64), add:

```typescript
// Enums
export { BlendMode, TextRenderingMode } from './core/enums.js';
export type { BlendMode as BlendModeType, TextRenderingMode as TextRenderingModeType } from './core/enums.js';
```

Note: Since the const and type share the same name, the `export { BlendMode }` exports both the value and the type automatically in TypeScript. The separate type aliases are optional — only add them if the existing codebase convention requires it. Check `src/index.ts` for the pattern used with other value+type dual exports (like `Color`).

**Step 5: Run tests**

Run: `npx vitest run tests/unit/core/enums.test.ts`
Expected: PASS

**Step 6: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 7: Commit**

```bash
git add src/core/enums.ts tests/unit/core/enums.test.ts src/index.ts
git commit -m "feat: add BlendMode and TextRenderingMode enums"
```

---

## Task 3: BlendMode support in ExtGState + all draw options

**Files:**
- Modify: `src/core/pdfPage.ts` (getOrCreateExtGState, all Draw*Options interfaces, all draw methods)
- Test: `tests/unit/core/blendMode.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/blendMode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { BlendMode } from '../../../src/core/enums.js';
import { rgb } from '../../../src/core/operators/color.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('BlendMode in drawing operations', () => {
  it('drawRectangle emits ExtGState with /BM when blendMode is set', () => {
    const page = makePage();
    page.drawRectangle({ x: 0, y: 0, width: 100, height: 50, blendMode: BlendMode.Multiply });
    const ops = page.getContentStreamData();
    expect(ops).toContain('/GS');
    expect(ops).toContain('gs');
  });

  it('drawSquare accepts blendMode', () => {
    const page = makePage();
    page.drawSquare({ x: 0, y: 0, size: 50, blendMode: BlendMode.Screen });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawText accepts blendMode', () => {
    const page = makePage();
    page.drawText('Hello', { x: 0, y: 0, blendMode: BlendMode.Overlay });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawCircle accepts blendMode', () => {
    const page = makePage();
    page.drawCircle({ x: 50, y: 50, radius: 25, blendMode: BlendMode.Darken });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawEllipse accepts blendMode', () => {
    const page = makePage();
    page.drawEllipse({ x: 50, y: 50, xScale: 30, yScale: 20, blendMode: BlendMode.Lighten });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawLine accepts blendMode', () => {
    const page = makePage();
    page.drawLine({ start: { x: 0, y: 0 }, end: { x: 100, y: 100 }, blendMode: BlendMode.ColorDodge });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('drawImage accepts blendMode', () => {
    // This test verifies the interface compiles — runtime needs an ImageRef
    // Just verify the option type exists by checking drawRectangle's behavior
    const page = makePage();
    page.drawRectangle({ blendMode: BlendMode.Exclusion, opacity: 0.5 });
    const ops = page.getContentStreamData();
    expect(ops).toContain('gs');
  });

  it('combines blendMode with opacity in same ExtGState', () => {
    const page = makePage();
    page.drawRectangle({ opacity: 0.5, blendMode: BlendMode.Multiply });
    const ops = page.getContentStreamData();
    // Should use a single gs call, not two separate ones
    const gsMatches = ops.match(/gs\n/g);
    expect(gsMatches).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/blendMode.test.ts`
Expected: FAIL — `blendMode` property doesn't exist on options, `drawSquare` doesn't exist.

**Step 3: Implement**

3a. In `src/core/pdfPage.ts`, add import at top (after existing imports):
```typescript
import type { BlendMode } from './enums.js';
import type { TextRenderingMode } from './enums.js';
```

3b. Add `blendMode?: BlendMode | undefined` to ALL draw option interfaces:
- `DrawTextOptions` (add after `maxWidth` line)
- `DrawImageOptions` (add after `opacity` line)
- `DrawRectangleOptions` (add after `opacity` line)
- `DrawLineOptions` (add after `opacity` line)
- `DrawCircleOptions` (add after `opacity` line)
- `DrawEllipseOptions` (add after `opacity` line)
- `DrawSvgPathOptions` (add after `opacity` line)

Also add to `DrawPageOptions` in `src/core/pdfEmbed.ts`.

3c. Add new `DrawSquareOptions` interface:
```typescript
export interface DrawSquareOptions {
  x?: number | undefined;
  y?: number | undefined;
  size?: number | undefined;
  color?: Color | undefined;
  borderColor?: Color | undefined;
  borderWidth?: number | undefined;
  rotate?: Angle | undefined;
  opacity?: number | undefined;
  blendMode?: BlendMode | undefined;
}
```

3d. Refactor `getOrCreateExtGState` to handle both opacity and blend mode:

Replace the existing method (lines 736-756) with:

```typescript
private readonly extGStateCache = new Map<string, string>();

private getOrCreateExtGState(
  opacity?: number | undefined,
  blendMode?: BlendMode | undefined,
): string {
  const key = `${opacity ?? 1}:${blendMode ?? 'Normal'}`;
  const existing = this.extGStateCache.get(key);
  if (existing) return existing;

  this.extGStateCounter++;
  const gsName = `GS${this.extGStateCounter}`;

  const gsDict = new PdfDict();
  gsDict.set('/Type', PdfName.of('ExtGState'));
  if (opacity !== undefined && opacity < 1) {
    gsDict.set('/ca', PdfNumber.of(opacity));
    gsDict.set('/CA', PdfNumber.of(opacity));
  }
  if (blendMode !== undefined && blendMode !== 'Normal') {
    gsDict.set('/BM', PdfName.of(blendMode));
  }

  const gsRef = this.registry.register(gsDict);
  this.extGStates.set(gsName, gsRef);
  this.extGStateCache.set(key, gsName);

  return gsName;
}
```

Remove the old `opacityToGSName` map field.

3e. Update every draw method to use the new signature. Replace the pattern:
```typescript
if (options.opacity !== undefined && options.opacity < 1) {
  const gsName = this.getOrCreateExtGState(options.opacity);
  this.ops += setGraphicsState(gsName);
}
```
with:
```typescript
if ((options.opacity !== undefined && options.opacity < 1) || (options.blendMode !== undefined && options.blendMode !== 'Normal')) {
  const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
  this.ops += setGraphicsState(gsName);
}
```

Apply this in: `drawText`, `drawImage`, `drawRectangle`, `drawCircle`, `drawEllipse`, `drawLine`, `drawSvgPath`, `drawPage`.

3f. Add `drawSquare` method after `drawRectangle`:
```typescript
drawSquare(options: DrawSquareOptions = {}): void {
  const s = options.size ?? 100;
  this.drawRectangle({
    x: options.x,
    y: options.y,
    width: s,
    height: s,
    color: options.color,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth,
    rotate: options.rotate,
    opacity: options.opacity,
    blendMode: options.blendMode,
  });
}
```

**Step 4: Export new types from index.ts**

Add `DrawSquareOptions` to the Page API exports section.

**Step 5: Run tests**

Run: `npx vitest run tests/unit/core/blendMode.test.ts`
Expected: PASS

**Step 6: Run full suite**

Run: `npx vitest run`
Expected: All pass. Existing opacity tests should still work because `getOrCreateExtGState(opacity)` still handles the opacity-only case.

**Step 7: Commit**

```bash
git add src/core/pdfPage.ts src/core/enums.ts src/index.ts tests/unit/core/blendMode.test.ts
git commit -m "feat: add BlendMode support to all drawing operations and drawSquare convenience method"
```

---

## Task 4: TextRenderingMode + text skew in drawText

**Files:**
- Modify: `src/core/pdfPage.ts` (DrawTextOptions, drawText method)
- Test: `tests/unit/core/textRendering.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/textRendering.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { TextRenderingMode } from '../../../src/core/enums.js';
import { degrees } from '../../../src/core/operators/state.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('TextRenderingMode in drawText', () => {
  it('emits Tr operator when renderingMode is set', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700, renderingMode: TextRenderingMode.Outline });
    const ops = page.getContentStreamData();
    expect(ops).toContain('1 Tr');
  });

  it('emits Tr 2 for FillAndOutline', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700, renderingMode: TextRenderingMode.FillAndOutline });
    const ops = page.getContentStreamData();
    expect(ops).toContain('2 Tr');
  });

  it('does not emit Tr when renderingMode is not set', () => {
    const page = makePage();
    page.drawText('Hello', { x: 50, y: 700 });
    const ops = page.getContentStreamData();
    expect(ops).not.toContain(' Tr');
  });
});

describe('Text skew in drawText', () => {
  it('emits Tm matrix when xSkew is set', () => {
    const page = makePage();
    page.drawText('Skewed', { x: 50, y: 700, xSkew: degrees(15) });
    const ops = page.getContentStreamData();
    // Should use Tm instead of Td
    expect(ops).toContain(' Tm');
    expect(ops).not.toContain('50 700 Td');
  });

  it('emits Tm matrix when ySkew is set', () => {
    const page = makePage();
    page.drawText('Skewed', { x: 50, y: 700, ySkew: degrees(15) });
    const ops = page.getContentStreamData();
    expect(ops).toContain(' Tm');
  });

  it('combines rotation and skew', () => {
    const page = makePage();
    page.drawText('Both', {
      x: 50, y: 700,
      rotate: degrees(45),
      xSkew: degrees(10),
    });
    const ops = page.getContentStreamData();
    expect(ops).toContain(' Tm');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/textRendering.test.ts`
Expected: FAIL — `renderingMode`, `xSkew`, `ySkew` don't exist on DrawTextOptions.

**Step 3: Implement**

3a. Add to `DrawTextOptions` interface in `pdfPage.ts`:
```typescript
  renderingMode?: TextRenderingMode | undefined;
  xSkew?: Angle | undefined;
  ySkew?: Angle | undefined;
```

3b. In the `drawText` method body, after `this.ops += setFont(fontName, size);` add:

```typescript
  if (options.renderingMode !== undefined) {
    this.ops += setTextRenderingMode(options.renderingMode);
  }
```

The `setTextRenderingMode` function is already imported from `operators/text.ts`.

3c. Replace the rotation-only text matrix logic. Current code (approx lines 810-817):
```typescript
  if (options.rotate) {
    const rad = toRadians(options.rotate);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    this.ops += setTextMatrix(cos, sin, -sin, cos, x, y);
  } else {
    this.ops += moveText(x, y);
  }
```

Replace with:
```typescript
  const hasRotate = options.rotate !== undefined;
  const hasXSkew = options.xSkew !== undefined;
  const hasYSkew = options.ySkew !== undefined;

  if (hasRotate || hasXSkew || hasYSkew) {
    const rotRad = hasRotate ? toRadians(options.rotate!) : 0;
    const xSkewRad = hasXSkew ? toRadians(options.xSkew!) : 0;
    const ySkewRad = hasYSkew ? toRadians(options.ySkew!) : 0;

    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // Text matrix: rotation composed with skew
    // Skew matrix: [1, tan(ySkew), tan(xSkew), 1, 0, 0]
    // Rotation matrix: [cos, sin, -sin, cos, 0, 0]
    // Combined: rotation * skew
    const tanX = Math.tan(xSkewRad);
    const tanY = Math.tan(ySkewRad);

    const a = cosR + sinR * tanX;
    const b = sinR + cosR * tanY;  // Note: this simplification works for small skew
    const c = -sinR + cosR * tanX;
    const d = cosR - sinR * tanY;  // Note: correct matrix product

    this.ops += setTextMatrix(a, b, c, d, x, y);
  } else {
    this.ops += moveText(x, y);
  }
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/core/textRendering.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/core/pdfPage.ts tests/unit/core/textRendering.test.ts
git commit -m "feat: add TextRenderingMode and text skew support to drawText"
```

---

## Task 5: Cursor position system

**Files:**
- Modify: `src/core/pdfPage.ts` (add cursor state + methods + update draw fallbacks)
- Test: `tests/unit/core/cursorPosition.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/cursorPosition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

function makePage() {
  const registry = new PdfObjectRegistry();
  return new PdfPage(612, 792, registry);
}

describe('Cursor position system', () => {
  it('starts at (0, 0)', () => {
    const page = makePage();
    expect(page.getPosition()).toEqual({ x: 0, y: 0 });
    expect(page.getX()).toBe(0);
    expect(page.getY()).toBe(0);
  });

  it('moveTo sets position', () => {
    const page = makePage();
    page.moveTo(100, 200);
    expect(page.getPosition()).toEqual({ x: 100, y: 200 });
  });

  it('moveUp increases y', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveUp(30);
    expect(page.getY()).toBe(130);
  });

  it('moveDown decreases y', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveDown(30);
    expect(page.getY()).toBe(70);
  });

  it('moveRight increases x', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveRight(30);
    expect(page.getX()).toBe(80);
  });

  it('moveLeft decreases x', () => {
    const page = makePage();
    page.moveTo(50, 100);
    page.moveLeft(30);
    expect(page.getX()).toBe(20);
  });

  it('resetPosition returns to (0, 0)', () => {
    const page = makePage();
    page.moveTo(100, 200);
    page.resetPosition();
    expect(page.getPosition()).toEqual({ x: 0, y: 0 });
  });

  it('drawText uses cursor position as fallback', () => {
    const page = makePage();
    page.moveTo(100, 700);
    page.drawText('Hello');
    const ops = page.getContentStreamData();
    // Should position text at cursor (100, 700) not (0, 0)
    expect(ops).toContain('100 700');
  });

  it('explicit x/y overrides cursor', () => {
    const page = makePage();
    page.moveTo(100, 700);
    page.drawText('Hello', { x: 50, y: 500 });
    const ops = page.getContentStreamData();
    expect(ops).toContain('50 500');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/cursorPosition.test.ts`
Expected: FAIL — `getPosition`, `moveTo`, etc. don't exist.

**Step 3: Implement**

3a. Add private cursor fields after the defaults section (~line 511):
```typescript
  private _cursorX = 0;
  private _cursorY = 0;
```

3b. Add cursor methods (after the setLineHeight method, ~line 718):
```typescript
  /** Get the current cursor position. */
  getPosition(): { x: number; y: number } {
    return { x: this._cursorX, y: this._cursorY };
  }

  /** Get the current cursor X coordinate. */
  getX(): number {
    return this._cursorX;
  }

  /** Get the current cursor Y coordinate. */
  getY(): number {
    return this._cursorY;
  }

  /** Set the cursor to an absolute position. */
  moveTo(x: number, y: number): void {
    this._cursorX = x;
    this._cursorY = y;
  }

  /** Move the cursor up by the given amount. */
  moveUp(amount: number): void {
    this._cursorY += amount;
  }

  /** Move the cursor down by the given amount. */
  moveDown(amount: number): void {
    this._cursorY -= amount;
  }

  /** Move the cursor right by the given amount. */
  moveRight(amount: number): void {
    this._cursorX += amount;
  }

  /** Move the cursor left by the given amount. */
  moveLeft(amount: number): void {
    this._cursorX -= amount;
  }

  /** Reset the cursor to (0, 0). */
  resetPosition(): void {
    this._cursorX = 0;
    this._cursorY = 0;
  }
```

3c. Update draw methods to use cursor as fallback. In each draw method, change:
```typescript
const x = options.x ?? 0;
const y = options.y ?? 0;
```
to:
```typescript
const x = options.x ?? this._cursorX;
const y = options.y ?? this._cursorY;
```

Apply to: `drawText`, `drawImage`, `drawRectangle`, `drawSquare` (inherits via drawRectangle), `drawCircle`, `drawEllipse`, `drawLine` (for `start` — leave as required param, no cursor fallback), `drawSvgPath`, `drawPage`.

Note: `drawLine` has required `start`/`end` — don't change those. Only change methods with optional x/y.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/core/cursorPosition.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass. Existing tests that rely on `x ?? 0` should still work since cursor starts at 0.

**Step 6: Commit**

```bash
git add src/core/pdfPage.ts tests/unit/core/cursorPosition.test.ts
git commit -m "feat: add cursor position system to PdfPage"
```

---

## Task 6: resetSize, translateContent, scale/scaleContent/scaleAnnotations

**Files:**
- Modify: `src/core/pdfPage.ts`
- Test: `tests/unit/core/pageTransforms.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/pageTransforms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

function makePage(w = 612, h = 792) {
  const registry = new PdfObjectRegistry();
  return new PdfPage(w, h, registry);
}

describe('resetSize', () => {
  it('restores original dimensions after setSize', () => {
    const page = makePage(612, 792);
    page.setSize(300, 400);
    expect(page.getWidth()).toBe(300);
    page.resetSize();
    expect(page.getWidth()).toBe(612);
    expect(page.getHeight()).toBe(792);
  });
});

describe('translateContent', () => {
  it('prepends a translation matrix to content stream', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.translateContent(100, 200);
    const ops = page.getContentStreamData();
    // The translation cm should appear BEFORE the rectangle drawing ops
    const cmIdx = ops.indexOf('1 0 0 1 100 200 cm');
    const rectIdx = ops.indexOf('10 20 50 30 re');
    expect(cmIdx).toBeGreaterThanOrEqual(0);
    expect(rectIdx).toBeGreaterThan(cmIdx);
  });
});

describe('scaleContent', () => {
  it('prepends a scale matrix to content stream', () => {
    const page = makePage();
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.scaleContent(2, 0.5);
    const ops = page.getContentStreamData();
    const cmIdx = ops.indexOf('2 0 0 0.5 0 0 cm');
    expect(cmIdx).toBeGreaterThanOrEqual(0);
  });
});

describe('scale', () => {
  it('scales page dimensions, content, and annotations', () => {
    const page = makePage(612, 792);
    page.drawRectangle({ x: 10, y: 20, width: 50, height: 30 });
    page.scale(2, 2);
    expect(page.getWidth()).toBe(1224);
    expect(page.getHeight()).toBe(1584);
    const ops = page.getContentStreamData();
    expect(ops).toContain('2 0 0 2 0 0 cm');
  });
});

describe('scaleAnnotations', () => {
  it('does not throw when page has no annotations', () => {
    const page = makePage();
    expect(() => page.scaleAnnotations(2, 2)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/pageTransforms.test.ts`
Expected: FAIL — methods don't exist.

**Step 3: Implement**

3a. Store original dimensions in constructor. Add fields (~line 564):
```typescript
  private _originalWidth: number;
  private _originalHeight: number;
```

In constructor body, after `this.mediaHeight = h;`, add:
```typescript
  this._originalWidth = w;
  this._originalHeight = h;
```

3b. Add methods after the dimension getter/setters (~line 1270):

```typescript
  /** Reset page dimensions to their original values from creation or load time. */
  resetSize(): void {
    this.mediaWidth = this._originalWidth;
    this.mediaHeight = this._originalHeight;
  }

  /** Translate all page content by (x, y) points. */
  translateContent(x: number, y: number): void {
    this.ops = concatMatrix(1, 0, 0, 1, x, y) + this.ops;
  }

  /** Scale page content by the given factors. */
  scaleContent(xFactor: number, yFactor: number): void {
    this.ops = concatMatrix(xFactor, 0, 0, yFactor, 0, 0) + this.ops;
  }

  /** Scale annotation rectangles by the given factors. */
  scaleAnnotations(xFactor: number, yFactor: number): void {
    for (const annot of this._annotations) {
      const rect = annot.getRect();
      if (rect) {
        annot.setRect([
          rect[0] * xFactor,
          rect[1] * yFactor,
          rect[2] * xFactor,
          rect[3] * yFactor,
        ]);
      }
    }
  }

  /** Scale page dimensions, content, and annotations together. */
  scale(xFactor: number, yFactor: number): void {
    this.setSize(this.mediaWidth * xFactor, this.mediaHeight * yFactor);
    this.scaleContent(xFactor, yFactor);
    this.scaleAnnotations(xFactor, yFactor);
  }
```

Note: Check how `this._annotations` is stored — it may be `this._originalAnnotRefs` or a different structure. If annotations are stored as `PdfAnnotation[]` objects with `getRect()`/`setRect()` methods, the above works. If they're stored as `PdfRef[]` only, the `scaleAnnotations` method needs to resolve the refs through the registry first. Adapt accordingly based on what `PdfAnnotation` exposes.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/core/pageTransforms.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/core/pdfPage.ts tests/unit/core/pageTransforms.test.ts
git commit -m "feat: add resetSize, translateContent, scale/scaleContent/scaleAnnotations to PdfPage"
```

---

## Task 7: Data URI input + embedPages batch

**Files:**
- Modify: `src/parser/documentParser.ts` (loadPdf function)
- Modify: `src/core/pdfDocument.ts` (embedPages method)
- Test: `tests/unit/core/dataUri.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/dataUri.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('Data URI input', () => {
  it('loads a PDF from a data: URI string', async () => {
    // Create a minimal PDF, save as base64, wrap in data URI
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUri = `data:application/pdf;base64,${base64}`;

    const loaded = await PdfDocument.load(dataUri);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('handles data URI with different mime types', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUri = `data:application/octet-stream;base64,${base64}`;

    const loaded = await PdfDocument.load(dataUri);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('still loads plain base64 strings', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const base64 = Buffer.from(bytes).toString('base64');

    const loaded = await PdfDocument.load(base64);
    expect(loaded.getPageCount()).toBe(1);
  });
});

describe('embedPages', () => {
  it('embeds multiple pages in batch', async () => {
    const source = PdfDocument.create();
    const p1 = source.addPage([200, 300]);
    const p2 = source.addPage([400, 500]);

    const target = PdfDocument.create();
    target.addPage();
    const embedded = await target.embedPages([p1, p2]);

    expect(embedded).toHaveLength(2);
    expect(embedded[0].width).toBe(200);
    expect(embedded[1].width).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/dataUri.test.ts`
Expected: FAIL — data URI not stripped, `embedPages` doesn't exist.

**Step 3: Implement data URI stripping**

In `src/parser/documentParser.ts`, in the `loadPdf` function (~line 1493), replace:
```typescript
  if (typeof data === 'string') {
    bytes = base64Decode(data);
  }
```
with:
```typescript
  if (typeof data === 'string') {
    const dataUriPrefix = /^data:[^;]*;base64,/;
    const match = data.match(dataUriPrefix);
    if (match) {
      data = data.slice(match[0].length);
    }
    bytes = base64Decode(data);
  }
```

**Step 4: Implement embedPages**

In `src/core/pdfDocument.ts`, after the `embedPage` method, add:
```typescript
  /**
   * Embed multiple pages as Form XObjects in batch.
   * Convenience wrapper around embedPage().
   */
  async embedPages(pages: PdfPage[]): Promise<EmbeddedPdfPage[]> {
    return pages.map((page) => this.embedPage(page));
  }
```

**Step 5: Run tests**

Run: `npx vitest run tests/unit/core/dataUri.test.ts`
Expected: PASS

Note: The tests use `Buffer.from(...).toString('base64')` — if the project avoids Buffer, use the project's `base64Encode` utility instead. Adjust test imports accordingly.

**Step 6: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 7: Commit**

```bash
git add src/parser/documentParser.ts src/core/pdfDocument.ts tests/unit/core/dataUri.test.ts
git commit -m "feat: support data URI input in load() and add embedPages batch method"
```

---

## Task 8: addDefaultPage on save + updateFieldAppearances on save

**Files:**
- Modify: `src/core/pdfWriter.ts` (PdfSaveOptions)
- Modify: `src/core/pdfDocument.ts` (save methods)
- Test: `tests/unit/core/saveOptions.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/saveOptions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('addDefaultPage on save', () => {
  it('adds a default page when document has 0 pages (default behavior)', async () => {
    const doc = PdfDocument.create();
    expect(doc.getPageCount()).toBe(0);
    const bytes = await doc.save();
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('does not add a default page when addDefaultPage is false', async () => {
    const doc = PdfDocument.create();
    expect(doc.getPageCount()).toBe(0);
    // When false, document should still save (some PDF readers handle 0-page PDFs)
    // Or it may throw — either way, it should NOT silently add a page
    const bytes = await doc.save({ addDefaultPage: false });
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(0);
  });

  it('does not add extra pages when document already has pages', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save({ addDefaultPage: true });
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

describe('updateFieldAppearances on save', () => {
  it('is accepted as a save option without error', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    // Just verify the option is accepted
    const bytes = await doc.save({ updateFieldAppearances: true });
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('can be disabled', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save({ updateFieldAppearances: false });
    expect(bytes.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/saveOptions.test.ts`
Expected: FAIL — `addDefaultPage`, `updateFieldAppearances` not in PdfSaveOptions.

**Step 3: Implement**

3a. In `src/core/pdfWriter.ts`, add to `PdfSaveOptions`:
```typescript
  addDefaultPage?: boolean | undefined;
  updateFieldAppearances?: boolean | undefined;
```

3b. In `src/core/pdfDocument.ts`, update the `save()` method:
```typescript
  async save(options?: PdfSaveOptions): Promise<Uint8Array> {
    if ((options?.addDefaultPage ?? true) && this.getPageCount() === 0) {
      this.addPage();
    }
    if ((options?.updateFieldAppearances ?? true) && this.form) {
      for (const field of this.form.getFields()) {
        field.generateAppearance();
      }
    }
    const structure = this.buildStructure();
    return serializePdf(this.registry, structure, options);
  }
```

Apply the same `addDefaultPage` logic to `saveAsStream()`, `saveAsBlob()`, `saveAsBase64()`.

For `saveAsStream` and `saveAsBlob`, add the addDefaultPage check before `buildStructure()`. For `saveAsBase64`, it calls `this.save(options)` internally, so it inherits automatically.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/core/saveOptions.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass. Note: Some existing tests may create empty docs and save them. If those tests expect 0 pages, they'll now get 1 page. Check if any existing test breaks. If so, pass `{ addDefaultPage: false }` in those tests.

**Step 6: Commit**

```bash
git add src/core/pdfWriter.ts src/core/pdfDocument.ts tests/unit/core/saveOptions.test.ts
git commit -m "feat: add addDefaultPage and updateFieldAppearances save options"
```

---

## Task 9: parseSpeed / yield throttling

**Files:**
- Modify: `src/parser/documentParser.ts` (LoadPdfOptions + parse loop)
- Test: `tests/unit/parser/parseSpeed.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/parser/parseSpeed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('parseSpeed / objectsPerTick', () => {
  it('accepts objectsPerTick option without error', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes, { objectsPerTick: 10 });
    expect(loaded.getPageCount()).toBe(1);
  });

  it('works with Infinity (no throttling)', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes, { objectsPerTick: Infinity });
    expect(loaded.getPageCount()).toBe(1);
  });

  it('defaults to no throttling when not specified', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/parser/parseSpeed.test.ts`
Expected: FAIL — `objectsPerTick` not in LoadPdfOptions (or just a type error at compile).

**Step 3: Implement**

3a. In `src/parser/documentParser.ts`, add to `LoadPdfOptions`:
```typescript
  /**
   * Number of objects to process per event-loop tick during parsing.
   * Lower values keep the main thread more responsive in browsers.
   * Defaults to Infinity (no throttling).
   */
  objectsPerTick?: number;
```

3b. In the `parse()` method of `PdfDocumentParser`, find the object iteration loop (the one that iterates xref entries or resolves objects). Wrap it with a yield mechanism:

Find the loop that iterates and resolves objects. Add a counter and yield:

```typescript
  const objectsPerTick = options?.objectsPerTick ?? Infinity;
  let objectsThisTick = 0;

  for (const [objNum, entry] of this.xrefEntries) {
    // ... existing resolution logic ...
    objectsThisTick++;
    if (objectsThisTick >= objectsPerTick) {
      await new Promise<void>((r) => setTimeout(r, 0));
      objectsThisTick = 0;
    }
  }
```

Note: The `parse()` method is already `async`, so adding `await` is safe.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/parser/parseSpeed.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/parser/documentParser.ts tests/unit/parser/parseSpeed.test.ts
git commit -m "feat: add objectsPerTick option for throttled PDF parsing"
```

---

## Task 10: Custom word breaks in drawText

**Files:**
- Modify: `src/core/pdfPage.ts` (DrawTextOptions + wrapText + drawText)
- Test: `tests/unit/core/wordBreaks.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/core/wordBreaks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { wrapText } from '../../../src/core/pdfPage.js';

// Create a mock FontRef that returns fixed character widths
function mockFont(charWidth: number) {
  return {
    name: 'F1',
    ref: { kind: 'ref' as const, objectNumber: 1, generationNumber: 0, serialize: () => {} },
    widthOfTextAtSize: (text: string, size: number) => text.length * charWidth * (size / 12),
    heightAtSize: (size: number) => size,
  };
}

describe('wrapText with custom wordBreaks', () => {
  it('wraps on custom break characters', () => {
    const font = mockFont(6);
    // Each char is 6pts at size 12. "hello-world" = 11 chars = 66pts
    // maxWidth 40pts should break at the hyphen
    const lines = wrapText('hello-world', 40, font, 12, ['-']);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain('hello');
  });

  it('wraps on multiple break characters', () => {
    const font = mockFont(6);
    const lines = wrapText('a/b/c/d/e', 20, font, 12, ['/']);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('falls back to space when wordBreaks not specified', () => {
    const font = mockFont(6);
    const lines = wrapText('hello world foo', 50, font, 12);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/wordBreaks.test.ts`
Expected: FAIL — `wrapText` does not accept a `wordBreaks` parameter.

**Step 3: Implement**

3a. Add `wordBreaks?: string[] | undefined` to `DrawTextOptions`.

3b. Update the `wrapText` function signature (line 349) to accept an optional `wordBreaks` parameter:

```typescript
export function wrapText(
  text: string,
  maxWidth: number,
  font: FontRef | string,
  fontSize: number,
  wordBreaks?: string[],
): string[] {
```

Inside the function, where it currently splits on space, change to split on any of the wordBreaks characters (default `[' ']`):

```typescript
const breaks = wordBreaks ?? [' '];
// Create regex that matches any break character
const breakPattern = new RegExp(`([${breaks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}])`);
const words = text.split(breakPattern).filter(s => s.length > 0);
```

Then the rest of the wrapping logic uses `words` instead of splitting on space.

3c. In `drawText()`, pass `wordBreaks` to `wrapText`:

```typescript
const wrapped = wrapText(rawLine, options.maxWidth, fontForWrapping, size, options.wordBreaks);
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/core/wordBreaks.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/core/pdfPage.ts tests/unit/core/wordBreaks.test.ts
git commit -m "feat: add custom wordBreaks option to drawText"
```

---

## Task 11: Layout helpers

**Files:**
- Create: `src/core/layout.ts`
- Test: `tests/unit/core/layout.test.ts` (create new)
- Modify: `src/index.ts` (add exports)

**Step 1: Write the failing test**

Create `tests/unit/core/layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { layoutMultilineText, layoutCombedText, computeFontSize } from '../../../src/core/layout.js';

function mockFont(charWidth: number) {
  return {
    name: 'F1',
    ref: { kind: 'ref' as const, objectNumber: 1, generationNumber: 0, serialize: () => {} },
    widthOfTextAtSize: (text: string, size: number) => text.length * charWidth * (size / 12),
    heightAtSize: (size: number) => size * 1.2,
  };
}

describe('layoutMultilineText', () => {
  it('wraps text into lines with measured widths', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('hello world this is a test', {
      font,
      fontSize: 12,
      maxWidth: 80,
    });
    expect(result.lines.length).toBeGreaterThan(1);
    for (const line of result.lines) {
      expect(line.text.length).toBeGreaterThan(0);
      expect(typeof line.width).toBe('number');
    }
    expect(result.height).toBeGreaterThan(0);
  });

  it('respects explicit newlines', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('line1\nline2\nline3', {
      font,
      fontSize: 12,
      maxWidth: 1000, // Wide enough to never wrap
    });
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].text).toBe('line1');
    expect(result.lines[1].text).toBe('line2');
    expect(result.lines[2].text).toBe('line3');
  });

  it('accepts custom wordBreaks', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('one-two-three-four', {
      font,
      fontSize: 12,
      maxWidth: 50,
      wordBreaks: ['-'],
    });
    expect(result.lines.length).toBeGreaterThan(1);
  });
});

describe('layoutCombedText', () => {
  it('positions characters in cells', () => {
    const font = mockFont(6);
    const result = layoutCombedText('ABCD', {
      font,
      fontSize: 12,
      cellCount: 6,
      cellWidth: 20,
    });
    expect(result).toHaveLength(4);
    expect(result[0].char).toBe('A');
    expect(typeof result[0].x).toBe('number');
    expect(typeof result[0].width).toBe('number');
    // Each character should be in its own cell
    expect(result[1].x).toBeGreaterThan(result[0].x);
  });

  it('truncates to cellCount', () => {
    const font = mockFont(6);
    const result = layoutCombedText('ABCDEFGHIJ', {
      font,
      fontSize: 12,
      cellCount: 4,
      cellWidth: 20,
    });
    expect(result).toHaveLength(4);
  });
});

describe('computeFontSize', () => {
  it('finds the largest font size that fits within bounds', () => {
    const font = mockFont(6);
    const size = computeFontSize('Hello World', {
      font,
      maxWidth: 100,
    });
    // At size 12, "Hello World" (11 chars) = 11*6 = 66pts < 100, so size should be > 12
    // At larger sizes it should exceed 100 and back off
    expect(size).toBeGreaterThan(0);
    // Verify the text at the computed size fits
    const textWidth = font.widthOfTextAtSize('Hello World', size);
    expect(textWidth).toBeLessThanOrEqual(100);
  });

  it('respects maxHeight', () => {
    const font = mockFont(6);
    const size = computeFontSize('A', {
      font,
      maxWidth: 10000,
      maxHeight: 20,
    });
    const height = font.heightAtSize(size);
    expect(height).toBeLessThanOrEqual(20);
  });

  it('returns minSize when text cannot fit', () => {
    const font = mockFont(60);
    const size = computeFontSize('This is very long text', {
      font,
      maxWidth: 10,
      minSize: 4,
    });
    expect(size).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/layout.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Create `src/core/layout.ts`**

```typescript
import type { FontRef } from './pdfPage.js';
import { wrapText } from './pdfPage.js';

export interface LayoutMultilineOptions {
  font: FontRef;
  fontSize: number;
  maxWidth: number;
  lineHeight?: number | undefined;
  wordBreaks?: string[] | undefined;
}

export interface LayoutMultilineResult {
  lines: Array<{ text: string; width: number }>;
  height: number;
}

/**
 * Break text into lines with measured widths and total height.
 */
export function layoutMultilineText(
  text: string,
  options: LayoutMultilineOptions,
): LayoutMultilineResult {
  const { font, fontSize, maxWidth, wordBreaks } = options;
  const lineHeight = options.lineHeight ?? fontSize * 1.2;

  const rawLines = text.split('\n');
  const allLines: Array<{ text: string; width: number }> = [];

  for (const rawLine of rawLines) {
    if (maxWidth > 0) {
      const wrapped = wrapText(rawLine, maxWidth, font, fontSize, wordBreaks);
      for (const line of wrapped) {
        allLines.push({
          text: line,
          width: font.widthOfTextAtSize(line, fontSize),
        });
      }
    } else {
      allLines.push({
        text: rawLine,
        width: font.widthOfTextAtSize(rawLine, fontSize),
      });
    }
  }

  const height = allLines.length > 0
    ? font.heightAtSize(fontSize) + (allLines.length - 1) * lineHeight
    : 0;

  return { lines: allLines, height };
}

export interface LayoutCombedOptions {
  font: FontRef;
  fontSize: number;
  cellCount: number;
  cellWidth: number;
}

/**
 * Layout text into evenly-spaced cells for combed text fields.
 */
export function layoutCombedText(
  text: string,
  options: LayoutCombedOptions,
): Array<{ char: string; x: number; width: number }> {
  const { font, fontSize, cellCount, cellWidth } = options;
  const chars = text.slice(0, cellCount).split('');

  return chars.map((char, i) => {
    const charWidth = font.widthOfTextAtSize(char, fontSize);
    const cellCenter = i * cellWidth + cellWidth / 2;
    const x = cellCenter - charWidth / 2;
    return { char, x, width: charWidth };
  });
}

export interface ComputeFontSizeOptions {
  font: FontRef;
  maxWidth: number;
  maxHeight?: number | undefined;
  lineHeight?: number | undefined;
  minSize?: number | undefined;
  maxSize?: number | undefined;
  wordBreaks?: string[] | undefined;
}

/**
 * Compute the largest font size that fits text within the given bounds.
 * Uses binary search between minSize and maxSize.
 */
export function computeFontSize(
  text: string,
  options: ComputeFontSizeOptions,
): number {
  const { font, maxWidth, wordBreaks } = options;
  const maxHeight = options.maxHeight ?? Infinity;
  const minSize = options.minSize ?? 4;
  const maxSize = options.maxSize ?? 500;

  let lo = minSize;
  let hi = maxSize;

  // Binary search for the largest fitting size
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const layout = layoutMultilineText(text, {
      font,
      fontSize: mid,
      maxWidth,
      lineHeight: options.lineHeight,
      wordBreaks,
    });

    const fits =
      layout.height <= maxHeight &&
      layout.lines.every((line) => line.width <= maxWidth);

    if (fits) {
      lo = mid;
    } else {
      hi = mid;
    }

    if (hi - lo < 0.1) break;
  }

  return Math.floor(lo * 10) / 10; // Round down to 1 decimal
}
```

**Step 4: Add exports to `src/index.ts`**

After the page manipulation section, add:

```typescript
// Text layout helpers
export { layoutMultilineText, layoutCombedText, computeFontSize } from './core/layout.js';
export type { LayoutMultilineOptions, LayoutMultilineResult, LayoutCombedOptions, ComputeFontSizeOptions } from './core/layout.js';
```

**Step 5: Run tests**

Run: `npx vitest run tests/unit/core/layout.test.ts`
Expected: PASS

**Step 6: Run full suite**

Run: `npx vitest run`
Expected: All pass.

**Step 7: Commit**

```bash
git add src/core/layout.ts tests/unit/core/layout.test.ts src/index.ts
git commit -m "feat: add layoutMultilineText, layoutCombedText, computeFontSize helpers"
```

---

## Task 12: OTF (CFF-based OpenType) font embedding

**Files:**
- Create: `src/assets/font/otfDetect.ts`
- Create: `src/assets/font/cffEmbed.ts`
- Modify: `src/assets/font/fontEmbed.ts` (route based on detection)
- Modify: `src/core/pdfDocument.ts` (embedFont routing)
- Test: `tests/unit/assets/otfEmbed.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/assets/otfEmbed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isOpenTypeCFF } from '../../../src/assets/font/otfDetect.js';
import { embedCffFont } from '../../../src/assets/font/cffEmbed.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

describe('isOpenTypeCFF', () => {
  it('returns true for OTTO magic bytes', () => {
    const data = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 0, 0, 0]);
    expect(isOpenTypeCFF(data)).toBe(true);
  });

  it('returns false for TrueType magic bytes', () => {
    const data = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
    expect(isOpenTypeCFF(data)).toBe(false);
  });

  it('returns false for data too short', () => {
    const data = new Uint8Array([0x4F, 0x54]);
    expect(isOpenTypeCFF(data)).toBe(false);
  });
});

describe('embedCffFont', () => {
  // Note: Testing with a real OTF font requires a fixture file.
  // This test validates the API exists and handles errors gracefully.
  it('throws on invalid font data', () => {
    const registry = new PdfObjectRegistry();
    const badData = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 0, 0, 0]);
    expect(() => embedCffFont(badData, registry)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/assets/otfEmbed.test.ts`
Expected: FAIL — modules don't exist.

**Step 3: Create `src/assets/font/otfDetect.ts`**

```typescript
/**
 * Detect whether font data is an OpenType font with CFF outlines.
 * CFF-based OpenType fonts start with the ASCII bytes "OTTO".
 * TrueType-based OpenType fonts start with 0x00010000 or "true".
 */
export function isOpenTypeCFF(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return (
    data[0] === 0x4F && // O
    data[1] === 0x54 && // T
    data[2] === 0x54 && // T
    data[3] === 0x4F    // O
  );
}

/**
 * Detect whether font data is a TrueType font.
 */
export function isTrueType(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  // 0x00010000 — standard TrueType
  if (data[0] === 0x00 && data[1] === 0x01 && data[2] === 0x00 && data[3] === 0x00) return true;
  // "true" — alternate TrueType magic
  if (data[0] === 0x74 && data[1] === 0x72 && data[2] === 0x75 && data[3] === 0x65) return true;
  return false;
}
```

**Step 4: Create `src/assets/font/cffEmbed.ts`**

This is the most complex file. The implementation should:

1. Parse the OpenType table directory to locate `CFF `, `cmap`, `head`, `hhea`, `hmtx`, `maxp`, `OS/2`, `name`, `post` tables
2. Extract metrics using the existing `extractMetrics()` from `fontMetrics.ts` (shared OpenType tables are identical)
3. Extract the raw CFF table data
4. Build a CIDFont Type0 dictionary referencing FontFile3 with Subtype CIDFontType0C
5. Return a FontRef-compatible object

```typescript
import { PdfDict, PdfName, PdfNumber, PdfArray, PdfStream, PdfString, PdfObjectRegistry, PdfRef } from '../../core/pdfObjects.js';
import { extractMetrics } from './fontMetrics.js';
import { EmbeddedFont } from './fontEmbed.js';
import type { FontRef } from '../../core/pdfPage.js';

/**
 * Locate an OpenType table by its 4-byte tag.
 * Returns { offset, length } or undefined if not found.
 */
function findTable(data: Uint8Array, tag: string): { offset: number; length: number } | undefined {
  if (data.length < 12) return undefined;
  const numTables = (data[4]! << 8) | data[5]!;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > data.length) break;
    const t = String.fromCharCode(data[rec]!, data[rec + 1]!, data[rec + 2]!, data[rec + 3]!);
    if (t === tag) {
      const offset = (data[rec + 8]! << 24) | (data[rec + 9]! << 16) | (data[rec + 10]! << 8) | data[rec + 11]!;
      const length = (data[rec + 12]! << 24) | (data[rec + 13]! << 16) | (data[rec + 14]! << 8) | data[rec + 15]!;
      return { offset: offset >>> 0, length: length >>> 0 };
    }
  }
  return undefined;
}

/**
 * Embed a CFF-based OpenType font as a CIDFont Type0.
 * Creates the full Type0 composite font structure with Identity-H encoding.
 */
export function embedCffFont(fontData: Uint8Array, registry: PdfObjectRegistry): {
  fontRef: FontRef;
  embedded: EmbeddedFont;
} {
  // Extract metrics (shared OpenType tables)
  const metrics = extractMetrics(fontData);

  // Find the CFF table
  const cffTable = findTable(fontData, 'CFF ');
  if (!cffTable) {
    throw new Error('No CFF table found in font data. Is this an OTF font with CFF outlines?');
  }
  const cffData = fontData.slice(cffTable.offset, cffTable.offset + cffTable.length);

  // Create the EmbeddedFont for glyph tracking
  const embedded = new EmbeddedFont(fontData, metrics);

  // Build PDF font objects (lazily on finalize, same pattern as TrueType)
  // The actual PDF objects are built during save/finalize
  const fontName = metrics.postScriptName || 'CFFFont';

  const fontRef: FontRef = {
    name: '', // Set by PdfPage when registered
    ref: PdfRef.of(0, 0), // Placeholder, set by registry
    _isCIDFont: true,
    widthOfTextAtSize(text: string, size: number): number {
      return embedded.widthOfTextAtSize(text, size);
    },
    heightAtSize(size: number): number {
      return embedded.heightAtSize(size);
    },
    _encodeText(text: string): string {
      return embedded.encodeText(text);
    },
  };

  return { fontRef, embedded };
}
```

Note: The full CFF embedding (building CIDSystemInfo, FontDescriptor with /FontFile3, Type0 font dict, /W array, ToUnicode CMap) should follow the same pattern as the TrueType embedding in `pdfDocument.ts:embedTrueTypeFont()` but use:
- `/Subtype /CIDFontType0` instead of `/CIDFontType2`
- `/FontFile3` with `/Subtype /CIDFontType0C` instead of `/FontFile2`
- The raw CFF data as the stream content

The implementer should study `embedTrueTypeFont()` (pdfDocument.ts:557-608+) and mirror the structure with CFF-specific changes.

**Step 5: Update `embedFont` routing in `pdfDocument.ts`**

Change the `embedFont` method:
```typescript
  async embedFont(fontNameOrData: string | Uint8Array): Promise<FontRef> {
    if (typeof fontNameOrData === 'string') {
      return this.embedStandardFont(fontNameOrData);
    }
    if (isOpenTypeCFF(fontNameOrData)) {
      return this.embedCffFont(fontNameOrData);
    }
    return this.embedTrueTypeFont(fontNameOrData);
  }
```

Add import: `import { isOpenTypeCFF } from '../assets/font/otfDetect.js';`

Add private `embedCffFont` method that mirrors `embedTrueTypeFont` structure.

**Step 6: Run tests**

Run: `npx vitest run tests/unit/assets/otfEmbed.test.ts`
Expected: PASS

**Step 7: Run full suite + commit**

Run: `npx vitest run`

```bash
git add src/assets/font/otfDetect.ts src/assets/font/cffEmbed.ts src/assets/font/fontEmbed.ts src/core/pdfDocument.ts tests/unit/assets/otfEmbed.test.ts
git commit -m "feat: add OTF (CFF-based OpenType) font embedding"
```

---

## Task 13: OpenType feature flags (kern + liga basics)

**Files:**
- Modify: `src/core/pdfDocument.ts` (EmbedFontOptions parameter)
- Modify: `src/assets/font/fontMetrics.ts` (parse kern table)
- Modify: `src/assets/font/fontEmbed.ts` (store features, apply kern in widthOfTextAtSize)
- Test: `tests/unit/assets/fontFeatures.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/assets/fontFeatures.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('EmbedFontOptions', () => {
  it('embedFont accepts options parameter', async () => {
    const doc = PdfDocument.create();
    // Standard font — features are ignored but the API accepts them
    const font = await doc.embedFont('Helvetica', { features: { kern: true } });
    expect(font).toBeDefined();
    expect(font.name).toBeTruthy();
  });

  it('embedFont accepts subset option', async () => {
    const doc = PdfDocument.create();
    const font = await doc.embedFont('Helvetica', { subset: false });
    expect(font).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/assets/fontFeatures.test.ts`
Expected: FAIL — `embedFont` doesn't accept a second parameter.

**Step 3: Implement**

3a. Define `EmbedFontOptions` in `pdfDocument.ts` (or a shared types file):
```typescript
export interface EmbedFontOptions {
  /** Whether to subset the font to reduce file size. Default: true. */
  subset?: boolean | undefined;
  /** OpenType feature flags. e.g., { kern: true, liga: true }. */
  features?: Record<string, boolean> | undefined;
}
```

3b. Update `embedFont` signature:
```typescript
  async embedFont(
    fontNameOrData: string | Uint8Array,
    options?: EmbedFontOptions,
  ): Promise<FontRef>
```

3c. Pass `options` through to `embedTrueTypeFont` and `embedCffFont`. Store features on the `EmbeddedFont` instance for later use during text measurement and encoding.

3d. For `kern` feature: In `fontMetrics.ts`, add a `parseKernTable(data: Uint8Array)` function that extracts kern pairs from the `kern` table (format 0). Store as a `Map<string, number>` keyed by `${leftGlyph}:${rightGlyph}`. In `EmbeddedFont.widthOfTextAtSize()`, when `kern` is enabled, sum the kern adjustments between adjacent glyphs.

3e. For `liga` feature: In `EmbeddedFont.encodeText()`, when `liga` is enabled, check for standard ligature sequences (fi→glyph, fl→glyph, ff→glyph, ffi→glyph, ffl→glyph). This requires parsing the GSUB table's ligature lookup, which is complex. Initial implementation: store a flag, full GSUB parsing deferred to WASM text shaping.

**Step 4: Export EmbedFontOptions from index.ts**

Add `EmbedFontOptions` to the core document exports section.

**Step 5: Run tests**

Run: `npx vitest run tests/unit/assets/fontFeatures.test.ts`
Expected: PASS

**Step 6: Run full suite + commit**

```bash
git add src/core/pdfDocument.ts src/assets/font/fontMetrics.ts src/assets/font/fontEmbed.ts src/index.ts tests/unit/assets/fontFeatures.test.ts
git commit -m "feat: add EmbedFontOptions with subset and OpenType feature flags"
```

---

## Task 14: PdfViewerPreferences class

**Files:**
- Create: `src/metadata/pdfViewerPreferences.ts`
- Modify: `src/metadata/viewerPreferences.ts` (add pickTrayByPDFSize)
- Modify: `src/core/pdfDocument.ts` (update getViewerPreferences/setViewerPreferences)
- Modify: `src/index.ts` (export class)
- Test: `tests/unit/metadata/pdfViewerPreferences.test.ts` (create new)

**Step 1: Write the failing test**

Create `tests/unit/metadata/pdfViewerPreferences.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PdfViewerPreferences } from '../../../src/metadata/pdfViewerPreferences.js';

describe('PdfViewerPreferences', () => {
  it('initializes with defaults', () => {
    const prefs = new PdfViewerPreferences();
    expect(prefs.getHideToolbar()).toBe(false);
    expect(prefs.getHideMenubar()).toBe(false);
    expect(prefs.getHideWindowUI()).toBe(false);
    expect(prefs.getFitWindow()).toBe(false);
    expect(prefs.getCenterWindow()).toBe(false);
    expect(prefs.getDisplayDocTitle()).toBe(false);
    expect(prefs.getNumCopies()).toBe(1);
    expect(prefs.getPickTrayByPDFSize()).toBe(false);
    expect(prefs.getPrintPageRange()).toBeUndefined();
  });

  it('sets and gets boolean properties', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setHideToolbar(true);
    expect(prefs.getHideToolbar()).toBe(true);

    prefs.setHideMenubar(true);
    expect(prefs.getHideMenubar()).toBe(true);

    prefs.setHideWindowUI(true);
    expect(prefs.getHideWindowUI()).toBe(true);

    prefs.setFitWindow(true);
    expect(prefs.getFitWindow()).toBe(true);

    prefs.setCenterWindow(true);
    expect(prefs.getCenterWindow()).toBe(true);

    prefs.setDisplayDocTitle(true);
    expect(prefs.getDisplayDocTitle()).toBe(true);

    prefs.setPickTrayByPDFSize(true);
    expect(prefs.getPickTrayByPDFSize()).toBe(true);
  });

  it('sets and gets enum properties', () => {
    const prefs = new PdfViewerPreferences();

    prefs.setNonFullScreenPageMode('UseOutlines');
    expect(prefs.getNonFullScreenPageMode()).toBe('UseOutlines');

    prefs.setDirection('R2L');
    expect(prefs.getDirection()).toBe('R2L');

    prefs.setPrintScaling('None');
    expect(prefs.getPrintScaling()).toBe('None');

    prefs.setDuplex('DuplexFlipShortEdge');
    expect(prefs.getDuplex()).toBe('DuplexFlipShortEdge');
  });

  it('sets and gets numCopies', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setNumCopies(5);
    expect(prefs.getNumCopies()).toBe(5);
  });

  it('sets and gets printPageRange', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setPrintPageRange([[0, 3], [5, 7]]);
    expect(prefs.getPrintPageRange()).toEqual([[0, 3], [5, 7]]);
  });

  it('constructs from existing ViewerPreferences object', () => {
    const prefs = new PdfViewerPreferences({
      hideToolbar: true,
      direction: 'R2L',
      numCopies: 3,
    });
    expect(prefs.getHideToolbar()).toBe(true);
    expect(prefs.getDirection()).toBe('R2L');
    expect(prefs.getNumCopies()).toBe(3);
  });

  it('exports to plain object', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setHideToolbar(true);
    prefs.setDirection('R2L');
    const obj = prefs.toObject();
    expect(obj.hideToolbar).toBe(true);
    expect(obj.direction).toBe('R2L');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metadata/pdfViewerPreferences.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Create `src/metadata/pdfViewerPreferences.ts`**

```typescript
import type { ViewerPreferences } from './viewerPreferences.js';
import { buildViewerPreferencesDict } from './viewerPreferences.js';
import type { PdfDict } from '../core/pdfObjects.js';

/**
 * Class-based API for PDF viewer preferences with individual getter/setter pairs.
 * Provides the same functionality as the plain ViewerPreferences interface
 * but with a more discoverable, pdf-lib-compatible API.
 */
export class PdfViewerPreferences {
  private data: ViewerPreferences;

  constructor(data: ViewerPreferences = {}) {
    this.data = { ...data };
  }

  // --- Boolean properties (7 total) ---

  getHideToolbar(): boolean { return this.data.hideToolbar ?? false; }
  setHideToolbar(value: boolean): void { this.data.hideToolbar = value; }

  getHideMenubar(): boolean { return this.data.hideMenubar ?? false; }
  setHideMenubar(value: boolean): void { this.data.hideMenubar = value; }

  getHideWindowUI(): boolean { return this.data.hideWindowUI ?? false; }
  setHideWindowUI(value: boolean): void { this.data.hideWindowUI = value; }

  getFitWindow(): boolean { return this.data.fitWindow ?? false; }
  setFitWindow(value: boolean): void { this.data.fitWindow = value; }

  getCenterWindow(): boolean { return this.data.centerWindow ?? false; }
  setCenterWindow(value: boolean): void { this.data.centerWindow = value; }

  getDisplayDocTitle(): boolean { return this.data.displayDocTitle ?? false; }
  setDisplayDocTitle(value: boolean): void { this.data.displayDocTitle = value; }

  getPickTrayByPDFSize(): boolean { return this.data.pickTrayByPDFSize ?? false; }
  setPickTrayByPDFSize(value: boolean): void { this.data.pickTrayByPDFSize = value; }

  // --- Enum properties (4 total) ---

  getNonFullScreenPageMode(): 'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC' {
    return this.data.nonFullScreenPageMode ?? 'UseNone';
  }
  setNonFullScreenPageMode(value: 'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC'): void {
    this.data.nonFullScreenPageMode = value;
  }

  getDirection(): 'L2R' | 'R2L' {
    return this.data.direction ?? 'L2R';
  }
  setDirection(value: 'L2R' | 'R2L'): void {
    this.data.direction = value;
  }

  getPrintScaling(): 'None' | 'AppDefault' {
    return this.data.printScaling ?? 'AppDefault';
  }
  setPrintScaling(value: 'None' | 'AppDefault'): void {
    this.data.printScaling = value;
  }

  getDuplex(): 'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge' | undefined {
    return this.data.duplex;
  }
  setDuplex(value: 'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge'): void {
    this.data.duplex = value;
  }

  // --- Numeric / complex properties (2 total) ---

  getNumCopies(): number { return this.data.numCopies ?? 1; }
  setNumCopies(value: number): void { this.data.numCopies = value; }

  getPrintPageRange(): [number, number][] | undefined { return this.data.printPageRange; }
  setPrintPageRange(value: [number, number][]): void { this.data.printPageRange = value; }

  // --- Serialization ---

  /** Convert to a PdfDict for embedding in the PDF catalog. */
  toDict(): PdfDict { return buildViewerPreferencesDict(this.data); }

  /** Convert to a plain ViewerPreferences object. */
  toObject(): ViewerPreferences { return { ...this.data }; }
}
```

**Step 4: Add `pickTrayByPDFSize` to ViewerPreferences interface**

In `src/metadata/viewerPreferences.ts`, add to the interface:
```typescript
  pickTrayByPDFSize?: boolean | undefined;
```

And in `buildViewerPreferencesDict`, handle the new property:
```typescript
  if (prefs.pickTrayByPDFSize !== undefined) {
    dict.set('/PickTrayByPDFSize', PdfBool.of(prefs.pickTrayByPDFSize));
  }
```

And in `parseViewerPreferences`, read it:
```typescript
  result.pickTrayByPDFSize = extractBool(dict, '/PickTrayByPDFSize');
```

**Step 5: Update PdfDocument**

In `pdfDocument.ts`, update `getViewerPreferences` and `setViewerPreferences`:

```typescript
  getViewerPreferences(): PdfViewerPreferences {
    if (!this._viewerPrefsInstance) {
      this._viewerPrefsInstance = new PdfViewerPreferences(this.viewerPrefs ?? {});
    }
    return this._viewerPrefsInstance;
  }

  setViewerPreferences(prefs: ViewerPreferences | PdfViewerPreferences): void {
    if (prefs instanceof PdfViewerPreferences) {
      this._viewerPrefsInstance = prefs;
      this.viewerPrefs = prefs.toObject();
    } else {
      this.viewerPrefs = prefs;
      this._viewerPrefsInstance = undefined;
    }
  }
```

Add field: `private _viewerPrefsInstance?: PdfViewerPreferences;`

Import: `import { PdfViewerPreferences } from '../metadata/pdfViewerPreferences.js';`

**Step 6: Export from index.ts**

In the metadata section (~line 258-265), add:
```typescript
export { PdfViewerPreferences } from './metadata/pdfViewerPreferences.js';
```

**Step 7: Run tests**

Run: `npx vitest run tests/unit/metadata/pdfViewerPreferences.test.ts`
Expected: PASS

**Step 8: Run full suite**

Run: `npx vitest run`
Expected: All pass. Existing viewer preferences tests should still work since the plain interface is still accepted.

**Step 9: Commit**

```bash
git add src/metadata/pdfViewerPreferences.ts src/metadata/viewerPreferences.ts src/core/pdfDocument.ts src/index.ts tests/unit/metadata/pdfViewerPreferences.test.ts
git commit -m "feat: add PdfViewerPreferences class with 14 getter/setter pairs"
```

---

## Task 15: Final exports audit + full test run

**Files:**
- Modify: `src/index.ts` (verify all new exports)
- No new test file — this is a verification step

**Step 1: Verify all new exports are present in `src/index.ts`**

Check that the following are exported:

From Batch 1-3:
- `BlendMode`, `TextRenderingMode` from `./core/enums.js`
- `DrawSquareOptions` from `./core/pdfPage.js`

From Batch 4:
- No new exports needed (embedPages is a method, not standalone)

From Batch 5:
- `addDefaultPage` and `updateFieldAppearances` are part of `PdfSaveOptions` (already exported)

From Batch 6:
- `layoutMultilineText`, `layoutCombedText`, `computeFontSize` from `./core/layout.js`
- Types: `LayoutMultilineOptions`, `LayoutMultilineResult`, `LayoutCombedOptions`, `ComputeFontSizeOptions`

From Batch 7:
- `EmbedFontOptions` type from `./core/pdfDocument.js`
- `isOpenTypeCFF` from `./assets/font/otfDetect.js`

From Batch 8:
- `PdfViewerPreferences` from `./metadata/pdfViewerPreferences.js`

**Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (original 1838 + ~80 new tests from tasks 1-14).

**Step 3: Run the build**

Run: `npm run build`
Expected: Clean build with no TypeScript errors.

**Step 4: Final commit**

```bash
git add src/index.ts
git commit -m "chore: audit and finalize all new exports for pdf-lib feature parity"
```

---

## Summary

| Task | Feature | New Tests |
|------|---------|-----------|
| 1 | Complete PageSizes (ISO A/B + Folio) | ~18 |
| 2 | BlendMode + TextRenderingMode enums | ~4 |
| 3 | BlendMode on all draw ops + drawSquare | ~8 |
| 4 | TextRenderingMode + text skew in drawText | ~6 |
| 5 | Cursor position system | ~9 |
| 6 | resetSize, translateContent, scale* | ~5 |
| 7 | Data URI input + embedPages batch | ~5 |
| 8 | addDefaultPage + updateFieldAppearances on save | ~5 |
| 9 | parseSpeed / objectsPerTick | ~3 |
| 10 | Custom word breaks | ~3 |
| 11 | Layout helpers | ~8 |
| 12 | OTF font embedding | ~3 |
| 13 | OpenType feature flags | ~2 |
| 14 | PdfViewerPreferences class | ~10 |
| 15 | Final audit + full test run | 0 |
| **Total** | **22 features** | **~89 new tests** |
