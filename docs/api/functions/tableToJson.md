[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / tableToJson

# Function: tableToJson()

```ts
function tableToJson(table): Record<string, string>[];
```

Defined in: [src/parser/tableExtract.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/tableExtract.ts#L240)

Convert a table to an array of plain objects, using the first row as the
header keys.  Returns an empty array when the table has fewer than two
rows (i.e. no data rows beneath the header).

## Parameters

### table

[`ExtractedTable`](../interfaces/ExtractedTable.md)

The table to convert.

## Returns

`Record`\&lt;`string`, `string`\&gt;[]

One record per data row, mapping each header to its cell value.
