[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getRedactionMarks

# Function: getRedactionMarks()

```ts
function getRedactionMarks(page): readonly RedactionMark[];
```

Defined in: [src/core/redaction.ts:213](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L213)

Get the pending redaction marks for a page.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to query.

## Returns

readonly [`RedactionMark`](../interfaces/RedactionMark.md)[]

An array of redaction marks, or an empty array.
