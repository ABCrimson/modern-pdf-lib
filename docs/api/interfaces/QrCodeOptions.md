[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / QrCodeOptions

# Interface: QrCodeOptions

Defined in: [src/barcode/qr.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L25)

Options for rendering a QR code to PDF operators.

## Properties

### backgroundColor?

```ts
readonly optional backgroundColor?: Color;
```

Defined in: [src/barcode/qr.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L35)

Background colour. Default: white.

***

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/qr.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L33)

Foreground (dark module) colour. Default: black.

***

### errorCorrection?

```ts
readonly optional errorCorrection?: ErrorCorrectionLevel;
```

Defined in: [src/barcode/qr.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L27)

Error correction level. Default: `'M'`.

***

### moduleSize?

```ts
readonly optional moduleSize?: number;
```

Defined in: [src/barcode/qr.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L29)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/qr.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/qr.ts#L31)

Number of quiet-zone modules around the code. Default: `4`.
