[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveDocumentIncremental

# Function: saveDocumentIncremental()

> **saveDocumentIncremental**(`originalBytes`, `doc`, `options?`): `Promise`\<[`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)\>

Defined in: [src/core/incrementalWriter.ts:469](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/incrementalWriter.ts#L469)

Perform an incremental save given the original bytes and a PdfDocument.

This is a convenience wrapper that builds the document structure,
determines which objects have changed, and calls `saveIncremental`.

## Parameters

### originalBytes

`Uint8Array`

The original PDF file bytes.

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The modified PdfDocument.

### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Optional save options.

## Returns

`Promise`\<[`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)\>

The incremental save result.
