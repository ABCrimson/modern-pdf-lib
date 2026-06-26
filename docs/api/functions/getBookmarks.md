[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getBookmarks

# Function: getBookmarks()

> **getBookmarks**(`doc`): readonly [`BookmarkNode`](../interfaces/BookmarkNode.md)[]

Defined in: [src/core/outlines.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L169)

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
