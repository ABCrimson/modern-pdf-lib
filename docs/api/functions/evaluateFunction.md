[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / evaluateFunction

# Function: evaluateFunction()

```ts
function evaluateFunction(fn, inputs): number[];
```

Defined in: [src/core/pdfFunctions.ts:715](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L715)

Evaluate a PDF function definition at the given input vector.

Inputs are clamped to the function's `Domain` and outputs are clamped to its
`Range` (when defined), per ISO 32000-2 §7.10. Returns a freshly allocated
numeric array of output components.

## Parameters

### fn

[`PdfFunctionDef`](../type-aliases/PdfFunctionDef.md)

the function definition.

### inputs

readonly `number`[]

the `m`-dimensional input vector.

## Returns

`number`[]

the `n`-dimensional output vector.
