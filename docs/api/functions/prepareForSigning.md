[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / prepareForSigning

# Function: prepareForSigning()

```ts
function prepareForSigning(
   pdfBytes, 
   signatureFieldName, 
   placeholderSize?, 
   appearance?, 
   mdpPermission?, 
   fieldLock?): object;
```

Defined in: [src/signature/byteRange.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/byteRange.ts#L269)

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

```ts
byteRange: ByteRangeResult;
```

### preparedPdf

```ts
preparedPdf: Uint8Array;
```
