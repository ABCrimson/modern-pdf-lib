[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BookmarkNode

# Interface: BookmarkNode

Defined in: src/core/outlines.ts:54

Represents a single node in the bookmark tree, as returned by
[getBookmarks](../functions/getBookmarks.md).

## Properties

### bold?

> `readonly` `optional` **bold**: `boolean`

Defined in: src/core/outlines.ts:62

Whether the title is bold.

***

### children

> `readonly` **children**: readonly `BookmarkNode`[]

Defined in: src/core/outlines.ts:68

Child bookmarks.

***

### color?

> `readonly` `optional` **color**: `object`

Defined in: src/core/outlines.ts:66

Colour of the bookmark title (RGB, 0-1 range).

#### b

> `readonly` **b**: `number`

#### g

> `readonly` **g**: `number`

#### r

> `readonly` **r**: `number`

***

### italic?

> `readonly` `optional` **italic**: `boolean`

Defined in: src/core/outlines.ts:64

Whether the title is italic.

***

### pageIndex

> `readonly` **pageIndex**: `number`

Defined in: src/core/outlines.ts:58

Zero-based page index this bookmark points to.

***

### ref

> `readonly` **ref**: [`BookmarkRef`](BookmarkRef.md)

Defined in: src/core/outlines.ts:70

The handle for this bookmark node.

***

### title

> `readonly` **title**: `string`

Defined in: src/core/outlines.ts:56

The displayed bookmark title.

***

### y?

> `readonly` `optional` **y**: `number`

Defined in: src/core/outlines.ts:60

Vertical position on the target page (if set).
