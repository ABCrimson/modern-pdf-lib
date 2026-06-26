[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyRedactions

# Function: applyRedactions()

```ts
function applyRedactions(doc): void;
```

Defined in: [src/core/redaction.ts:125](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L125)

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
