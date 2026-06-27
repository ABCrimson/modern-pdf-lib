[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawQrCodeOptions

# Interface: DrawQrCodeOptions

Defined in: [src/core/pdfPage.ts:397](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L397)

Options for [PdfPage.drawQrCode](../classes/PdfPage.md#drawqrcode).

## Properties

### backgroundColor?

```ts
optional backgroundColor?: Color;
```

Defined in: [src/core/pdfPage.ts:411](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L411)

Background colour. Default: white.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:409](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L409)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

```ts
optional errorCorrection?: ErrorCorrectionLevel;
```

Defined in: [src/core/pdfPage.ts:403](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L403)

Error correction level. Default: `'M'`.

***

### moduleSize?

```ts
optional moduleSize?: number;
```

Defined in: [src/core/pdfPage.ts:405](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L405)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

```ts
optional quietZone?: number;
```

Defined in: [src/core/pdfPage.ts:407](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L407)

Number of quiet-zone modules around the code. Default: `4`.

***

### x?

```ts
optional x?: number;
```

Defined in: [src/core/pdfPage.ts:399](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L399)

X coordinate (bottom-left of QR code).

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/pdfPage.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L401)

Y coordinate (bottom-left of QR code).
