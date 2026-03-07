[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

> **prepareForSigning**(`pdfBytes`, `signatureFieldName`, `placeholderSize?`, `appearance?`): `object`

Defined in: [src/signature/byteRange.ts:288](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/signature/byteRange.ts#L288)

## Parameters

### pdfBytes

`Uint8Array`

### signatureFieldName

`string`

### placeholderSize?

`number` = `8192`

### appearance?

`PrepareAppearanceOptions`

## Returns

`object`

### byteRange

> **byteRange**: [`ByteRangeResult`](../interfaces/ByteRangeResult.md)

### preparedPdf

> **preparedPdf**: `Uint8Array`
