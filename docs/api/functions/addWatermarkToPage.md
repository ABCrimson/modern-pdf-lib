[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addWatermarkToPage

# Function: addWatermarkToPage()

> **addWatermarkToPage**(`page`, `options`, `registry`): `void`

Defined in: [src/core/watermark.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/watermark.ts#L66)

Add a watermark to a single page.

The watermark is drawn using the Helvetica standard font (no
embedding required).  The text is rendered with the specified
rotation, opacity, and colour.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to watermark.

### options

[`WatermarkOptions`](../interfaces/WatermarkOptions.md)

Watermark options.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry (for ExtGState).

## Returns

`void`
