# Text Drawing

This guide covers everything you need to know about drawing text on a PDF page with `modern-pdf-lib`.

## Basic Text Drawing

Use `page.drawText()` to place a string at a specific position. Coordinates are in PDF points (1 point = 1/72 inch), with the origin at the bottom-left corner of the page.

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);

page.drawText('Hello, world!', {
  x: 50,
  y: 700,
  size: 16,
  font: helvetica,
  color: rgb(0, 0, 0),
});

const bytes = await pdf.save();
```

Every drawn string needs a font that is registered on the document — embed one once with `embedFont()` (a standard font here, so no font file is required) and pass it via the `font` option. The examples below assume `helvetica` is in scope.

## Font Sizes and Colors

Control the appearance of text with the `size` and `color` options:

```ts
// Large red heading
page.drawText('Important Notice', {
  x: 50,
  y: 750,
  size: 36,
  font: helvetica,
  color: rgb(0.8, 0.1, 0.1),
});

// Small gray body text
page.drawText('Please read the following terms carefully.', {
  x: 50,
  y: 710,
  size: 11,
  font: helvetica,
  color: rgb(0.4, 0.4, 0.4),
});
```

Colors can be specified in RGB, CMYK, or grayscale:

```ts
import { rgb, cmyk, grayscale } from 'modern-pdf-lib';

// RGB (values 0–1)
const red = rgb(1, 0, 0);

// CMYK (values 0–1)
const richBlack = cmyk(0.75, 0.68, 0.67, 0.90);

// Grayscale (value 0–1, where 0 = black)
const darkGray = grayscale(0.3);
```

## Multi-line Text

Pass a string containing newline characters (`\n`) to draw multi-line text. The `lineHeight` option controls the spacing between lines:

```ts
page.drawText('Line one\nLine two\nLine three', {
  x: 50,
  y: 700,
  size: 14,
  font: helvetica,
  color: rgb(0, 0, 0),
  lineHeight: 20,
});
```

> [!TIP]
> When `lineHeight` is omitted, a default of `size * 1.2` is used — this works well for most body text.

`\n`, `\r\n` and `\r` each break a line. A tab or any other control character throws `UnencodableTextError`, so replace tabs before drawing:

```ts
page.drawText('Name:\tAda'.replaceAll('\t', '    '), { x: 50, y: 650, size: 14, font: helvetica });
```

## Text Measurement

Use `font.widthOfTextAtSize()` to measure the width of a string before drawing it. This is useful for right-aligning text or centering it on the page:

```ts
const font = await pdf.embedFont(fontBytes);

const text = 'Centered Title';
const fontSize = 24;
const textWidth = font.widthOfTextAtSize(text, fontSize);
const pageWidth = PageSizes.A4[0]; // 595.28 points

page.drawText(text, {
  x: (pageWidth - textWidth) / 2,
  y: 700,
  font,
  size: fontSize,
  color: rgb(0, 0, 0),
});
```

You can also retrieve font height for precise vertical alignment:

```ts
const textHeight = font.heightAtSize(fontSize);
```

## Text Rotation

Rotate text around its anchor point using the `rotate` option:

```ts
import { degrees } from 'modern-pdf-lib';

// Draw text at a 45-degree angle
page.drawText('Rotated!', {
  x: 200,
  y: 400,
  size: 20,
  font: helvetica,
  color: rgb(0, 0, 0.7),
  rotate: degrees(45),
});

// Vertical text (90 degrees)
page.drawText('Vertical', {
  x: 30,
  y: 300,
  size: 14,
  font: helvetica,
  color: rgb(0, 0, 0),
  rotate: degrees(90),
});
```

The rotation is counter-clockwise, following the standard PDF coordinate system.

## Standard Fonts vs Custom Fonts

### Standard Fonts

Every PDF viewer includes 14 built-in standard fonts. Pass a standard font name to `embedFont()` — no font file needed (only a small font dictionary is written, never glyph data):

```ts
import { StandardFonts } from 'modern-pdf-lib';

const helvetica = await pdf.embedFont(StandardFonts.Helvetica);

page.drawText('Standard font text', {
  x: 50,
  y: 700,
  size: 14,
  color: rgb(0, 0, 0),
  font: helvetica,
});
```

The returned `FontRef` also gives you metrics (`widthOfTextAtSize`, `heightAtSize`) backed by the built-in AFM data, so measurement works exactly as with embedded fonts.

The 12 Latin standard fonts write their text in WinAnsiEncoding, one byte per character, after normalizing it to Unicode form NFC. That covers ASCII, Latin-1 and extras such as `€` and `—`, so accented text just works:

```ts
page.drawText('Größe: 12 € — café', { x: 50, y: 650, size: 14, font: helvetica });
page.drawText('cafe\u0301', { x: 50, y: 630, size: 14, font: helvetica }); // decomposed input is drawn as "café"
```

A character the font cannot encode, such as `'東京'`, makes `drawText()` throw `UnencodableTextError`; its `character`, `codePoint`, `index`, `fontName` and `encoding` fields name the character and the font, and nothing of the text is drawn. Symbol and ZapfDingbats take Unicode text (`'αβγ'`, `'✓'`) and write their own codes. [How Text Is Encoded](/guide/fonts#how-text-is-encoded) has the table of fonts and encodings.

Available standard fonts:

| Font Name | Identifier |
|---|---|
| Helvetica | `StandardFonts.Helvetica` |
| Helvetica Bold | `StandardFonts.HelveticaBold` |
| Helvetica Oblique | `StandardFonts.HelveticaOblique` |
| Helvetica Bold Oblique | `StandardFonts.HelveticaBoldOblique` |
| Times Roman | `StandardFonts.TimesRoman` |
| Times Bold | `StandardFonts.TimesBold` |
| Times Italic | `StandardFonts.TimesItalic` |
| Times Bold Italic | `StandardFonts.TimesBoldItalic` |
| Courier | `StandardFonts.Courier` |
| Courier Bold | `StandardFonts.CourierBold` |
| Courier Oblique | `StandardFonts.CourierOblique` |
| Courier Bold Oblique | `StandardFonts.CourierBoldOblique` |
| Symbol | `StandardFonts.Symbol` |
| ZapfDingbats | `StandardFonts.ZapfDingbats` |

### Custom Fonts

To draw any script and to control the typography, embed a TrueType or OpenType font. Text is written as 2 bytes per glyph (Identity-H) through the font `cmap`, with no normalization and no shaping, and `drawText()` throws `UnencodableTextError` for a character the font has no glyph for (it no longer draws the missing-glyph box):

```ts
const fontBytes = await fetch('/fonts/Inter-Regular.ttf')
  .then((res) => res.arrayBuffer())
  .then((buf) => new Uint8Array(buf));

const font = await pdf.embedFont(fontBytes);

page.drawText('Custom font text with Unicode: café 日本語', {
  x: 50,
  y: 700,
  font,
  size: 16,
  color: rgb(0, 0, 0),
});
```

The sample assumes the font has glyphs for `日本語`; `font.getCharacterSet()` lists the code points it has.

See the [Fonts guide](/guide/fonts) for details on subsetting, bidirectional text, and font metrics.

## Document Text

Text that is not drawn on a page, such as the title, author, subject, keywords, creator and producer of the document information, the title of an outline entry, and the contents and author of an annotation, is written as a PDF text string: PDFDocEncoding when every character is in it, otherwise UTF-16BE with a byte order mark. `getTitle()` and the other getters give the characters back:

```ts
import { createPdf, loadPdf } from 'modern-pdf-lib';

const doc = createPdf();
doc.addPage();
doc.setTitle('日本語 €'); // written as UTF-16BE
doc.setAuthor('Zoë'); // written as PDFDocEncoding, one byte per character
doc.addOutline('Kapitel 1 — Einführung', 0);

const reloaded = await loadPdf(await doc.save());
console.log(reloaded.getTitle(), reloaded.getAuthor()); // 日本語 € Zoë
```

A character no text string can hold (U+001B, for example) makes `save()` throw `UnencodableTextError` with the encoding `'PDF text string'`.

## Files Written by 0.40.x

Version 0.40.x wrote non-ASCII text as UTF-8 bytes, in the content stream and in the document information. Every reader shows those files with text such as `CafÃ©` for `Café`, and loading and saving them does not change that: files written by 0.40.x stay as written. Draw the text again with the current version to get a file that reads correctly.

## Options Reference

::: details Full `drawText()` Options
| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Cursor position (initially `0`) | Horizontal position in points |
| `y` | `number` | Cursor position (initially `0`) | Vertical position in points (from bottom) |
| `size` | `number` | `12` (or page default) | Font size in points |
| `font` | `FontRef \| string` | `page.setFont()` value, else resource `F1` (the first embedded font) | Font to use — a `FontRef` from `embedFont()`, or a raw font resource name string (its text is encoded as WinAnsi) |
| `color` | `Color` | Black | Text color |
| `rotate` | `Angle` | `degrees(0)` | Rotation angle |
| `lineHeight` | `number` | `size * 1.2` | Vertical spacing for multi-line text |
| `opacity` | `number` | `1` | Text opacity (0 to 1) |
| `blendMode` | `BlendMode` | `'Normal'` | Blend mode for compositing |
| `renderingMode` | `TextRenderingMode` | Fill | Fill, stroke, invisible, clip, etc. |
| `xSkew` / `ySkew` | `Angle` | `degrees(0)` | Skew angles (italic-like effects) |
| `maxWidth` | `number` | — | Wrap text at word boundaries to fit this width (requires a `FontRef` font) |
| `wordBreaks` | `string[]` | `[' ']` | Extra characters where wrapped text may break (e.g. `[' ', '-', '/']`) |
:::
