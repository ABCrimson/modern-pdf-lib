[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addWatermarkToPage

# Function: addWatermarkToPage()

> **addWatermarkToPage**(`page`, `options`, `registry`): `void`

Defined in: [src/core/watermark.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L66)

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
