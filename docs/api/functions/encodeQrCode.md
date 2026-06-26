[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeQrCode

# Function: encodeQrCode()

> **encodeQrCode**(`data`, `errorCorrection?`): [`QrCodeMatrix`](../interfaces/QrCodeMatrix.md)

Defined in: [src/barcode/qr.ts:1114](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/qr.ts#L1114)

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
