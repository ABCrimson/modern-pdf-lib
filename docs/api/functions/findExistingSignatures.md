[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findExistingSignatures

# Function: findExistingSignatures()

```ts
function findExistingSignatures(pdf): SignatureByteRange[];
```

Defined in: [src/signature/incrementalSave.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L142)

Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Array of signature byte range descriptors.
