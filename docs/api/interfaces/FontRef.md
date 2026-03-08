[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontRef

# Interface: FontRef

Defined in: [src/core/pdfPage.ts:460](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L460)

Opaque handle for a font that has been embedded in the document.

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:462](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L462)

Resource name used in content-stream operators (e.g. `F1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:464](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L464)

Indirect reference to the font dictionary.

## Methods

### getCharacterSet()?

> `optional` **getCharacterSet**(): `number`[]

Defined in: [src/core/pdfPage.ts:503](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L503)

Return the set of Unicode codepoints supported by this font.

For standard fonts, returns the WinAnsi character set.
For embedded fonts, returns all codepoints in the cmap table.

#### Returns

`number`[]

Array of Unicode codepoint numbers.

***

### heightAtSize()

> **heightAtSize**(`size`): `number`

Defined in: [src/core/pdfPage.ts:474](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L474)

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

Defined in: [src/core/pdfPage.ts:494](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L494)

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

Defined in: [src/core/pdfPage.ts:469](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfPage.ts#L469)

Compute the width of a text string at the given font size (in points).
Available for both standard and TrueType fonts.

#### Parameters

##### text

`string`

##### size

`number`

#### Returns

`number`
