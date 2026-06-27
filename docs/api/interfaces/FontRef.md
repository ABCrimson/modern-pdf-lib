[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontRef

# Interface: FontRef

Defined in: [src/core/pdfPage.ts:474](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L474)

Opaque handle for a font that has been embedded in the document.

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/core/pdfPage.ts:476](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L476)

Resource name used in content-stream operators (e.g. `F1`).

***

### ref

```ts
readonly ref: PdfRef;
```

Defined in: [src/core/pdfPage.ts:478](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L478)

Indirect reference to the font dictionary.

## Methods

### getCharacterSet()

```ts
getCharacterSet(): number[];
```

Defined in: [src/core/pdfPage.ts:512](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L512)

Return the set of Unicode codepoints supported by this font.

For standard fonts, returns the WinAnsi character set.
For embedded fonts, returns all codepoints in the cmap table.

#### Returns

`number`[]

Array of Unicode codepoint numbers.

***

### heightAtSize()

```ts
heightAtSize(size): number;
```

Defined in: [src/core/pdfPage.ts:495](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L495)

Compute the height of the font at the given size (ascender - descender).
Available for both standard and TrueType fonts.

#### Parameters

##### size

`number`

Font size in points.

#### Returns

`number`

Height in points.

***

### sizeAtHeight()

```ts
sizeAtHeight(height): number;
```

Defined in: [src/core/pdfPage.ts:503](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L503)

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

```ts
widthOfTextAtSize(text, size): number;
```

Defined in: [src/core/pdfPage.ts:487](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L487)

Compute the width of a text string at the given font size (in points).
Available for both standard and TrueType fonts.

#### Parameters

##### text

`string`

The text string to measure.

##### size

`number`

Font size in points.

#### Returns

`number`

Width of the text in points.
