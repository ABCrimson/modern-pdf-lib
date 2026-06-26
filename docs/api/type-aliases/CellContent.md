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

Defined in: [src/layout/table.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L48)

Content that can appear in a cell: plain text, styled text runs, or a nested table.
