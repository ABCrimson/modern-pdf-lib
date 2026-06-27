[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseExistingTrailer

# Function: parseExistingTrailer()

```ts
function parseExistingTrailer(pdf): TrailerInfo;
```

Defined in: [src/signature/incrementalSave.ts:259](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L259)

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
