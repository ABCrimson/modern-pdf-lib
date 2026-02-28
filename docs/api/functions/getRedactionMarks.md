[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getRedactionMarks

# Function: getRedactionMarks()

> **getRedactionMarks**(`page`): readonly [`RedactionMark`](../interfaces/RedactionMark.md)[]

Defined in: [src/core/redaction.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/redaction.ts#L158)

Get the pending redaction marks for a page.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to query.

## Returns

readonly [`RedactionMark`](../interfaces/RedactionMark.md)[]

An array of redaction marks, or an empty array.
