[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawLineOptions

# Interface: DrawLineOptions

Defined in: [src/core/pdfPage.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L293)

Options for [PdfPage.drawLine](../classes/PdfPage.md#drawline).

## Properties

### blendMode?

> `optional` **blendMode**: [`BlendMode`](../type-aliases/BlendMode.md)

Defined in: [src/core/pdfPage.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L309)

Blend mode for compositing.

***

### color?

> `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:299](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L299)

Line colour.

***

### dashArray?

> `optional` **dashArray**: `number`[]

Defined in: [src/core/pdfPage.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L303)

Dash pattern `[dashLength, gapLength]`.

***

### dashPhase?

> `optional` **dashPhase**: `number`

Defined in: [src/core/pdfPage.ts:305](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L305)

Dash phase.

***

### end

> **end**: `object`

Defined in: [src/core/pdfPage.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L297)

End point.

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/pdfPage.ts:307](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L307)

Opacity `[0, 1]`.

***

### start

> **start**: `object`

Defined in: [src/core/pdfPage.ts:295](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L295)

Start point.

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### thickness?

> `optional` **thickness**: `number`

Defined in: [src/core/pdfPage.ts:301](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L301)

Line width.
