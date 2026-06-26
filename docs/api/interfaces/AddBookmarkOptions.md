[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AddBookmarkOptions

# Interface: AddBookmarkOptions

Defined in: [src/core/outlines.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L82)

Options for [addBookmark](../functions/addBookmark.md).

## Properties

### bold?

> `optional` **bold?**: `boolean`

Defined in: [src/core/outlines.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L98)

Whether the title text is bold.

***

### color?

> `optional` **color?**: `object`

Defined in: [src/core/outlines.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L102)

Colour of the bookmark title (RGB, 0-1 range).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### fit?

> `optional` **fit?**: `"Fit"` \| `"FitH"` \| `"FitV"` \| `"FitB"` \| `"FitBH"` \| `"FitBV"` \| `"XYZ"`

Defined in: [src/core/outlines.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L92)

Page fit mode. Default: `'Fit'` (or `'FitH'` when only `y` is set).

***

### isOpen?

> `optional` **isOpen?**: `boolean`

Defined in: [src/core/outlines.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L107)

Whether the bookmark's children are initially expanded.
Default: `true`.

***

### italic?

> `optional` **italic?**: `boolean`

Defined in: [src/core/outlines.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L100)

Whether the title text is italic.

***

### left?

> `optional` **left?**: `number`

Defined in: [src/core/outlines.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L94)

Left coordinate (for FitV, FitBV, XYZ).

***

### pageIndex

> **pageIndex**: `number`

Defined in: [src/core/outlines.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L86)

Zero-based page index to navigate to.

***

### parent?

> `optional` **parent?**: [`BookmarkRef`](BookmarkRef.md)

Defined in: [src/core/outlines.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L88)

Parent bookmark for nesting.  Omit for a top-level bookmark.

***

### title

> **title**: `string`

Defined in: [src/core/outlines.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L84)

The display title for the bookmark.

***

### y?

> `optional` **y?**: `number`

Defined in: [src/core/outlines.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L90)

Vertical position on the page (top coordinate for FitH, FitBH, XYZ).

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [src/core/outlines.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/outlines.ts#L96)

Zoom factor (for XYZ). 0 = keep current zoom.
