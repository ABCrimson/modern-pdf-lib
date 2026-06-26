[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BookmarkRef

# Interface: BookmarkRef

Defined in: [src/core/outlines.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L45)

An opaque handle returned by [addBookmark](../functions/addBookmark.md) that identifies
a bookmark in the outline tree.  Used as a `parent` to create
nested bookmarks, or passed to [removeBookmark](../functions/removeBookmark.md) to delete
an entry.
