[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractTables

# Function: extractTables()

> **extractTables**(`items`, `options?`): [`ExtractedTable`](../interfaces/ExtractedTable.md)[]

Defined in: src/parser/tableExtract.ts:171

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

One [ExtractedTable](../interfaces/ExtractedTable.md) per contiguous run of >= 2 rows that
         share a consistent column structure.  Returns an empty array
         when no table-like block is found.
