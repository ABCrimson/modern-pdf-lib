[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TableExtractOptions

# Interface: TableExtractOptions

Defined in: [src/parser/tableExtract.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L48)

Options controlling the clustering tolerances used during extraction.

## Properties

### colTolerance?

```ts
readonly optional colTolerance?: number;
```

Defined in: [src/parser/tableExtract.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L60)

Maximum horizontal distance (user-space units) between item x-starts
for them to be considered part of the same column.
Default: `3`.

***

### rowTolerance?

```ts
readonly optional rowTolerance?: number;
```

Defined in: [src/parser/tableExtract.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/tableExtract.ts#L54)

Maximum vertical distance (user-space units) between item baselines
for them to be considered part of the same row.
Default: roughly half the median item height.
