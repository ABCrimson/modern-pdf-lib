[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / svgToPdfOperators

# Function: svgToPdfOperators()

> **svgToPdfOperators**(`element`, `options?`): `string`

Defined in: [src/assets/svg/svgToPdf.ts:412](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgToPdf.ts#L412)

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
