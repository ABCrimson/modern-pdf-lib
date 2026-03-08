[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontMetrics

# Interface: FontMetrics

Defined in: [src/assets/font/fontMetrics.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L26)

Complete font metrics extracted from a TrueType / OpenType font file.

All values are in font design units (typically 1000 or 2048 per em)
unless otherwise noted.

## Properties

### ascender

> `readonly` **ascender**: `number`

Defined in: [src/assets/font/fontMetrics.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L30)

Typographic ascender (from `OS/2` sTypoAscender, or `hhea` ascent).

***

### bbox

> `readonly` **bbox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/assets/font/fontMetrics.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L56)

Font bounding box [xMin, yMin, xMax, yMax] from `head` table.

***

### capHeight

> `readonly` **capHeight**: `number`

Defined in: [src/assets/font/fontMetrics.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L36)

Cap height (from `OS/2` sCapHeight, or estimated).

***

### cmapTable

> `readonly` **cmapTable**: `Map`\<`number`, `number`\>

Defined in: [src/assets/font/fontMetrics.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L54)

Map of Unicode codepoint to glyph ID.  Extracted from the `cmap`
table (platform 3 / encoding 1 — Windows BMP, or platform 0).

***

### defaultWidth

> `readonly` **defaultWidth**: `number`

Defined in: [src/assets/font/fontMetrics.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L44)

Default advance width for glyphs not in [glyphWidths](#glyphwidths).

***

### descender

> `readonly` **descender**: `number`

Defined in: [src/assets/font/fontMetrics.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L32)

Typographic descender — negative value (from `OS/2` or `hhea`).

***

### familyName

> `readonly` **familyName**: `string`

Defined in: [src/assets/font/fontMetrics.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L62)

Font family name from the `name` table, if available.

***

### flags

> `readonly` **flags**: `number`

Defined in: [src/assets/font/fontMetrics.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L60)

Font flags for PDF FontDescriptor.

***

### glyphWidths

> `readonly` **glyphWidths**: `Map`\<`number`, `number`\>

Defined in: [src/assets/font/fontMetrics.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L49)

Map of glyph ID to advance width in font design units.
Extracted from the `hmtx` table.

***

### italicAngle

> `readonly` **italicAngle**: `number`

Defined in: [src/assets/font/fontMetrics.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L40)

Italic angle in degrees (from `post` table).

***

### lineGap

> `readonly` **lineGap**: `number`

Defined in: [src/assets/font/fontMetrics.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L34)

Line gap (from `OS/2` sTypoLineGap, or `hhea` lineGap).

***

### numGlyphs

> `readonly` **numGlyphs**: `number`

Defined in: [src/assets/font/fontMetrics.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L42)

Number of glyphs in the font (from `maxp`).

***

### postScriptName

> `readonly` **postScriptName**: `string`

Defined in: [src/assets/font/fontMetrics.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L64)

PostScript name from the `name` table, if available.

***

### stemV

> `readonly` **stemV**: `number`

Defined in: [src/assets/font/fontMetrics.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L58)

StemV estimate for PDF FontDescriptor (or 0 if unknown).

***

### unitsPerEm

> `readonly` **unitsPerEm**: `number`

Defined in: [src/assets/font/fontMetrics.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L28)

Units per em square (from `head` table).

***

### xHeight

> `readonly` **xHeight**: `number`

Defined in: [src/assets/font/fontMetrics.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontMetrics.ts#L38)

x-height (from `OS/2` sxHeight, or estimated).
