[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExtractedTable

# Interface: ExtractedTable

Defined in: src/parser/tableExtract.ts:40

A reconstructed table: a rectangular grid of trimmed cell strings.
Missing cells are represented by the empty string.

## Properties

### rows

> `readonly` **rows**: readonly readonly `string`[][]

Defined in: src/parser/tableExtract.ts:42

The grid of rows, each row being an array of column cell strings.
