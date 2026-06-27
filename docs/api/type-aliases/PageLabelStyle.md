[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageLabelStyle

# Type Alias: PageLabelStyle

```ts
type PageLabelStyle = "decimal" | "roman" | "Roman" | "alpha" | "Alpha";
```

Defined in: [src/core/pageLabels.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pageLabels.ts#L44)

Numbering style for page labels.

| Value      | PDF /S | Description                  | Example        |
|------------|--------|------------------------------|----------------|
| `decimal`  | `/D`   | Arabic numerals              | 1, 2, 3, …     |
| `roman`    | `/r`   | Lowercase Roman numerals     | i, ii, iii, …   |
| `Roman`    | `/R`   | Uppercase Roman numerals     | I, II, III, …   |
| `alpha`    | `/a`   | Lowercase alphabetic         | a, b, c, …      |
| `Alpha`    | `/A`   | Uppercase alphabetic         | A, B, C, …      |
