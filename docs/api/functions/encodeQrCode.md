[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeQrCode

# Function: encodeQrCode()

```ts
function encodeQrCode(data, errorCorrection?): QrCodeMatrix;
```

Defined in: [src/barcode/qr.ts:1114](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L1114)

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
