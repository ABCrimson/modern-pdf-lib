[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseExistingTrailer

# Function: parseExistingTrailer()

> **parseExistingTrailer**(`pdf`): [`TrailerInfo`](../interfaces/TrailerInfo.md)

Defined in: [src/signature/incrementalSave.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/incrementalSave.ts#L282)

Parse the existing trailer from a PDF to extract /Size, /Root, /Info,
and the previous xref offset.

Scans backward from the end of the file for `startxref` and the
trailer dictionary.

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

## Returns

[`TrailerInfo`](../interfaces/TrailerInfo.md)

Parsed trailer information.
