[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / svgToPdfOperators

# Function: svgToPdfOperators()

> **svgToPdfOperators**(`element`, `options?`): `string`

Defined in: [src/assets/svg/svgToPdf.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/assets/svg/svgToPdf.ts#L333)

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
