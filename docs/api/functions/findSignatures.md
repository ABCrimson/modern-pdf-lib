[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findSignatures

# Function: findSignatures()

> **findSignatures**(`pdfBytes`): `object`[]

Defined in: [src/signature/byteRange.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/byteRange.ts#L592)

Find all signature fields in a PDF and extract their ByteRange
and Contents information.

## Parameters

### pdfBytes

`Uint8Array`

The PDF bytes to scan.

## Returns

`object`[]

Array of signature info objects.
