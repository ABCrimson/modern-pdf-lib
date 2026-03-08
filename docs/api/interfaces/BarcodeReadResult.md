[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BarcodeReadResult

# Interface: BarcodeReadResult

Defined in: [src/barcode/reader.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/reader.ts#L24)

Result of a barcode read operation.

## Properties

### checkDigitValid?

> `readonly` `optional` **checkDigitValid**: `boolean`

Defined in: [src/barcode/reader.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/reader.ts#L32)

Whether the check digit is valid (if applicable).

***

### data

> `readonly` **data**: `string`

Defined in: [src/barcode/reader.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/reader.ts#L26)

The decoded data string.

***

### format

> `readonly` **format**: `string`

Defined in: [src/barcode/reader.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/reader.ts#L28)

The detected barcode format.

***

### valid

> `readonly` **valid**: `boolean`

Defined in: [src/barcode/reader.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/reader.ts#L30)

Whether decoding was successful.
