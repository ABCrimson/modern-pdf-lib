[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawRectangleOptions

# Interface: DrawRectangleOptions

Defined in: [src/core/pdfPage.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L253)

Options for [PdfPage.drawRectangle](../classes/PdfPage.md#drawrectangle).

## Properties

### blendMode?

> `optional` **blendMode**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfPage.ts:273](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L273)

Blend mode for compositing.

***

### borderColor?

> `optional` **borderColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L265)

Border (stroke) colour.  Set to `undefined` for no stroke.

***

### borderDashArray?

> `optional` **borderDashArray**: `number`[]

Defined in: [src/core/pdfPage.ts:279](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L279)

Dash pattern for border `[dashLen, gapLen, ...]`.

***

### borderDashPhase?

> `optional` **borderDashPhase**: `number`

Defined in: [src/core/pdfPage.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L281)

Dash phase offset for border.

***

### borderLineCap?

> `optional` **borderLineCap**: `0` \| `1` \| `2`

Defined in: [src/core/pdfPage.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L283)

Line cap style for border (0 = butt, 1 = round, 2 = projecting square).

***

### borderOpacity?

> `optional` **borderOpacity**: `number`

Defined in: [src/core/pdfPage.ts:285](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L285)

Border stroke opacity `[0, 1]`, separate from fill opacity.

***

### borderWidth?

> `optional` **borderWidth**: `number`

Defined in: [src/core/pdfPage.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L267)

Border width in points.

***

### color?

> `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:263](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L263)

Fill colour.  Set to `undefined` for no fill.

***

### height?

> `optional` **height**: `number`

Defined in: [src/core/pdfPage.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L261)

Rectangle height.

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/pdfPage.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L271)

Opacity `[0, 1]`.

***

### rotate?

> `optional` **rotate**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L269)

Rotation angle.

***

### width?

> `optional` **width**: `number`

Defined in: [src/core/pdfPage.ts:259](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L259)

Rectangle width.

***

### x?

> `optional` **x**: `number`

Defined in: [src/core/pdfPage.ts:255](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L255)

X coordinate.

***

### xSkew?

> `optional` **xSkew**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L275)

Horizontal skew angle.

***

### y?

> `optional` **y**: `number`

Defined in: [src/core/pdfPage.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L257)

Y coordinate.

***

### ySkew?

> `optional` **ySkew**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfPage.ts#L277)

Vertical skew angle.
