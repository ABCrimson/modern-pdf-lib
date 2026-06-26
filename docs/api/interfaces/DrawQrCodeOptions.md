[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawQrCodeOptions

# Interface: DrawQrCodeOptions

Defined in: [src/core/pdfPage.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L396)

Options for [PdfPage.drawQrCode](../classes/PdfPage.md#drawqrcode).

## Properties

### backgroundColor?

> `optional` **backgroundColor?**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:410](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L410)

Background colour. Default: white.

***

### color?

> `optional` **color?**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:408](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L408)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

> `optional` **errorCorrection?**: [`ErrorCorrectionLevel`](../type-aliases/ErrorCorrectionLevel.md)

Defined in: [src/core/pdfPage.ts:402](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L402)

Error correction level. Default: `'M'`.

***

### moduleSize?

> `optional` **moduleSize?**: `number`

Defined in: [src/core/pdfPage.ts:404](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L404)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

> `optional` **quietZone?**: `number`

Defined in: [src/core/pdfPage.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L406)

Number of quiet-zone modules around the code. Default: `4`.

***

### x?

> `optional` **x?**: `number`

Defined in: [src/core/pdfPage.ts:398](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L398)

X coordinate (bottom-left of QR code).

***

### y?

> `optional` **y?**: `number`

Defined in: [src/core/pdfPage.ts:400](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L400)

Y coordinate (bottom-left of QR code).
