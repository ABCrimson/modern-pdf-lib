[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedPageOptions

# Interface: EmbedPageOptions

Defined in: [src/core/pdfEmbed.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L106)

Options for embedding a page as a Form XObject.

## Properties

### boundingBox?

> `optional` **boundingBox?**: `object`

Defined in: [src/core/pdfEmbed.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L111)

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

> `optional` **transformationMatrix?**: \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfEmbed.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L123)

Apply an affine transformation matrix to the Form XObject.
The six values correspond to `[a, b, c, d, tx, ty]` in the
standard 3x3 PDF transformation matrix.
