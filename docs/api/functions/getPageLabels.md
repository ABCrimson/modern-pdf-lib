[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageLabels

# Function: getPageLabels()

> **getPageLabels**(`doc`): readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[] \| `undefined`

Defined in: src/core/pageLabels.ts:166

Get the current page label ranges for the document.

Returns `undefined` if no page labels have been set.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to read page labels from.

## Returns

readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[] \| `undefined`

The page label ranges, or `undefined`.
