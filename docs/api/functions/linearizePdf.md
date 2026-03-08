[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / linearizePdf

# Function: linearizePdf()

> **linearizePdf**(`pdfBytes`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/linearization.ts:661](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L661)

Linearize a PDF document for fast web viewing.

This reorganizes the PDF so that:
1. A linearization parameter dictionary appears first (§F.2)
2. Objects needed for the first page appear early in the file
3. A primary hint stream describes page offsets and shared objects (§F.4)
4. Cross-reference streams are used for all xref data (§7.5.8)

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
