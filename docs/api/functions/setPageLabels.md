[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setPageLabels

# Function: setPageLabels()

> **setPageLabels**(`doc`, `labels`): `void`

Defined in: src/core/pageLabels.ts:135

Set the page label ranges for the document.

Each entry in the `labels` array defines a contiguous range of pages
that share a numbering style.  Ranges must be sorted by `startPage`
in ascending order.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to set page labels on.

### labels

readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[]

An array of label range definitions.

## Returns

`void`

## Throws

If `labels` is empty or ranges are not sorted.
