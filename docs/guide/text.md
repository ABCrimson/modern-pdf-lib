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
  color: rgb(0.8, 0.1, 0.1),
});

// Small gray body text
page.drawText('Please read the following terms carefully.', {
  x: 50,
  y: 710,
  size: 11,
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
  color: rgb(0, 0, 0),
  lineHeight: 20,
});
```

> [!TIP]
> When `lineHeight` is omitted, a default of `size * 1.2` is used — this works well for most body text.

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
  color: rgb(0, 0, 0.7),
  rotate: degrees(45),
});

// Vertical text (90 degrees)
page.drawText('Vertical', {
  x: 30,
  y: 300,
  size: 14,
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

For full Unicode support and precise typography, embed a TrueType or OpenType font:

```ts
const fontBytes = await fetch('/fonts/Inter-Regular.ttf')
  .then((res) => res.arrayBuffer())
  .then((buf) => new Uint8Array(buf));

const font = await pdf.embedFont(fontBytes);

page.drawText('Custom font text with Unicode: cafe\u0301', {
  x: 50,
  y: 700,
  font,
  size: 16,
  color: rgb(0, 0, 0),
});
```

See the [Fonts guide](/guide/fonts) for details on subsetting, complex script shaping, and font metrics.

## Options Reference

::: details Full `drawText()` Options
| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Cursor position (initially `0`) | Horizontal position in points |
| `y` | `number` | Cursor position (initially `0`) | Vertical position in points (from bottom) |
| `size` | `number` | `12` (or page default) | Font size in points |
| `font` | `FontRef \| string` | Page default font | Font to use — a `FontRef` from `embedFont()`, or a raw font resource name string |
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
