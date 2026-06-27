[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / identityTransferFunction

# Function: identityTransferFunction()

```ts
function identityTransferFunction(): PdfName;
```

Defined in: [src/core/halftone.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/halftone.ts#L184)

Build an `Identity` transfer-function name object (`/Identity`).

The value of a transfer function entry may be the name `Identity`, in
which case no adjustment is applied to component values.

## Returns

[`PdfName`](../classes/PdfName.md)
