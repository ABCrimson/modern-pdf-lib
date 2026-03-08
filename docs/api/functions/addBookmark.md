[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addBookmark

# Function: addBookmark()

> **addBookmark**(`doc`, `options`): [`BookmarkRef`](../interfaces/BookmarkRef.md)

Defined in: src/core/outlines.ts:109

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
