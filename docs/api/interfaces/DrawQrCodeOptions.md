[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawQrCodeOptions

# Interface: DrawQrCodeOptions

Defined in: [src/core/pdfPage.ts:404](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L404)

Options for [PdfPage.drawQrCode](../classes/PdfPage.md#drawqrcode).

## Properties

### backgroundColor?

> `optional` **backgroundColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:418](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L418)

Background colour. Default: white.

***

### color?

> `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/core/pdfPage.ts:416](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L416)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

> `optional` **errorCorrection**: [`ErrorCorrectionLevel`](../type-aliases/ErrorCorrectionLevel.md)

Defined in: [src/core/pdfPage.ts:410](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L410)

Error correction level. Default: `'M'`.

***

### moduleSize?

> `optional` **moduleSize**: `number`

Defined in: [src/core/pdfPage.ts:412](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L412)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

> `optional` **quietZone**: `number`

Defined in: [src/core/pdfPage.ts:414](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L414)

Number of quiet-zone modules around the code. Default: `4`.

***

### x?

> `optional` **x**: `number`

Defined in: [src/core/pdfPage.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L406)

X coordinate (bottom-left of QR code).

***

### y?

> `optional` **y**: `number`

Defined in: [src/core/pdfPage.ts:408](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfPage.ts#L408)

Y coordinate (bottom-left of QR code).
