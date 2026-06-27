[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExtractedTable

# Interface: ExtractedTable

Defined in: [src/parser/tableExtract.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L40)

A reconstructed table: a rectangular grid of trimmed cell strings.
Missing cells are represented by the empty string.

## Properties

### rows

```ts
readonly rows: readonly readonly string[][];
```

Defined in: [src/parser/tableExtract.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L42)

The grid of rows, each row being an array of column cell strings.
