[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawSvgOnPage

# Function: drawSvgOnPage()

> **drawSvgOnPage**(`page`, `svgString`, `options?`): `void`

Defined in: [src/assets/svg/svgToPdf.ts:471](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/assets/svg/svgToPdf.ts#L471)

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
