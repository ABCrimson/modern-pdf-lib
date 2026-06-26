[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / tableToCsv

# Function: tableToCsv()

> **tableToCsv**(`table`): `string`

Defined in: src/parser/tableExtract.ts:222

Serialise a table to RFC 4180 CSV.  Fields containing a comma, a double
quote or a newline are wrapped in double quotes, with embedded quotes
doubled.  Rows are joined with `\r\n`.

## Parameters

### table

[`ExtractedTable`](../interfaces/ExtractedTable.md)

The table to serialise.

## Returns

`string`

The CSV text.
