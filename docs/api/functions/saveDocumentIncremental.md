[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveDocumentIncremental

# Function: saveDocumentIncremental()

> **saveDocumentIncremental**(`originalBytes`, `doc`, `options?`): `Promise`\<[`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)\>

Defined in: [src/core/incrementalWriter.ts:465](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L465)

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
