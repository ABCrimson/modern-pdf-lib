[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbeddedFont

# Class: EmbeddedFont

Defined in: [src/assets/font/fontEmbed.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L44)

Represents a TrueType / OpenType font that has been loaded for
embedding in a PDF document.

Tracks which glyphs have been used so that subsetting can be
performed at save time, and provides text measurement methods.

Create via embedFont.

## Properties

### fontData

> `readonly` **fontData**: `Uint8Array`

Defined in: [src/assets/font/fontEmbed.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L46)

The raw font file bytes.

***

### metrics

> `readonly` **metrics**: [`FontMetrics`](../interfaces/FontMetrics.md)

Defined in: [src/assets/font/fontEmbed.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L49)

Extracted font metrics.

## Methods

### ascentAtSize()

> **ascentAtSize**(`fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L116)

Compute the ascender height at the given font size.

#### Parameters

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The ascender height in points (positive).

***

### buildEmbedding()

> **buildEmbedding**(): `FontEmbeddingResult`

Defined in: [src/assets/font/fontEmbed.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L237)

Build the complete set of PDF dictionary data needed to embed this
font.  This performs subsetting (if WASM is available) and generates
all required dictionaries.

Call this at document save time, after all text has been drawn.

#### Returns

`FontEmbeddingResult`

The embedding result containing all PDF object data.

***

### capHeightAtSize()

> **capHeightAtSize**(`fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L136)

Compute the cap height at the given font size.

#### Parameters

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The cap height in points.

***

### descentAtSize()

> **descentAtSize**(`fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L126)

Compute the descender depth at the given font size.

#### Parameters

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The descender depth in points (negative).

***

### encodeText()

> **encodeText**(`text`): `string`

Defined in: [src/assets/font/fontEmbed.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L208)

Encode a text string as hex-encoded CID bytes for use in PDF
content stream `Tj` / `TJ` operators.

For a CIDFont Type 2 with Identity-H encoding, each character is
mapped to its glyph ID and encoded as a 2-byte big-endian value.

#### Parameters

##### text

`string`

The text to encode.

#### Returns

`string`

Hex string (e.g. `"00480065006C006C006F"` for "Hello").

***

### getUsedGlyphs()

> **getUsedGlyphs**(): `ReadonlySet`\<`number`\>

Defined in: [src/assets/font/fontEmbed.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L190)

Get the set of all glyph IDs that have been used.

#### Returns

`ReadonlySet`\<`number`\>

***

### heightAtSize()

> **heightAtSize**(`fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L105)

Compute the height of the font at the given size.

Returns the distance from the descender to the ascender line,
which is the "em height" scaled to the font size.

#### Parameters

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The font height in points.

***

### lineHeightAtSize()

> **lineHeightAtSize**(`fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L146)

Compute the line height (ascent - descent + lineGap) at size.

#### Parameters

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The default line height in points.

***

### markCodepointUsed()

> **markCodepointUsed**(`codepoint`): `void`

Defined in: [src/assets/font/fontEmbed.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L160)

Mark a Unicode codepoint as used (records its glyph ID for subsetting).

#### Parameters

##### codepoint

`number`

The Unicode codepoint.

#### Returns

`void`

***

### markGlyphUsed()

> **markGlyphUsed**(`glyphId`): `void`

Defined in: [src/assets/font/fontEmbed.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L170)

Mark a glyph ID as used directly.

#### Parameters

##### glyphId

`number`

The glyph ID.

#### Returns

`void`

***

### markTextUsed()

> **markTextUsed**(`text`): `void`

Defined in: [src/assets/font/fontEmbed.ts:179](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L179)

Mark all codepoints in a text string as used.

#### Parameters

##### text

`string`

The text string.

#### Returns

`void`

***

### widthOfTextAtSize()

> **widthOfTextAtSize**(`text`, `fontSize`): `number`

Defined in: [src/assets/font/fontEmbed.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/font/fontEmbed.ts#L76)

Compute the width of a text string at the given font size.

This also records all glyph IDs used by the text for subsetting.

#### Parameters

##### text

`string`

The text string to measure.

##### fontSize

`number`

The font size in points.

#### Returns

`number`

The total advance width in points.
