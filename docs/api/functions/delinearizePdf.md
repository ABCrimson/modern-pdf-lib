[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / delinearizePdf

# Function: delinearizePdf()

> **delinearizePdf**(`pdfBytes`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/linearization.ts:955](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L955)

Remove linearization artifacts from a PDF, producing a normal
(non-linearized) PDF.

This:
1. Strips the linearization parameter dictionary
2. Removes hint streams
3. Rebuilds the xref table without linearization ordering constraints
4. Removes any /Linearized key from the output

If the input PDF is not linearized, it is returned unchanged.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

A non-linearized PDF.
