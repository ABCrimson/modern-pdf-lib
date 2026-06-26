[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageLabelStyle

# Type Alias: PageLabelStyle

```ts
type PageLabelStyle = "decimal" | "roman" | "Roman" | "alpha" | "Alpha";
```

Defined in: [src/core/pageLabels.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L44)

Numbering style for page labels.

| Value      | PDF /S | Description                  | Example        |
|------------|--------|------------------------------|----------------|
| `decimal`  | `/D`   | Arabic numerals              | 1, 2, 3, …     |
| `roman`    | `/r`   | Lowercase Roman numerals     | i, ii, iii, …   |
| `Roman`    | `/R`   | Uppercase Roman numerals     | I, II, III, …   |
| `alpha`    | `/a`   | Lowercase alphabetic         | a, b, c, …      |
| `Alpha`    | `/A`   | Uppercase alphabetic         | A, B, C, …      |
