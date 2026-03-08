[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeQrCode

# Function: encodeQrCode()

> **encodeQrCode**(`data`, `errorCorrection?`): [`QrCodeMatrix`](../interfaces/QrCodeMatrix.md)

Defined in: [src/barcode/qr.ts:1114](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/qr.ts#L1114)

Encode a string as a QR code matrix.

## Parameters

### data

`string`

The string to encode.

### errorCorrection?

[`ErrorCorrectionLevel`](../type-aliases/ErrorCorrectionLevel.md) = `'M'`

Error correction level (default: `'M'`).

## Returns

[`QrCodeMatrix`](../interfaces/QrCodeMatrix.md)

A [QrCodeMatrix](../interfaces/QrCodeMatrix.md) with the encoded data.
