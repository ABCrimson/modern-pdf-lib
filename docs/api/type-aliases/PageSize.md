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

Defined in: [src/core/pdfPage.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L160)

Type for a page-size input: a `[width, height]` tuple or `{ width, height }` object.
