[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseExistingTrailer

# Function: parseExistingTrailer()

```ts
function parseExistingTrailer(pdf): TrailerInfo;
```

Defined in: [src/signature/incrementalSave.ts:259](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L259)

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
