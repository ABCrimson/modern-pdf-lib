[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / linearizePdf

# Function: linearizePdf()

> **linearizePdf**(`pdfBytes`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/linearization.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/linearization.ts#L214)

Linearize a PDF document for fast web viewing.

This reorganizes the PDF so that:
1. A linearization parameter dictionary appears first
2. Objects needed for the first page appear early in the file
3. A hint table describes page offsets

Note: This is a simplified linearization. For production use with
very large documents, a full implementation following PDF spec
Appendix F is recommended.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### options?

[`LinearizationOptions`](../interfaces/LinearizationOptions.md)

Linearization options.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The linearized PDF bytes.
