[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildFunctionShading

# Function: buildFunctionShading()

```ts
function buildFunctionShading(options): PdfDict;
```

Defined in: [src/core/shadingFunction.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/shadingFunction.ts#L136)

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
