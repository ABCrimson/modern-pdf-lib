# Fonts

This guide covers font handling in `modern-pdf-lib`, including standard fonts, custom font embedding, subsetting, and complex script support.

## Standard 14 PDF Fonts

The PDF specification defines 14 standard fonts that every PDF viewer must support. These fonts can be used without embedding any font data, keeping file sizes small:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

page.drawText('Helvetica text', {
  x: 50,
  y: 700,
  size: 16,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});

page.drawText('Times Roman text', {
  x: 50,
  y: 670,
  size: 16,
  font: StandardFonts.TimesRoman,
  color: rgb(0, 0, 0),
});

page.drawText('Courier text', {
  x: 50,
  y: 640,
  size: 16,
  font: StandardFonts.Courier,
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

page.drawText('Custom font with full Unicode: Aakenaargh 日本語', {
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

By default, `modern-pdf-lib` embeds only the glyphs that are actually used in the document. This dramatically reduces file size when working with large fonts (CJK fonts can be 10+ MB).

```ts
// Only the glyphs for "Hello" are included in the PDF
const font = await pdf.embedFont(fontBytes);
page.drawText('Hello', { x: 50, y: 700, font, size: 16 });
```

The subsetter operates at the binary TrueType level — it rebuilds `glyf`, `loca`, `hmtx`, `maxp`, and `cmap` tables from scratch, resolves composite glyph dependencies, and produces a valid TrueType file with correct checksums and 4-byte alignment. This is a pure-JS implementation that works in every runtime without WASM.

### What Gets Subsetted

| Table | Action |
|---|---|
| `glyf` | Only referenced glyphs (including composites) |
| `loca` | Rebuilt with new offsets |
| `hmtx` | Only metrics for included glyphs |
| `maxp` | Updated glyph count |
| `cmap` | Minimal Format 4 subtable for the subset |
| `head` | Checksum recalculated |
| `name`, `post`, `OS/2`, `hhea` | Copied from original |

### Disabling Subsetting

In rare cases (such as when creating PDF form templates where users may enter arbitrary text), you may want to embed the full font:

```ts
const font = await pdf.embedFont(fontBytes, { subset: false });
```

> [!TIP]
> Keep subsetting enabled for document generation. It typically reduces font data by 90% or more — a 10 MB CJK font embedding just 5 characters can drop to under 50 KB.

## Text Shaping for Complex Scripts

For scripts that require ligatures, contextual forms, or right-to-left layout (Arabic, Hebrew, Devanagari, Thai, etc.), `modern-pdf-lib` uses the `rustybuzz` WASM module for text shaping.

Text shaping handles:

- **Ligatures** — Combining character sequences (e.g., "fi", "ffl" in Latin scripts)
- **Contextual forms** — Arabic letters changing shape based on position
- **Right-to-left layout** — Correct character ordering for RTL scripts
- **Mark positioning** — Proper placement of diacritics and vowel marks

```ts
const arabicFont = await pdf.embedFont(arabicFontBytes);

page.drawText('مرحبا بالعالم', {
  x: 400,
  y: 700,
  font: arabicFont,
  size: 24,
  color: rgb(0, 0, 0),
});
```

Basic text shaping (Latin ligatures, CJK mapping) works out of the box with pure JS. For full OpenType shaping of complex scripts (Arabic contextual forms, Devanagari conjuncts, Thai word breaking), initialize the rustybuzz WASM module:

The text shaping WASM module is loaded automatically when complex script rendering is needed. No explicit initialization is required — the library detects when shaping is necessary and uses the WASM accelerator if available, falling back to the pure-JS implementation otherwise.

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

| Operation | Pure JS | WASM (optional) | Notes |
|---|---|---|---|
| Font parsing | Built-in | ttf-parser | Metric extraction from large fonts |
| Subsetting | Built-in | — | Pure JS handles all TrueType subsetting |
| Text shaping | Latin/CJK | rustybuzz | WASM needed for Arabic, Devanagari, etc. |
| Width measurement | Built-in | — | Computed from cached glyph metrics |

The pure-JS subsetter and metric extractor work in every runtime. WASM modules are optional accelerators — they produce identical results, just faster for large fonts and complex scripts.

```ts
import { initWasm } from 'modern-pdf-lib';

// Optionally load WASM for faster font parsing
await initWasm({ fonts: true });

const font = await pdf.embedFont(largeCjkFontBytes);
```
