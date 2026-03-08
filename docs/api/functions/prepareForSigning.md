[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

> **prepareForSigning**(`pdfBytes`, `signatureFieldName`, `placeholderSize?`, `appearance?`, `mdpPermission?`, `fieldLock?`): `object`

Defined in: [src/signature/byteRange.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/byteRange.ts#L293)

## Parameters

### pdfBytes

`Uint8Array`

### signatureFieldName

`string`

### placeholderSize?

`number` = `8192`

### appearance?

`PrepareAppearanceOptions`

### mdpPermission?

`number`

### fieldLock?

#### action

`"All"` \| `"Include"` \| `"Exclude"`

#### fields?

`string`[]

## Returns

`object`

### byteRange

> **byteRange**: [`ByteRangeResult`](../interfaces/ByteRangeResult.md)

### preparedPdf

> **preparedPdf**: `Uint8Array`
