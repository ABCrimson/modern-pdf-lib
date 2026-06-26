[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / delinearizePdf

# Function: delinearizePdf()

> **delinearizePdf**(`pdfBytes`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/linearization.ts:1206](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L1206)

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
