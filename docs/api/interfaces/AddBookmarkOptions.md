[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AddBookmarkOptions

# Interface: AddBookmarkOptions

Defined in: src/core/outlines.ts:76

Options for [addBookmark](../functions/addBookmark.md).

## Properties

### bold?

> `optional` **bold**: `boolean`

Defined in: src/core/outlines.ts:86

Whether the title text is bold.

***

### color?

> `optional` **color**: `object`

Defined in: src/core/outlines.ts:90

Colour of the bookmark title (RGB, 0-1 range).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### isOpen?

> `optional` **isOpen**: `boolean`

Defined in: src/core/outlines.ts:95

Whether the bookmark's children are initially expanded.
Default: `true`.

***

### italic?

> `optional` **italic**: `boolean`

Defined in: src/core/outlines.ts:88

Whether the title text is italic.

***

### pageIndex

> **pageIndex**: `number`

Defined in: src/core/outlines.ts:80

Zero-based page index to navigate to.

***

### parent?

> `optional` **parent**: [`BookmarkRef`](BookmarkRef.md)

Defined in: src/core/outlines.ts:82

Parent bookmark for nesting.  Omit for a top-level bookmark.

***

### title

> **title**: `string`

Defined in: src/core/outlines.ts:78

The display title for the bookmark.

***

### y?

> `optional` **y**: `number`

Defined in: src/core/outlines.ts:84

Vertical position on the page (top coordinate for FitH).
