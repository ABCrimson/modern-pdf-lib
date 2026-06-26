[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / svgToPdfOperators

# Function: svgToPdfOperators()

> **svgToPdfOperators**(`element`, `options?`): `string`

Defined in: [src/assets/svg/svgToPdf.ts:412](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgToPdf.ts#L412)

Convert an SVG element tree into PDF content stream operators.

The returned string can be injected directly into a PDF page's
content stream.

## Parameters

### element

[`SvgElement`](../interfaces/SvgElement.md)

### options?

[`SvgRenderOptions`](../interfaces/SvgRenderOptions.md)

## Returns

`string`
