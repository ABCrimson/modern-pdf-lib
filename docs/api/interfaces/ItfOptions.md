[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ItfOptions

# Interface: ItfOptions

Defined in: [src/barcode/itf.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L59)

Options for rendering an ITF barcode as PDF operators.

## Properties

### bearerBars?

> `readonly` `optional` **bearerBars**: `boolean`

Defined in: [src/barcode/itf.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L76)

Add horizontal bearer bars at the top and bottom of the barcode.
Bearer bars help prevent partial reads. Default: `false`.

***

### bearerBarWidth?

> `readonly` `optional` **bearerBarWidth**: `number`

Defined in: [src/barcode/itf.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L81)

Width of the bearer bars in user-space units. Only used when
`bearerBars` is `true`. Default: `2`.

***

### color?

> `readonly` `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/itf.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L69)

Bar colour. Default: grayscale black.

***

### height?

> `readonly` `optional` **height**: `number`

Defined in: [src/barcode/itf.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L61)

Height of the bars in user-space units. Default: `50`.

***

### moduleWidth?

> `readonly` `optional` **moduleWidth**: `number`

Defined in: [src/barcode/itf.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L63)

Width of a narrow module in user-space units. Default: `1`.

***

### quietZone?

> `readonly` `optional` **quietZone**: `number`

Defined in: [src/barcode/itf.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L67)

Quiet-zone width in narrow modules on each side. Default: `10`.

***

### showText?

> `readonly` `optional` **showText**: `boolean`

Defined in: [src/barcode/itf.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L71)

Show human-readable text below the barcode. Default: `false`.

***

### wideToNarrowRatio?

> `readonly` `optional` **wideToNarrowRatio**: `number`

Defined in: [src/barcode/itf.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L65)

Wide-to-narrow ratio. Default: `3`. Must be >= 2.
