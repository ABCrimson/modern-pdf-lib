[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveIncrementalWithSignaturePreservation

# Function: saveIncrementalWithSignaturePreservation()

```ts
function saveIncrementalWithSignaturePreservation(
   originalPdf, 
   modifiedPdf, 
   options?): Uint8Array;
```

Defined in: [src/signature/incrementalSave.ts:322](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L322)

Perform an incremental save that preserves ALL existing signatures.

Takes the original PDF bytes and a modified version, detects which
objects changed by comparing object hashes, and appends only the
changed/new objects after the original %%EOF. This ensures all
existing signature byte ranges remain intact.

## Parameters

### originalPdf

`Uint8Array`

The original (possibly signed) PDF bytes.

### modifiedPdf

`Uint8Array`

The modified PDF bytes with changes.

### options?

[`IncrementalSaveOptions`](../interfaces/IncrementalSaveOptions.md)

Options for the incremental save.

## Returns

`Uint8Array`

The incrementally saved PDF bytes.
