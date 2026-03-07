[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findSignatures

# Function: findSignatures()

> **findSignatures**(`pdfBytes`): `object`[]

Defined in: [src/signature/byteRange.ts:587](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/signature/byteRange.ts#L587)

Find all signature fields in a PDF and extract their ByteRange
and Contents information.

## Parameters

### pdfBytes

`Uint8Array`

The PDF bytes to scan.

## Returns

`object`[]

Array of signature info objects.
