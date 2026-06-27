[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getBookmarks

# Function: getBookmarks()

```ts
function getBookmarks(doc): readonly BookmarkNode[];
```

Defined in: [src/core/outlines.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/outlines.ts#L169)

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
