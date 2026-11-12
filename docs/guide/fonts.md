# Fonts

This guide covers font handling in `modern-pdf-lib`, including standard fonts, custom font embedding, subsetting, and bidirectional text.

## Standard 14 PDF Fonts

The PDF specification defines 14 standard fonts that every PDF viewer must support. Pass a standard font name to `embedFont()` to use one — no glyph data is embedded (only a small font dictionary), so file sizes stay tiny:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
const times = await pdf.embedFont(StandardFonts.TimesRoman);
const courier = await pdf.embedFont(StandardFonts.Courier);

page.drawText('Helvetica text', {
  x: 50,
  y: 700,
  size: 16,
  font: helvetica,
  color: rgb(0, 0, 0),
});

page.drawText('Times Roman text', {
  x: 50,
  y: 670,
  size: 16,
  font: times,
  color: rgb(0, 0, 0),
});

page.drawText('Courier text', {
  x: 50,
  y: 640,
  size: 16,
  font: courier,
  color: rgb(0, 0, 0),
});
```

### Available Standard Fonts

| Family | Regular | Bold | Italic/Oblique | Bold Italic |
|---|---|---|---|---|
| Helvetica | `Helvetica` | `HelveticaBold` | `HelveticaOblique` | `HelveticaBoldOblique` |
| Times | `TimesRoman` | `TimesBold` | `TimesItalic` | `TimesBoldItalic` |
| Courier | `Courier` | `CourierBold` | `CourierOblique` | `CourierBoldOblique` |
| Symbol | `Symbol` | — | — | — |
| ZapfDingbats | `ZapfDingbats` | — | — | — |

> [!WARNING]
> Standard fonts only support the Latin-1 (WinAnsi) character set. For Unicode text, CJK characters, or any non-Latin script, you must embed a custom font.

## Custom Font Embedding

Embed TrueType (`.ttf`) or OpenType (`.otf`) fonts for full Unicode coverage:

```ts
import { readFile } from 'node:fs/promises';

const fontBytes = new Uint8Array(await readFile('fonts/Inter-Regular.ttf'));
const inter = await pdf.embedFont(fontBytes);

page.drawText('Custom font with accented Latin text: Åre café naïve', {
  x: 50,
  y: 700,
  font: inter,
  size: 16,
  color: rgb(0, 0, 0),
});
```

### Loading Fonts in the Browser

```ts
const fontBytes = await fetch('/fonts/Inter-Regular.ttf')
  .then((res) => res.arrayBuffer())
  .then((buf) => new Uint8Array(buf));

const font = await pdf.embedFont(fontBytes);
```

### Using Multiple Fonts

You can embed as many fonts as needed and use different fonts on the same page:

```ts
const regular = await pdf.embedFont(regularBytes);
const bold = await pdf.embedFont(boldBytes);
const italic = await pdf.embedFont(italicBytes);

page.drawText('This is regular text.', {
  x: 50, y: 700, font: regular, size: 14, color: rgb(0, 0, 0),
});

page.drawText('This is bold text.', {
  x: 50, y: 675, font: bold, size: 14, color: rgb(0, 0, 0),
});

page.drawText('This is italic text.', {
  x: 50, y: 650, font: italic, size: 14, color: rgb(0, 0, 0),
});
```

## Font Subsetting

`modern-pdf-lib` keeps only the outlines of the glyphs a document uses. This reduces file size for large fonts (CJK fonts can be 10+ MB).

```ts
// Only the outlines for "Hello" are kept in the PDF
const font = await pdf.embedFont(fontBytes);
page.drawText('Hello', { x: 50, y: 700, font, size: 16 });
```

The subsetter works at the TrueType level. It keeps every glyph ID (so `CIDToGIDMap /Identity` stays valid), replaces the `glyf` outlines of unused glyphs (after resolving composite dependencies) with empty entries, rebuilds `loca`, and recomputes checksums. The 14 tables in the last row below are copied unchanged; any other table in the font (for example `kern`, `vhea`, `vmtx`, `fvar`, `gvar`, `COLR`, `CPAL`) is left out of the embedded font. The subsetter is pure JavaScript and needs no WebAssembly.

### What Gets Subsetted

| Table | Action |
|---|---|
| `glyf` | Outlines kept only for used glyphs (and composite components) |
| `loca` | Rebuilt |
| `head` | `indexToLocFormat` and checksum updated |
| `hhea`, `maxp`, `OS/2`, `name`, `cmap`, `post`, `hmtx`, `cvt `, `fpgm`, `prep`, `gasp`, `GDEF`, `GPOS`, `GSUB` | Copied unchanged |

### The `subset` Option

`embedFont()` accepts `{ subset?: boolean }`, but the option has no effect: TrueType fonts are always subset when the document is saved, and `{ subset: false }` does not embed the full font. Passing `subset: false` emits one `ModernPdfLibWarning` (code `MPL_IGNORED_OPTION`) per process. The `features` option has no effect and warns the same way.

> [!TIP]
> Dropping unused outlines usually removes most of a large font's size.

## Text Shaping for Complex Scripts

`drawText` does not shape text. It maps each code point through the font `cmap` (no ligatures, no Arabic contextual forms, no mark positioning) and draws the glyphs in logical order. For mixed-direction text, reorder with `resolveBidi` / `reorderVisual` (below) before drawing. Complex-script shaping is not applied.

## Advanced typography

### Bidirectional text (UAX #9)

`resolveBidi` implements the Unicode Bidirectional Algorithm so mixed
left-to-right and right-to-left text (Latin + Hebrew/Arabic) is laid out in the
correct visual order. It returns the resolved embedding levels, the contiguous
directional runs, and the visual reordering.

```ts
import { resolveBidi, reorderVisual } from 'modern-pdf-lib';

const result = resolveBidi('abc אבג xyz'); // Latin + a Hebrew word
// result.baseLevel: 0 (LTR paragraph)
// result.runs: [{ direction:'ltr', level:0, ... }, { direction:'rtl', level:1, ... }, ...]
for (const run of result.runs) console.log(run.direction, run.level, run.text);

// Or just get the string reordered into visual order:
const visual = reorderVisual('שלום', 'rtl'); // pure-Hebrew → reversed
```

```ts
function resolveBidi(text: string, base?: 'ltr' | 'rtl' | 'auto'): BidiResult;
interface BidiResult {
  runs: BidiRun[];
  levels: number[];        // embedding level per UTF-16 unit
  visualOrder: number[];   // visual→logical: visualOrder[v] is the logical index painted at visual position v
  baseLevel: number;       // 0 = LTR paragraph, 1 = RTL
}
```

The full UAX #9 pipeline (explicit embeddings/isolates, weak/neutral/implicit
rules, paired-bracket resolution, L1/L2 reordering) is implemented. The
`Bidi_Class` and bracket-pair tables are a range-based subset covering Latin,
Hebrew, Arabic (+ Supplement), Syriac, and Thaana; code points outside those
ranges fall back to the Unicode default classes. Line breaking is not performed
(the paragraph is reordered as one line). `drawText` does not call `resolveBidi` or `reorderVisual`; apply them to the string before drawing.

### Variable fonts (`fvar` / `avar`)

`parseVariableFont` reads an OpenType variable font's variation axes and named
instances, and `normalizeAxisCoordinate` maps a user axis value into the
normalized `[-1, 0, +1]` design space (applying `avar` segment maps when present).

```ts
import { parseVariableFont, normalizeAxisCoordinate } from 'modern-pdf-lib';

const info = parseVariableFont(fontBytes);
if (info.isVariable) {
  for (const axis of info.axes) {
    console.log(axis.tag, axis.minValue, axis.defaultValue, axis.maxValue);
  }
  const wght = info.axes.find((a) => a.tag === 'wght')!;
  const n = normalizeAxisCoordinate(wght, 250); // e.g. → -0.5
}
```

::: warning Scope
This exposes the axis/instance model and coordinate normalization — the
foundation for instancing. Baking the `gvar`/`glyf` outline deltas into a static
instance font is not performed.
:::

### Color fonts (`COLR` / `CPAL`)

`parseColorFont` reads `CPAL` palettes and detects a `COLR` table;
`getColorGlyphLayers` returns the layered color glyphs (each layer a base glyph
id + its resolved palette colour) so a renderer can draw multi-colour glyphs.

```ts
import { parseColorFont, getColorGlyphLayers } from 'modern-pdf-lib';

const info = parseColorFont(fontBytes); // { hasColor, numPalettes, palettes }
if (info.hasColor) {
  const layers = getColorGlyphLayers(fontBytes, glyphId); // ColorGlyphLayer[]
  for (const layer of layers) console.log(layer.glyphId, layer.rgba); // [r,g,b,a] 0..255
}
```

::: warning Scope
`COLR` v0 (layered solid colours) is parsed. `COLR` v1 (gradients/transforms)
and embedding the colour glyphs into the PDF (e.g. as Type 3 fonts) are out of
scope for this parser, which exposes the palette + layer model.
:::

## Font Metrics and Measurement

Use font metrics for precise text layout:

### Measuring Text Width

```ts
const font = await pdf.embedFont(fontBytes);
const width = font.widthOfTextAtSize('Hello, world!', 16);
console.log(`Text width: ${width} points`);
```

### Calculating Text Height

Use `heightAtSize()` to get the total height (ascender - descender) at a given font size:

```ts
const textHeight = font.heightAtSize(16);
console.log(`Text height: ${textHeight} pt`);
```

### Calculating Line Height

```ts
const fontSize = 14;

// Total text height (ascent - descent)
const textHeight = font.heightAtSize(fontSize);

// Use a multiplier for comfortable line spacing (common for body text)
const lineHeight = fontSize * 1.2;
```

### Centering Text on a Page

```ts
function centerText(
  page: PdfPage,
  text: string,
  font: FontRef,
  fontSize: number,
  y: number,
): void {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const pageWidth = page.getWidth();
  const x = (pageWidth - textWidth) / 2;
  page.drawText(text, { x, y, font, size: fontSize, color: rgb(0, 0, 0) });
}
```

## Performance Considerations

| Operation | Implementation | Notes |
|---|---|---|
| Font parsing | Built-in JavaScript | Metric extraction from large fonts |
| Subsetting | Built-in JavaScript | Handles all TrueType subsetting |
| Text shaping | Not applied | See Text Shaping for Complex Scripts |
| Width measurement | Built-in JavaScript | Computed from cached glyph metrics |

The package ships WebAssembly builds of six Rust crates under `dist/wasm/`, but this release's JavaScript does not run them; all work runs in pure JavaScript. `initWasm({ fonts: true })` loads nothing, and once any `initWasm` call with options resolves, later `initWasm` calls return without doing anything.
