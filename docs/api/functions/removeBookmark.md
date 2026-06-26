[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removeBookmark

# Function: removeBookmark()

```ts
function removeBookmark(doc, ref): void;
```

Defined in: [src/core/outlines.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L183)

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
