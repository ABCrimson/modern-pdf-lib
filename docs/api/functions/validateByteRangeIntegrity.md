[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateByteRangeIntegrity

# Function: validateByteRangeIntegrity()

> **validateByteRangeIntegrity**(`pdf`, `signatures`): `boolean`

Defined in: [src/signature/incrementalSave.ts:222](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/incrementalSave.ts#L222)

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
