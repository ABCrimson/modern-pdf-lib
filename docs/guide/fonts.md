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
> The 12 Latin standard fonts take only the characters of WinAnsiEncoding (ASCII, Latin-1 and a few more, such as `€` and `—`). For CJK characters or any other script, embed a custom font that has the glyphs: `drawText()` throws `UnencodableTextError` for a character the font cannot encode, and does so for an embedded font that has no glyph for it as well. Symbol and ZapfDingbats take Unicode text (`'αβγ'`, `'✓'`) and write their own codes. [How Text Is Encoded](#how-text-is-encoded) has the details.

## Custom Font Embedding

Embed TrueType (`.ttf`) or OpenType (`.otf`) fonts to draw every character the font has a glyph for:

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

## How Text Is Encoded

A content stream holds bytes, not characters, so `drawText()` turns each string into the bytes its font expects. The `FontRef` that `embedFont()` returns does that in `encodeText()`:

| Font | Encoding | Characters it takes | Bytes written |
|---|---|---|---|
| The 12 Latin standard fonts (Helvetica, Times and Courier families) | `WinAnsiEncoding` | the 218 characters of WinAnsi: ASCII, Latin-1, and extras such as `€`, `—` and `“` | 1 per character |
| Symbol | `SymbolEncoding` | Unicode text such as `'αβγ'` (189 characters) | 1 per character |
| ZapfDingbats | `ZapfDingbatsEncoding` | Unicode text such as `'✓'` (202 characters) | 1 per character |
| An embedded TrueType or OpenType font | `Identity-H` | every character that has a glyph in the font `cmap` | 2 per glyph |

```ts
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
const symbol = await pdf.embedFont(StandardFonts.Symbol);

helvetica.encodeText('Größe €'); // Uint8Array of 7 bytes: 'ß' is 0xDF, '€' is 0x80
helvetica.getCharacterSet().length; // 218
helvetica.widthOfTextAtSize('€', 1000); // 556, the width of the byte that is written

page.drawText('αβγ', { x: 50, y: 600, size: 16, font: symbol });
```

A standard font takes its text in Unicode normalization form NFC, so the decomposed `'cafe\u0301'` is written as the four characters of `'café'`. An embedded font writes the code points it is given, with no normalization and no shaping.

### A Character the Font Cannot Encode

`drawText()` and `widthOfTextAtSize()` throw `UnencodableTextError` for the first character the font cannot encode, and nothing of that text is drawn. An embedded font throws it for a character with no glyph, where it used to draw the missing-glyph box. The error carries `character`, `codePoint` (a surrogate pair stays one character), `index` (UTF-16 index in the string), `fontName` (the `BaseFont`) and `encoding` (`'WinAnsiEncoding'`, `'SymbolEncoding'`, `'ZapfDingbatsEncoding'` or `'Identity-H'`). It is an `InvalidArgumentError` with the code `unencodable-text`:

```ts
import { UnencodableTextError } from 'modern-pdf-lib';

try {
  page.drawText('Tokyo 東京', { x: 50, y: 700, size: 16, font: helvetica });
} catch (error) {
  if (!(error instanceof UnencodableTextError)) throw error;
  console.log(error.character, error.codePoint, error.index); // '東' 26481 6
  console.log(error.fontName, error.encoding); // 'Helvetica' 'WinAnsiEncoding'
}
```

The library never swaps in a different font by itself. Embed a font that covers the text, or draw each script in its own font.

### Your Own `FontRef`

`FontRef` is an interface, so you can wrap one, for example to replace the characters a font lacks. `encodeText(text)` is required of every `FontRef`, since `drawText()` writes what it returns: a wrapper adds its own `encodeText` and keeps `widthOfTextAtSize` in step with it. A JavaScript object without `encodeText` makes `drawText()` throw a `TypeError`.

```ts
import type { FontRef } from 'modern-pdf-lib';

const known = new Set(helvetica.getCharacterSet());
const substitute = (text: string): string =>
  Array.from(text.normalize('NFC'), (ch) => (known.has(ch.codePointAt(0) ?? 0) ? ch : '?')).join('');

const lenient: FontRef = {
  ...helvetica,
  widthOfTextAtSize: (text, size) => helvetica.widthOfTextAtSize(substitute(text), size),
  encodeText: (text) => helvetica.encodeText(substitute(text)),
};

page.drawText('Tokyo 東京', { x: 50, y: 650, size: 16, font: lenient }); // draws "Tokyo ??"
```

To write the bytes yourself, pass `font.encodeText(text)` to a text operator: `showTextOp`, `showTextArray`, `showTextNextLine` and `showTextWithSpacing` take the bytes as a `Uint8Array` or as a PDF byte string (one character per byte, U+0000 to U+00FF), and `showTextHex` takes a `Uint8Array` or a string of hex digits.

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

`embedFont()` accepts `{ subset?: boolean }`. By default (`true`) a TrueType or CFF-based OpenType font is subset to the glyphs the document draws when it is saved. `{ subset: false }` embeds the whole font program, so every glyph is available to a later editor; the file grows by the size of the font. If several `embedFont()` calls embed the same font, one `subset: false` makes it whole. The `features` option was removed in 0.41.0: passing it throws `UnsupportedOptionError`.

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

The width is that of the glyphs `encodeText()` writes, so the same text that `drawText()` refuses makes `widthOfTextAtSize()` throw `UnencodableTextError`.

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
