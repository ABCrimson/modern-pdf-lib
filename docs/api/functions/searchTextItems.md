[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / searchTextItems

# Function: searchTextItems()

```ts
function searchTextItems(
   items, 
   query, 
   options?): TextMatch[];
```

Defined in: [src/parser/textSearch.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textSearch.ts#L118)

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
