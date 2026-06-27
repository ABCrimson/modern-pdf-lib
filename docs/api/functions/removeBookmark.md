[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removeBookmark

# Function: removeBookmark()

```ts
function removeBookmark(doc, ref): void;
```

Defined in: [src/core/outlines.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/outlines.ts#L183)

Remove a specific bookmark from the document.

If the bookmark has children, they are also removed.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to modify.

### ref

[`BookmarkRef`](../interfaces/BookmarkRef.md)

The handle of the bookmark to remove.

## Returns

`void`

## Throws

If the bookmark is not found in the tree.
