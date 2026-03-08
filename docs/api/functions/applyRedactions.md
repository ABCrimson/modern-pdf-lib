[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyRedactions

# Function: applyRedactions()

> **applyRedactions**(`doc`): `void`

Defined in: [src/core/redaction.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/redaction.ts#L97)

Apply all pending redactions across all pages in a document.

For each redaction mark, this draws an opaque filled rectangle
over the marked region.  If overlay text is specified, it is
drawn on top of the rectangle in a contrasting colour.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document.

## Returns

`void`
