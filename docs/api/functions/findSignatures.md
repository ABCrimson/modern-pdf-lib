[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findSignatures

# Function: findSignatures()

> **findSignatures**(`pdfBytes`): `object`[]

Defined in: [src/signature/byteRange.ts:439](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/signature/byteRange.ts#L439)

Find all signature fields in a PDF and extract their ByteRange
and Contents information.

## Parameters

### pdfBytes

`Uint8Array`

The PDF bytes to scan.

## Returns

`object`[]

Array of signature info objects.
