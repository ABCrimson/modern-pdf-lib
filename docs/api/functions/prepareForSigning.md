[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

> **prepareForSigning**(`pdfBytes`, `signatureFieldName`, `placeholderSize?`, `appearance?`, `mdpPermission?`, `fieldLock?`): `object`

Defined in: [src/signature/byteRange.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/byteRange.ts#L269)

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
