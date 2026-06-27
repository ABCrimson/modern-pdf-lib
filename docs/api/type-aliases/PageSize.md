[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageSize

# Type Alias: PageSize

```ts
type PageSize = 
  | readonly [number, number]
  | {
  height: number;
  width: number;
};
```

Defined in: [src/core/pdfPage.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L161)

Type for a page-size input: a `[width, height]` tuple or `{ width, height }` object.
