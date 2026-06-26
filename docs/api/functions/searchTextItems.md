[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / searchTextItems

# Function: searchTextItems()

> **searchTextItems**(`items`, `query`, `options?`): `TextMatch`[]

Defined in: src/parser/textSearch.ts:118

Search positioned text items for a string or RegExp, returning each match
with its page-coordinate hit-rectangles.

Items are joined with a single space (the natural inter-run separator);
matches that span items yield one rectangle per item touched.

## Parameters

### items

readonly [`TextItem`](../interfaces/TextItem.md)[]

Positioned text items from `extractTextWithPositions`.

### query

`string` \| `RegExp`

A literal string or a `RegExp` to search for.

### options?

`SearchOptions`

Case-sensitivity / whole-word options (string queries).

## Returns

`TextMatch`[]

The matches in document order.
