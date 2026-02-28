[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawLineOptions

# Interface: DrawLineOptions

Defined in: [src/core/pdfPage.ts:289](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L289)

Options for [PdfPage.drawLine](../classes/PdfPage.md#drawline).

## Properties

### blendMode?

> `optional` **blendMode**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfPage.ts:305](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L305)

Blend mode for compositing.

***

### color?

> `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:295](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L295)

Line colour.

***

### dashArray?

> `optional` **dashArray**: `number`[]

Defined in: [src/core/pdfPage.ts:299](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L299)

Dash pattern `[dashLength, gapLength]`.

***

### dashPhase?

> `optional` **dashPhase**: `number`

Defined in: [src/core/pdfPage.ts:301](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L301)

Dash phase.

***

### end

> **end**: `object`

Defined in: [src/core/pdfPage.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L293)

End point.

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/pdfPage.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L303)

Opacity `[0, 1]`.

***

### start

> **start**: `object`

Defined in: [src/core/pdfPage.ts:291](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L291)

Start point.

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### thickness?

> `optional` **thickness**: `number`

Defined in: [src/core/pdfPage.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfPage.ts#L297)

Line width.
