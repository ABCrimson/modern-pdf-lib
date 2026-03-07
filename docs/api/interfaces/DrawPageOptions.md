[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawPageOptions

# Interface: DrawPageOptions

Defined in: [src/core/pdfEmbed.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L77)

Options for [PdfPage.drawPage](../classes/PdfPage.md#drawpage).

## Properties

### blendMode?

> `optional` **blendMode**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfEmbed.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L91)

Blend mode for compositing.

***

### height?

> `optional` **height**: `number`

Defined in: [src/core/pdfEmbed.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L85)

Rendered height (defaults to the embedded page's original height).

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/pdfEmbed.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L89)

Opacity `[0, 1]`.

***

### rotate?

> `optional` **rotate**: `object`

Defined in: [src/core/pdfEmbed.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L87)

Rotation angle.

#### type

> **type**: `"degrees"` \| `"radians"`

#### value

> **value**: `number`

***

### width?

> `optional` **width**: `number`

Defined in: [src/core/pdfEmbed.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L83)

Rendered width (defaults to the embedded page's original width).

***

### x?

> `optional` **x**: `number`

Defined in: [src/core/pdfEmbed.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L79)

X coordinate of the lower-left corner.

***

### xSkew?

> `optional` **xSkew**: `object`

Defined in: [src/core/pdfEmbed.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L93)

Horizontal skew angle.

#### type

> **type**: `"degrees"` \| `"radians"`

#### value

> **value**: `number`

***

### y?

> `optional` **y**: `number`

Defined in: [src/core/pdfEmbed.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L81)

Y coordinate of the lower-left corner.

***

### ySkew?

> `optional` **ySkew**: `object`

Defined in: [src/core/pdfEmbed.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfEmbed.ts#L95)

Vertical skew angle.

#### type

> **type**: `"degrees"` \| `"radians"`

#### value

> **value**: `number`
