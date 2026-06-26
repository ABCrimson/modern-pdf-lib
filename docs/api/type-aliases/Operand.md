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

Defined in: [src/parser/contentStreamParser.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/contentStreamParser.ts#L34)

A single operand value in a content stream.

- `number` — integer or real
- `string` — literal `(…)` or hex `<…>` string (decoded to a JS string)
- `boolean` — `true` / `false`
- `null` — the PDF `null` keyword
- `PdfName` — a `/Name`
- `Operand[]` — a PDF array `[…]`
