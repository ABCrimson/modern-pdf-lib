[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TableExtractOptions

# Interface: TableExtractOptions

Defined in: src/parser/tableExtract.ts:48

Options controlling the clustering tolerances used during extraction.

## Properties

### colTolerance?

> `readonly` `optional` **colTolerance?**: `number`

Defined in: src/parser/tableExtract.ts:60

Maximum horizontal distance (user-space units) between item x-starts
for them to be considered part of the same column.
Default: `3`.

***

### rowTolerance?

> `readonly` `optional` **rowTolerance?**: `number`

Defined in: src/parser/tableExtract.ts:54

Maximum vertical distance (user-space units) between item baselines
for them to be considered part of the same row.
Default: roughly half the median item height.
