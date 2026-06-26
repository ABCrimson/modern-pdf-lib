[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveDocumentIncremental

# Function: saveDocumentIncremental()

```ts
function saveDocumentIncremental(
   originalBytes, 
   doc, 
options?): Promise<IncrementalSaveResult>;
```

Defined in: [src/core/incrementalWriter.ts:465](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/incrementalWriter.ts#L465)

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

`Promise`\&lt;[`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)\&gt;

The incremental save result.
