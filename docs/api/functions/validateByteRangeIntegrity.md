[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateByteRangeIntegrity

# Function: validateByteRangeIntegrity()

```ts
function validateByteRangeIntegrity(pdf, signatures): boolean;
```

Defined in: [src/signature/incrementalSave.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L199)

Verify that no existing signature's covered bytes would overlap
with content appended after the current end of file.

For a valid incremental update, all existing signature byte ranges
must reference bytes within the original file. Any overlap with
new content appended after the last %%EOF would break signatures.

## Parameters

### pdf

`Uint8Array`

The current PDF bytes.

### signatures

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

The signature byte ranges to validate.

## Returns

`boolean`

`true` if all byte ranges are valid and non-overlapping with appended content.
