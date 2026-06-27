[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / delinearizePdf

# Function: delinearizePdf()

```ts
function delinearizePdf(pdfBytes): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/linearization.ts:1206](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/linearization.ts#L1206)

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

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

A non-linearized PDF.
