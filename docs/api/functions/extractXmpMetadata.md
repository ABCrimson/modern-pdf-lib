[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractXmpMetadata

# Function: extractXmpMetadata()

> **extractXmpMetadata**(`pdfBytes`): `string` \| `undefined`

Defined in: [src/compliance/xmpValidator.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/compliance/xmpValidator.ts#L64)

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
