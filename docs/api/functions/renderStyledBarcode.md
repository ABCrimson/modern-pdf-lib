[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / renderStyledBarcode

# Function: renderStyledBarcode()

```ts
function renderStyledBarcode(
   matrix, 
   x, 
   y, 
   text, 
   options?): string;
```

Defined in: [src/barcode/style.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L121)

Render a barcode matrix with full styling options.

This combines the barcode modules with background, text,
border, and color options into a single set of PDF operators.
The result is wrapped in `q` / `Q` (save / restore graphics state)
for clean isolation.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

The encoded barcode matrix.

### x

`number`

X coordinate of the barcode origin (lower-left of outer box).

### y

`number`

Y coordinate of the barcode origin (lower-left of outer box).

### text

`string`

Human-readable text to show below the bars (used only
                when `options.showText` is `true`).

### options?

[`StyledBarcodeOptions`](../interfaces/StyledBarcodeOptions.md)

Styling options.

## Returns

`string`

A string of PDF content-stream operators.
