[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractXmpMetadata

# Function: extractXmpMetadata()

> **extractXmpMetadata**(`pdfBytes`): `string` \| `undefined`

Defined in: [src/compliance/xmpValidator.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/xmpValidator.ts#L64)

Extract XMP metadata from raw PDF bytes.

Searches for the `<x:xmpmeta ... </x:xmpmeta>` envelope in the
decoded text of the PDF and returns the full XMP XML string, or
`undefined` if no XMP metadata is present.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

`string` \| `undefined`

The XMP XML string, or `undefined`.
