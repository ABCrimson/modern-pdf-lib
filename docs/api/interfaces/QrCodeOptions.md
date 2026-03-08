[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / QrCodeOptions

# Interface: QrCodeOptions

Defined in: [src/barcode/qr.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L25)

Options for rendering a QR code to PDF operators.

## Properties

### backgroundColor?

> `readonly` `optional` **backgroundColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/qr.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L35)

Background colour. Default: white.

***

### color?

> `readonly` `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/qr.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L33)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

> `readonly` `optional` **errorCorrection**: [`ErrorCorrectionLevel`](../type-aliases/ErrorCorrectionLevel.md)

Defined in: [src/barcode/qr.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L27)

Error correction level. Default: `'M'`.

***

### moduleSize?

> `readonly` `optional` **moduleSize**: `number`

Defined in: [src/barcode/qr.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L29)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

> `readonly` `optional` **quietZone**: `number`

Defined in: [src/barcode/qr.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/qr.ts#L31)

Number of quiet-zone modules around the code. Default: `4`.
