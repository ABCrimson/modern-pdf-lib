[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawRectangleOptions

# Interface: DrawRectangleOptions

Defined in: [src/core/pdfPage.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L246)

Options for [PdfPage.drawRectangle](../classes/PdfPage.md#drawrectangle).

## Properties

### blendMode?

> `optional` **blendMode**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfPage.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L266)

Blend mode for compositing.

***

### borderColor?

> `optional` **borderColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L258)

Border (stroke) colour.  Set to `undefined` for no stroke.

***

### borderDashArray?

> `optional` **borderDashArray**: `number`[]

Defined in: [src/core/pdfPage.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L272)

Dash pattern for border `[dashLen, gapLen, ...]`.

***

### borderDashPhase?

> `optional` **borderDashPhase**: `number`

Defined in: [src/core/pdfPage.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L274)

Dash phase offset for border.

***

### borderLineCap?

> `optional` **borderLineCap**: `0` \| `1` \| `2`

Defined in: [src/core/pdfPage.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L276)

Line cap style for border (0 = butt, 1 = round, 2 = projecting square).

***

### borderOpacity?

> `optional` **borderOpacity**: `number`

Defined in: [src/core/pdfPage.ts:278](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L278)

Border stroke opacity `[0, 1]`, separate from fill opacity.

***

### borderWidth?

> `optional` **borderWidth**: `number`

Defined in: [src/core/pdfPage.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L260)

Border width in points.

***

### color?

> `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L256)

Fill colour.  Set to `undefined` for no fill.

***

### height?

> `optional` **height**: `number`

Defined in: [src/core/pdfPage.ts:254](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L254)

Rectangle height.

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/pdfPage.ts:264](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L264)

Opacity `[0, 1]`.

***

### rotate?

> `optional` **rotate**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L262)

Rotation angle.

***

### width?

> `optional` **width**: `number`

Defined in: [src/core/pdfPage.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L252)

Rectangle width.

***

### x?

> `optional` **x**: `number`

Defined in: [src/core/pdfPage.ts:248](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L248)

X coordinate.

***

### xSkew?

> `optional` **xSkew**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:268](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L268)

Horizontal skew angle.

***

### y?

> `optional` **y**: `number`

Defined in: [src/core/pdfPage.ts:250](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L250)

Y coordinate.

***

### ySkew?

> `optional` **ySkew**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:270](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L270)

Vertical skew angle.
