[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getRedactionMarks

# Function: getRedactionMarks()

> **getRedactionMarks**(`page`): readonly [`RedactionMark`](../interfaces/RedactionMark.md)[]

Defined in: [src/core/redaction.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/redaction.ts#L158)

Get the pending redaction marks for a page.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to query.

## Returns

readonly [`RedactionMark`](../interfaces/RedactionMark.md)[]

An array of redaction marks, or an empty array.
