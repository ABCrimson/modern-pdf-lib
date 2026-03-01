[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / svgToPdfOperators

# Function: svgToPdfOperators()

> **svgToPdfOperators**(`element`, `options?`): `string`

Defined in: [src/assets/svg/svgToPdf.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/svg/svgToPdf.ts#L333)

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
