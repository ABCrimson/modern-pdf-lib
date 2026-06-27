[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / tableToJson

# Function: tableToJson()

```ts
function tableToJson(table): Record<string, string>[];
```

Defined in: [src/parser/tableExtract.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L240)

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
