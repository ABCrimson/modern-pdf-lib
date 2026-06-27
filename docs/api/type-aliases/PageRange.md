[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageRange

# Type Alias: PageRange

```ts
type PageRange = [number, number];
```

Defined in: [src/core/documentMerge.ts:432](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/documentMerge.ts#L432)

A page range for splitting, specified as `[startIndex, endIndex]`.
Both indices are zero-based and inclusive.

For example, `[0, 2]` means pages 0, 1, and 2.
