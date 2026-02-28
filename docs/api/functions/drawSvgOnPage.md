[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawSvgOnPage

# Function: drawSvgOnPage()

> **drawSvgOnPage**(`page`, `svgString`, `options?`): `void`

Defined in: [src/assets/svg/svgToPdf.ts:471](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/assets/svg/svgToPdf.ts#L471)

Draw an SVG string onto a PDF page.

Parses the SVG, converts it to PDF operators, and appends them
to the page's content stream.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

### svgString

`string`

### options?

[`SvgRenderOptions`](../interfaces/SvgRenderOptions.md)

## Returns

`void`
