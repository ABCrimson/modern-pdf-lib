[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

> **prepareForSigning**(`pdfBytes`, `signatureFieldName`, `placeholderSize?`): `object`

Defined in: [src/signature/byteRange.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/byteRange.ts#L184)

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
