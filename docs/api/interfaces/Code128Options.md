[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Code128Options

# Interface: Code128Options

Defined in: [src/barcode/code128.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L155)

Options for rendering a Code 128 barcode as PDF operators.

## Properties

### color?

> `readonly` `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/code128.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L163)

Bar colour. Default: black (grayscale 0).

***

### fontSize?

> `readonly` `optional` **fontSize**: `number`

Defined in: [src/barcode/code128.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L167)

Font size for the human-readable text. Default: `10`.

***

### height?

> `readonly` `optional` **height**: `number`

Defined in: [src/barcode/code128.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L157)

Bar height in points. Default: `50`.

***

### moduleWidth?

> `readonly` `optional` **moduleWidth**: `number`

Defined in: [src/barcode/code128.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L159)

Narrow bar (module) width in points. Default: `1`.

***

### quietZone?

> `readonly` `optional` **quietZone**: `number`

Defined in: [src/barcode/code128.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L161)

Quiet zone width in modules. Default: `10`.

***

### showText?

> `readonly` `optional` **showText**: `boolean`

Defined in: [src/barcode/code128.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code128.ts#L165)

Show human-readable text below the barcode. Default: `false`.
