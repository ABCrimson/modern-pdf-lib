[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageLabels

# Function: getPageLabels()

> **getPageLabels**(`doc`): readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[] \| `undefined`

Defined in: [src/core/pageLabels.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pageLabels.ts#L167)

Get the current page label ranges for the document.

Returns `undefined` if no page labels have been set.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to read page labels from.

## Returns

readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[] \| `undefined`

The page label ranges, or `undefined`.
