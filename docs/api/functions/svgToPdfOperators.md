[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / svgToPdfOperators

# Function: svgToPdfOperators()

> **svgToPdfOperators**(`element`, `options?`): `string`

Defined in: [src/assets/svg/svgToPdf.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/svg/svgToPdf.ts#L333)

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
