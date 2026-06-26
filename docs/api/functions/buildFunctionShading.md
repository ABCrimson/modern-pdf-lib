[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildFunctionShading

# Function: buildFunctionShading()

> **buildFunctionShading**(`options`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/shadingFunction.ts:136

Build a function-based (type 1) `/Shading` dictionary.

The returned dict carries `/ShadingType 1`, the (defaulted) `/Domain`,
`/Matrix` and `/ColorSpace`, and an inline `/Function` dictionary built from
`options.fn`.

## Parameters

### options

[`FunctionShadingOptions`](../interfaces/FunctionShadingOptions.md)

the shading definition.

## Returns

[`PdfDict`](../classes/PdfDict.md)

a `PdfDict` ready to be referenced from a pattern or resource dict.
