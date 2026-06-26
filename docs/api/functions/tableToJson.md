[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / tableToJson

# Function: tableToJson()

> **tableToJson**(`table`): `Record`\<`string`, `string`\>[]

Defined in: src/parser/tableExtract.ts:240

Convert a table to an array of plain objects, using the first row as the
header keys.  Returns an empty array when the table has fewer than two
rows (i.e. no data rows beneath the header).

## Parameters

### table

[`ExtractedTable`](../interfaces/ExtractedTable.md)

The table to convert.

## Returns

`Record`\<`string`, `string`\>[]

One record per data row, mapping each header to its cell value.
