[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generatePdfAXmpBytes

# Function: generatePdfAXmpBytes()

```ts
function generatePdfAXmpBytes(options): Uint8Array;
```

Defined in: [src/compliance/xmpGenerator.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/xmpGenerator.ts#L167)

Generate XMP metadata bytes for embedding in a PDF stream.

This is a convenience wrapper around [generatePdfAXmp](generatePdfAXmp.md) that
encodes the resulting string as UTF-8 bytes suitable for use in a
PDF metadata stream object.

## Parameters

### options

[`PdfAXmpOptions`](../interfaces/PdfAXmpOptions.md)

Metadata options.

## Returns

`Uint8Array`

XMP metadata as a `Uint8Array`.
