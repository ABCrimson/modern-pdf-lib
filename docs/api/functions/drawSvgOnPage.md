[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawSvgOnPage

# Function: drawSvgOnPage()

```ts
function drawSvgOnPage(
   page, 
   svgString, 
   options?): void;
```

Defined in: [src/assets/svg/svgToPdf.ts:726](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/svg/svgToPdf.ts#L726)

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
