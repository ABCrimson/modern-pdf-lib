[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CellContent

# Type Alias: CellContent

```ts
type CellContent = 
  | string
  | TextRun[]
  | NestedTableContent;
```

Defined in: [src/layout/table.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L48)

Content that can appear in a cell: plain text, styled text runs, or a nested table.
