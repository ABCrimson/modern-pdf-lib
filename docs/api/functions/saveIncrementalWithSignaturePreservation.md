[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveIncrementalWithSignaturePreservation

# Function: saveIncrementalWithSignaturePreservation()

> **saveIncrementalWithSignaturePreservation**(`originalPdf`, `modifiedPdf`, `options?`): `Uint8Array`

Defined in: [src/signature/incrementalSave.ts:345](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/incrementalSave.ts#L345)

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
