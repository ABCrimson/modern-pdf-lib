[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Pdf417Options

# Interface: Pdf417Options

Defined in: [src/barcode/pdf417.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L31)

Options for encoding a PDF417 barcode.

## Properties

### color?

> `readonly` `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/pdf417.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L41)

Bar colour. Default: black.

***

### columns?

> `readonly` `optional` **columns**: `number`

Defined in: [src/barcode/pdf417.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L33)

Number of data columns (1-30). Default: auto-calculated.

***

### errorLevel?

> `readonly` `optional` **errorLevel**: `number`

Defined in: [src/barcode/pdf417.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L35)

Error correction level (0-8). Default: `2`.

***

### moduleWidth?

> `readonly` `optional` **moduleWidth**: `number`

Defined in: [src/barcode/pdf417.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L39)

Width of a single module in PDF points. Default: `1`.

***

### quietZone?

> `readonly` `optional` **quietZone**: `number`

Defined in: [src/barcode/pdf417.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L43)

Quiet zone width in modules. Default: `2`.

***

### rowHeight?

> `readonly` `optional` **rowHeight**: `number`

Defined in: [src/barcode/pdf417.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/pdf417.ts#L37)

Row height in PDF points. Default: `8`.
