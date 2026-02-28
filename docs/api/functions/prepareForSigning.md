[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

> **prepareForSigning**(`pdfBytes`, `signatureFieldName`, `placeholderSize?`): `object`

Defined in: [src/signature/byteRange.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/signature/byteRange.ts#L184)

Prepare a PDF for signing by appending a signature dictionary
via incremental update.

This function:
1. Appends a new signature field and value to the PDF
2. Inserts an empty `/Contents` placeholder of the specified size
3. Computes the `/ByteRange` that excludes the `/Contents` value

The resulting PDF bytes can be hashed (excluding the placeholder gap)
and the hash can be signed.

## Parameters

### pdfBytes

`Uint8Array`

The original PDF file bytes.

### signatureFieldName

`string`

The name for the signature field.

### placeholderSize?

`number` = `8192`

Size in bytes for the signature. Default 8192.

## Returns

`object`

The prepared PDF and ByteRange info.

### byteRange

> **byteRange**: [`ByteRangeResult`](../interfaces/ByteRangeResult.md)

### preparedPdf

> **preparedPdf**: `Uint8Array`
