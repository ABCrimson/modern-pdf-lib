[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Operand

# Type Alias: Operand

> **Operand** = `number` \| `string` \| `boolean` \| `null` \| [`PdfName`](../classes/PdfName.md) \| `Operand`[]

Defined in: [src/parser/contentStreamParser.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/parser/contentStreamParser.ts#L34)

A single operand value in a content stream.

- `number` — integer or real
- `string` — literal `(…)` or hex `<…>` string (decoded to a JS string)
- `boolean` — `true` / `false`
- `null` — the PDF `null` keyword
- `PdfName` — a `/Name`
- `Operand[]` — a PDF array `[…]`
