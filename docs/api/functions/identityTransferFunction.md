[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / identityTransferFunction

# Function: identityTransferFunction()

```ts
function identityTransferFunction(): PdfName;
```

Defined in: [src/core/halftone.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L184)

Build an `Identity` transfer-function name object (`/Identity`).

The value of a transfer function entry may be the name `Identity`, in
which case no adjustment is applied to component values.

## Returns

[`PdfName`](../classes/PdfName.md)
