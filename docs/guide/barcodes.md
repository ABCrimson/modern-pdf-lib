---
title: Barcodes & QR Codes
---

# Barcodes & QR Codes

modern-pdf-lib includes built-in barcode generation for 7 formats -- all rendered as native PDF vector graphics for crisp output at any zoom level. No external dependencies or image generation required.

## Supported Formats

| Format | Type | Data | Use Case |
|---|---|---|---|
| QR Code | 2D matrix | Up to 4296 chars | URLs, tickets, payments |
| Code 128 | 1D linear | ASCII 0-127 | Shipping, logistics |
| EAN-13 | 1D linear | 13 digits | Retail products (worldwide) |
| EAN-8 | 1D linear | 8 digits | Small retail products |
| UPC-A | 1D linear | 12 digits | Retail products (North America) |
| Code 39 | 1D linear | A-Z, 0-9, special | Industrial, government |
| ITF | 1D linear | Digits (even count) | Shipping cartons (ITF-14) |

## Quick Start -- QR Code

The easiest way to add a QR code is with the `drawQrCode()` method on `PdfPage`:

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

// Draw a QR code directly on the page
page.drawQrCode('https://example.com', {
  x: 50,
  y: 700,
  moduleSize: 3,
  errorCorrection: 'M',
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
```

## 1D Barcodes

All 1D barcodes follow the same two-step pattern:

1. **Encode** the data into a `BarcodeMatrix` (a boolean array of bar/space modules)
2. **Render** the matrix into PDF content-stream operators with a `*ToOperators()` function

The resulting operator string is appended directly to a page's content stream.

### Code 128

Best for general-purpose barcode needs. Automatically switches between Code A, B, and C character sets for optimal density. Supports the full ASCII range (0-127).

```ts
import { createPdf, encodeCode128, code128ToOperators } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage();

const matrix = encodeCode128('SHIP-2026-0042');
const operators = code128ToOperators(matrix, 50, 600, {
  height: 60,
  moduleWidth: 1.5,
  quietZone: 10,
});

// Append operators to page content stream
page.pushOperators(operators);
```

For advanced use, you can also access the intermediate symbol values:

```ts
import { encodeCode128Values, valuesToModules } from 'modern-pdf-lib';

const values = encodeCode128Values('Hello');   // symbol value array
const matrix = valuesToModules(values);        // BarcodeMatrix
```

### EAN-13 / EAN-8

Standard retail barcodes used worldwide. EAN-13 encodes 13 digits (12 data + 1 check); EAN-8 encodes 8 digits (7 data + 1 check).

```ts
import {
  encodeEan13,
  ean13ToOperators,
  encodeEan8,
  ean8ToOperators,
  calculateEanCheckDigit,
} from 'modern-pdf-lib';

// EAN-13: provide 12 digits, check digit is auto-calculated
const matrix13 = encodeEan13('590123412345');
const ops13 = ean13ToOperators(matrix13, 50, 500, {
  height: 70,
  moduleWidth: 1,
});

// Or validate an existing barcode by providing all 13 digits
const matrix13full = encodeEan13('5901234123457');

// EAN-8: provide 7 digits, check digit is auto-calculated
const matrix8 = encodeEan8('9638507');
const ops8 = ean8ToOperators(matrix8, 50, 400, {
  height: 55,
  moduleWidth: 1,
});

// Calculate check digit manually
const check = calculateEanCheckDigit('590123412345'); // => 7
```

### UPC-A

North American retail barcode. UPC-A is a subset of EAN-13 where the first digit is always `0`. Encodes 12 digits (11 data + 1 check).

```ts
import {
  encodeUpcA,
  upcAToOperators,
  calculateUpcCheckDigit,
} from 'modern-pdf-lib';

// Provide 11 digits, check digit is auto-calculated
const matrix = encodeUpcA('03600029145');
const operators = upcAToOperators(matrix, 50, 400, { height: 70 });

// Or validate with all 12 digits
const matrixFull = encodeUpcA('036000291452');

// Calculate check digit manually (requires 11 digits)
const check = calculateUpcCheckDigit('03600029145'); // => 2
```

### Code 39

Industrial barcode supporting uppercase letters, digits, and special characters (`-`, `.`, space, `$`, `/`, `+`, `%`). Each character is encoded as 9 elements (5 bars, 4 spaces), of which 3 are wide.

```ts
import {
  encodeCode39,
  code39ToOperators,
  computeCode39CheckDigit,
} from 'modern-pdf-lib';

// Basic encoding (start/stop * characters are added automatically)
const matrix = encodeCode39('PART-A1234');
const operators = code39ToOperators(matrix, 50, 300, {
  height: 50,
});

// With modulo-43 check digit
const matrixChecked = encodeCode39('PART-A1234', true);

// Custom wide-to-narrow ratio (default is 3, minimum is 2)
const matrixCustom = encodeCode39('HELLO', false, 2.5);

// Calculate check digit separately
const checkChar = computeCode39CheckDigit('PART-A1234');
```

The `code39ToOperators` function accepts a `Code39Options` object with a `wideToNarrowRatio` property for controlling bar widths:

```ts
const operators = code39ToOperators(matrix, 50, 300, {
  height: 50,
  moduleWidth: 1,
  quietZone: 10,
  wideToNarrowRatio: 3,
});
```

### ITF (Interleaved 2 of 5)

Used on shipping cartons (ITF-14). Encodes digit pairs -- the first digit of each pair controls bar widths, the second controls space widths. If the input has an odd number of digits, a leading `0` is automatically prepended.

```ts
import { encodeItf, itfToOperators } from 'modern-pdf-lib';

const matrix = encodeItf('00361234567890');
const operators = itfToOperators(matrix, 50, 200, {
  height: 50,
  bearerBars: true,
  bearerBarWidth: 2,
});
```

The `encodeItf` function accepts an optional `wideToNarrowRatio` parameter (default: `3`, minimum: `2`):

```ts
const matrix = encodeItf('1234567890', 2.5);
```

Bearer bars (horizontal bars above and below the barcode) help prevent partial reads and are recommended for ITF-14 shipping barcodes.

## 2D Barcodes

### QR Code (ISO 18004)

The most versatile 2D barcode. Supports URLs, text, vCards, WiFi configs, and more. The encoder supports versions 1-40 and auto-detects the best encoding mode (Numeric, Alphanumeric, or Byte).

#### High-level API

Use `page.drawQrCode()` for the simplest integration:

```ts
page.drawQrCode('https://example.com', {
  x: 50,
  y: 500,
  moduleSize: 4,
  quietZone: 4,
  errorCorrection: 'H',
  color: rgb(0, 0, 0),
  backgroundColor: rgb(1, 1, 1),
});
```

#### Low-level API

For more control, use the encode/render functions directly:

```ts
import { encodeQrCode, qrCodeToOperators } from 'modern-pdf-lib';

const matrix = encodeQrCode('Hello, World!', 'H'); // High error correction
const operators = qrCodeToOperators(matrix, 50, 500, {
  moduleSize: 4,
  quietZone: 4,
  color: { type: 'grayscale', gray: 0 },
  backgroundColor: { type: 'grayscale', gray: 1 },
});

// Inspect the matrix
console.log(`QR Version: ${matrix.version}`);       // e.g. 2
console.log(`Size: ${matrix.size}x${matrix.size}`);  // e.g. 25x25
```

#### Error Correction Levels

| Level | Recovery | Best For |
|---|---|---|
| `'L'` (Low) | ~7% | Clean environments, maximum data capacity |
| `'M'` (Medium) | ~15% | General purpose (default) |
| `'Q'` (Quartile) | ~25% | Industrial environments |
| `'H'` (High) | ~30% | Harsh environments, logos overlaid on code |

Higher error correction allows more damage to the QR code while remaining scannable, but reduces the maximum data capacity for a given version.

## Common Styling Options

All 1D barcode renderers accept these options through their respective option types (`Code128Options`, `Code39Options`, `ItfOptions`, `BarcodeOptions`/`EanOptions`/`UpcOptions`):

| Option | Type | Default | Description |
|---|---|---|---|
| `height` | `number` | `50` | Bar height in PDF points |
| `moduleWidth` | `number` | `1` | Width of a single narrow bar/module |
| `quietZone` | `number` | `10` | Quiet zone width in modules (each side) |
| `color` | `Color` | black | Bar colour |
| `showText` | `boolean` | `false` | Human-readable text below the barcode |
| `fontSize` | `number` | `10` | Font size for human-readable text |

Code 39 and ITF additionally support `wideToNarrowRatio` (default `3`). ITF also supports `bearerBars` and `bearerBarWidth`.

QR codes use `QrCodeOptions` with `moduleSize` (default `2`), `quietZone` (default `4`), `color`, and `backgroundColor`.

## Best Practices

1. **Always include quiet zones** -- Most barcode scanners need whitespace around the barcode to detect the start and end of the symbol. The default quiet zones in modern-pdf-lib follow the minimum specifications for each format.

2. **Use appropriate module sizes** -- Too small and scanners cannot read it; too large wastes space. For 1D barcodes, a `moduleWidth` of `1` to `2` points works well at standard print resolutions. For QR codes, a `moduleSize` of `2` to `4` points is recommended.

3. **Choose the right format** for your use case:
   - **Retail products**: EAN-13 (worldwide) or UPC-A (North America)
   - **Small products**: EAN-8
   - **Shipping/logistics**: Code 128 or ITF-14
   - **Industrial/government**: Code 39
   - **URLs, digital content**: QR Code

4. **Use error correction** for QR codes that will be printed in environments where the code may be damaged or partially obscured. Level Q or H provides good resilience at the cost of increased symbol size.

5. **Use Code 128 as the default 1D format** -- it has the best density, supports the full ASCII character set, and automatically optimises encoding with code-set switching.

6. **Verify barcodes** after generation by scanning test prints with a barcode reader before deploying to production.

7. **Bearer bars for ITF** -- Always enable bearer bars on ITF-14 shipping barcodes to prevent partial reads caused by scanner misalignment.
