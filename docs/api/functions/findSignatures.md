[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findSignatures

# Function: findSignatures()

> **findSignatures**(`pdfBytes`): `object`[]

Defined in: [src/signature/byteRange.ts:439](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/byteRange.ts#L439)

Find all signature fields in a PDF and extract their ByteRange
and Contents information.

## Parameters

### pdfBytes

`Uint8Array`

The PDF bytes to scan.

## Returns

`object`[]

Array of signature info objects.
