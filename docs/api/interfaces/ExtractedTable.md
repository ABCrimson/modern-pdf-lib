[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExtractedTable

# Interface: ExtractedTable

Defined in: [src/parser/tableExtract.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/tableExtract.ts#L40)

A reconstructed table: a rectangular grid of trimmed cell strings.
Missing cells are represented by the empty string.

## Properties

### rows

```ts
readonly rows: readonly readonly string[][];
```

Defined in: [src/parser/tableExtract.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/tableExtract.ts#L42)

The grid of rows, each row being an array of column cell strings.
