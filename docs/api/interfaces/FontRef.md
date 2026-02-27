[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontRef

# Interface: FontRef

Defined in: [src/core/pdfPage.ts:431](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L431)

Opaque handle for a font that has been embedded in the document.

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:433](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L433)

Resource name used in content-stream operators (e.g. `F1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:435](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L435)

Indirect reference to the font dictionary.

## Methods

### getCharacterSet()?

> `optional` **getCharacterSet**(): `number`[]

Defined in: [src/core/pdfPage.ts:474](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L474)

Return the set of Unicode codepoints supported by this font.

For standard fonts, returns the WinAnsi character set.
For embedded fonts, returns all codepoints in the cmap table.

#### Returns

`number`[]

Array of Unicode codepoint numbers.

***

### heightAtSize()

> **heightAtSize**(`size`): `number`

Defined in: [src/core/pdfPage.ts:445](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L445)

Compute the height of the font at the given size (ascender - descender).
Available for both standard and TrueType fonts.

#### Parameters

##### size

`number`

#### Returns

`number`

***

### sizeAtHeight()?

> `optional` **sizeAtHeight**(`height`): `number`

Defined in: [src/core/pdfPage.ts:465](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L465)

Compute the font size needed to achieve a given height (ascender - descender).
This is the inverse of `heightAtSize()`.

#### Parameters

##### height

`number`

Desired height in points.

#### Returns

`number`

Font size in points.

***

### widthOfTextAtSize()

> **widthOfTextAtSize**(`text`, `size`): `number`

Defined in: [src/core/pdfPage.ts:440](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfPage.ts#L440)

Compute the width of a text string at the given font size (in points).
Available for both standard and TrueType fonts.

#### Parameters

##### text

`string`

##### size

`number`

#### Returns

`number`
