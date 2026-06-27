[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findExistingSignatures

# Function: findExistingSignatures()

```ts
function findExistingSignatures(pdf): SignatureByteRange[];
```

Defined in: [src/signature/incrementalSave.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L142)

Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Array of signature byte range descriptors.
