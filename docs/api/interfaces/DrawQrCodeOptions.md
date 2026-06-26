[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawQrCodeOptions

# Interface: DrawQrCodeOptions

Defined in: [src/core/pdfPage.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L396)

Options for [PdfPage.drawQrCode](../classes/PdfPage.md#drawqrcode).

## Properties

### backgroundColor?

```ts
optional backgroundColor?: Color;
```

Defined in: [src/core/pdfPage.ts:410](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L410)

Background colour. Default: white.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:408](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L408)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

```ts
optional errorCorrection?: ErrorCorrectionLevel;
```

Defined in: [src/core/pdfPage.ts:402](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L402)

Error correction level. Default: `'M'`.

***

### moduleSize?

```ts
optional moduleSize?: number;
```

Defined in: [src/core/pdfPage.ts:404](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L404)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

```ts
optional quietZone?: number;
```

Defined in: [src/core/pdfPage.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L406)

Number of quiet-zone modules around the code. Default: `4`.

***

### x?

```ts
optional x?: number;
```

Defined in: [src/core/pdfPage.ts:398](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L398)

X coordinate (bottom-left of QR code).

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/pdfPage.ts:400](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L400)

Y coordinate (bottom-left of QR code).
