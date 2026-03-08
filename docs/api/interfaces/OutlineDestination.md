[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OutlineDestination

# Interface: OutlineDestination

Defined in: [src/outline/pdfOutline.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L44)

Describes where an outline item navigates to when clicked.

- `type: 'page'` — navigate to a specific page by zero-based index.
- `type: 'named'` — use a named destination string.

## Properties

### fit?

> `optional` **fit**: `"Fit"` \| `"FitH"` \| `"FitV"` \| `"FitB"` \| `"FitBH"` \| `"FitBV"` \| `"XYZ"`

Defined in: [src/outline/pdfOutline.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L52)

Page fit mode — how the page should be displayed.

***

### left?

> `optional` **left**: `number`

Defined in: [src/outline/pdfOutline.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L56)

Left coordinate for FitV, FitBV, XYZ fit modes.

***

### namedDestination?

> `optional` **namedDestination**: `string`

Defined in: [src/outline/pdfOutline.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L50)

Named destination string (used when `type` is `'named'`).

***

### pageIndex?

> `optional` **pageIndex**: `number`

Defined in: [src/outline/pdfOutline.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L48)

Zero-based page index (used when `type` is `'page'`).

***

### top?

> `optional` **top**: `number`

Defined in: [src/outline/pdfOutline.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L54)

Top coordinate for FitH, FitBH, XYZ fit modes.

***

### type

> **type**: `"page"` \| `"named"`

Defined in: [src/outline/pdfOutline.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L46)

Whether to navigate by page index or named destination.

***

### zoom?

> `optional` **zoom**: `number`

Defined in: [src/outline/pdfOutline.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/outline/pdfOutline.ts#L58)

Zoom factor for XYZ fit mode (0 means keep current).
