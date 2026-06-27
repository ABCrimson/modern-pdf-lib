[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Operand

# Type Alias: Operand

```ts
type Operand = 
  | number
  | string
  | boolean
  | null
  | PdfName
  | Operand[];
```

Defined in: [src/parser/contentStreamParser.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/contentStreamParser.ts#L34)

A single operand value in a content stream.

- `number` — integer or real
- `string` — literal `(…)` or hex `<…>` string (decoded to a JS string)
- `boolean` — `true` / `false`
- `null` — the PDF `null` keyword
- `PdfName` — a `/Name`
- `Operand[]` — a PDF array `[…]`
