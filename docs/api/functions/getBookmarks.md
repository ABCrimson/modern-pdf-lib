[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getBookmarks

# Function: getBookmarks()

> **getBookmarks**(`doc`): readonly [`BookmarkNode`](../interfaces/BookmarkNode.md)[]

Defined in: src/core/outlines.ts:150

Return the bookmark tree for the document.

Returns an array of top-level [BookmarkNode](../interfaces/BookmarkNode.md) objects, each
with a `children` array for nested bookmarks.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to read bookmarks from.

## Returns

readonly [`BookmarkNode`](../interfaces/BookmarkNode.md)[]

The bookmark tree.
