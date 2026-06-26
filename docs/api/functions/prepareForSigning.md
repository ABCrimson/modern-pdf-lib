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

Defined in: [src/signature/byteRange.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L269)

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
