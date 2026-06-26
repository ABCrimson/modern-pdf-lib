[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getBookmarks

# Function: getBookmarks()

```ts
function getBookmarks(doc): readonly BookmarkNode[];
```

Defined in: [src/core/outlines.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L169)

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
