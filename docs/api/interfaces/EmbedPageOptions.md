[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedPageOptions

# Interface: EmbedPageOptions

Defined in: [src/core/pdfEmbed.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfEmbed.ts#L105)

Options for embedding a page as a Form XObject.

## Properties

### boundingBox?

> `optional` **boundingBox**: `object`

Defined in: [src/core/pdfEmbed.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfEmbed.ts#L110)

Clip the embedded page to a sub-region (bounding box).
Coordinates are in the source page's coordinate system.

#### height

> **height**: `number`

#### width

> **width**: `number`

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### transformationMatrix?

> `optional` **transformationMatrix**: \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfEmbed.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfEmbed.ts#L122)

Apply an affine transformation matrix to the Form XObject.
The six values correspond to `[a, b, c, d, tx, ty]` in the
standard 3x3 PDF transformation matrix.
