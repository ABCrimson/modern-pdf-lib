[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractTables

# Function: extractTables()

```ts
function extractTables(items, options?): ExtractedTable[];
```

Defined in: [src/parser/tableExtract.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/tableExtract.ts#L171)

Extract tables from a list of positioned text items.

## Parameters

### items

readonly [`TextItem`](../interfaces/TextItem.md)[]

Positioned text items (e.g. from `extractTextWithPositions`).

### options?

[`TableExtractOptions`](../interfaces/TableExtractOptions.md)

Optional clustering tolerances.

## Returns

[`ExtractedTable`](../interfaces/ExtractedTable.md)[]

One [ExtractedTable](../interfaces/ExtractedTable.md) per contiguous run of &gt;= 2 rows that
         share a consistent column structure.  Returns an empty array
         when no table-like block is found.
