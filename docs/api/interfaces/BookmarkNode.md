[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BookmarkNode

# Interface: BookmarkNode

Defined in: [src/core/outlines.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L54)

Represents a single node in the bookmark tree, as returned by
[getBookmarks](../functions/getBookmarks.md).

## Properties

### bold?

> `readonly` `optional` **bold?**: `boolean`

Defined in: [src/core/outlines.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L68)

Whether the title is bold.

***

### children

> `readonly` **children**: readonly `BookmarkNode`[]

Defined in: [src/core/outlines.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L74)

Child bookmarks.

***

### color?

> `readonly` `optional` **color?**: `object`

Defined in: [src/core/outlines.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L72)

Colour of the bookmark title (RGB, 0-1 range).

#### b

> `readonly` **b**: `number`

#### g

> `readonly` **g**: `number`

#### r

> `readonly` **r**: `number`

***

### fit?

> `readonly` `optional` **fit?**: `"Fit"` \| `"FitH"` \| `"FitV"` \| `"FitB"` \| `"FitBH"` \| `"FitBV"` \| `"XYZ"`

Defined in: [src/core/outlines.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L62)

Page fit mode used by this bookmark's destination.

***

### italic?

> `readonly` `optional` **italic?**: `boolean`

Defined in: [src/core/outlines.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L70)

Whether the title is italic.

***

### left?

> `readonly` `optional` **left?**: `number`

Defined in: [src/core/outlines.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L64)

Left coordinate (for FitV, FitBV, XYZ).

***

### pageIndex

> `readonly` **pageIndex**: `number`

Defined in: [src/core/outlines.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L58)

Zero-based page index this bookmark points to.

***

### ref

> `readonly` **ref**: [`BookmarkRef`](BookmarkRef.md)

Defined in: [src/core/outlines.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L76)

The handle for this bookmark node.

***

### title

> `readonly` **title**: `string`

Defined in: [src/core/outlines.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L56)

The displayed bookmark title.

***

### y?

> `readonly` `optional` **y?**: `number`

Defined in: [src/core/outlines.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L60)

Vertical position on the target page (if set).

***

### zoom?

> `readonly` `optional` **zoom?**: `number`

Defined in: [src/core/outlines.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L66)

Zoom factor (for XYZ).
