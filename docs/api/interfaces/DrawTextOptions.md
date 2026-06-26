[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawTextOptions

# Interface: DrawTextOptions

Defined in: [src/core/pdfPage.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L169)

Options for [PdfPage.drawText](../classes/PdfPage.md#drawtext).

## Properties

### blendMode?

> `optional` **blendMode?**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfPage.ts:195](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L195)

Blend mode for compositing.

***

### color?

> `optional` **color?**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:187](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L187)

Text colour.  Defaults to black.

***

### font?

> `optional` **font?**: `string` \| [`FontRef`](FontRef.md)

Defined in: [src/core/pdfPage.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L183)

Font to use for rendering.

Accepts either a [FontRef](FontRef.md) object (returned by `doc.embedFont()`)
or a font resource name string (e.g. `'F1'`).

When a `FontRef` is provided, its `name` property is used as the
resource name and its CID encoder (if any) is used automatically.

***

### lineHeight?

> `optional` **lineHeight?**: `number`

Defined in: [src/core/pdfPage.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L191)

Line height for multi-line text.

***

### maxWidth?

> `optional` **maxWidth?**: `number`

Defined in: [src/core/pdfPage.ts:212](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L212)

Maximum width in points before text is automatically wrapped.

When provided with a [FontRef](FontRef.md) font (which has `widthOfTextAtSize`),
the text is broken at word boundaries to fit within this width.
If a single word exceeds `maxWidth`, it is broken at character level.

When the font is a plain string (no measurement available), this
option is ignored.

***

### opacity?

> `optional` **opacity?**: `number`

Defined in: [src/core/pdfPage.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L193)

Opacity `[0, 1]`.

***

### renderingMode?

> `optional` **renderingMode?**: [`TextRenderingMode`](../type-aliases/TextRenderingMode.md)

Defined in: [src/core/pdfPage.ts:197](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L197)

Text rendering mode (fill, stroke, invisible, clip, etc.).

***

### rotate?

> `optional` **rotate?**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L189)

Rotation angle.

***

### size?

> `optional` **size?**: `number`

Defined in: [src/core/pdfPage.ts:185](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L185)

Font size in points.

***

### wordBreaks?

> `optional` **wordBreaks?**: `string`[]

Defined in: [src/core/pdfPage.ts:223](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L223)

Characters at which text may be broken when wrapping.

Defaults to `[' ']` (space only).  Pass additional characters such as
`[' ', '-', '/']` to allow breaks at hyphens, slashes, etc.

The break character is kept at the **end** of the preceding line
(e.g. `'hello-'` / `'world'`), except for space which is consumed
as in the default behaviour.

***

### x?

> `optional` **x?**: `number`

Defined in: [src/core/pdfPage.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L171)

X coordinate.

***

### xSkew?

> `optional` **xSkew?**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L199)

Horizontal skew angle (italic-like effect).

***

### y?

> `optional` **y?**: `number`

Defined in: [src/core/pdfPage.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L173)

Y coordinate.

***

### ySkew?

> `optional` **ySkew?**: [`Angle`](../type-aliases/Angle.md)

Defined in: [src/core/pdfPage.ts:201](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L201)

Vertical skew angle.
