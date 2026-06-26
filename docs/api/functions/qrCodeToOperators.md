[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / qrCodeToOperators

# Function: qrCodeToOperators()

```ts
function qrCodeToOperators(
   matrix, 
   x, 
   y, 
   options?): string;
```

Defined in: [src/barcode/qr.ts:1187](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L1187)

Convert a [QrCodeMatrix](../interfaces/QrCodeMatrix.md) to PDF content-stream operators.

The QR code is rendered as filled rectangles (one per dark module),
positioned at `(x, y)` in PDF user-space coordinates. The `y`
coordinate refers to the **bottom-left** corner of the QR code.

## Parameters

### matrix

[`QrCodeMatrix`](../interfaces/QrCodeMatrix.md)

The QR code matrix from [encodeQrCode](encodeQrCode.md).

### x

`number`

X position in PDF points.

### y

`number`

Y position in PDF points.

### options?

[`QrCodeOptions`](../interfaces/QrCodeOptions.md) = `{}`

Rendering options (module size, quiet zone, colours).

## Returns

`string`

A string of PDF content-stream operators.
