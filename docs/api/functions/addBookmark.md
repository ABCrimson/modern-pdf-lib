[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addBookmark

# Function: addBookmark()

```ts
function addBookmark(doc, options): BookmarkRef;
```

Defined in: [src/core/outlines.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/outlines.ts#L121)

Add a bookmark entry to the document's outline tree.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to add the bookmark to.

### options

[`AddBookmarkOptions`](../interfaces/AddBookmarkOptions.md)

Bookmark configuration (title, page, nesting, style).

## Returns

[`BookmarkRef`](../interfaces/BookmarkRef.md)

A [BookmarkRef](../interfaces/BookmarkRef.md) identifying the new bookmark.
