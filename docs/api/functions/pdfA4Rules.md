[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / pdfA4Rules

# Function: pdfA4Rules()

```ts
function pdfA4Rules(level?): readonly string[];
```

Defined in: [src/compliance/pdfA4.ts:210](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L210)

Return the human-readable conformance requirements for a PDF/A-4
variant.

## Parameters

### level?

[`PdfA4Level`](../type-aliases/PdfA4Level.md)

Conformance variant. Default: `'PDF/A-4'`.

## Returns

readonly `string`[]

An ordered list of requirement strings.
