[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / QrCodeMatrix

# Interface: QrCodeMatrix

Defined in: [src/barcode/qr.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/qr.ts#L39)

The result of QR code encoding — a boolean matrix.

## Properties

### modules

> `readonly` **modules**: readonly `boolean`[]

Defined in: [src/barcode/qr.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/qr.ts#L43)

Row-major boolean array. `true` = dark module.

***

### size

> `readonly` **size**: `number`

Defined in: [src/barcode/qr.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/qr.ts#L41)

Number of modules per side.

***

### version

> `readonly` **version**: `number`

Defined in: [src/barcode/qr.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/qr.ts#L45)

QR version (1-40).
