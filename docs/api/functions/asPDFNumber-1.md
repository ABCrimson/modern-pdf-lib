[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPDFNumber

# ~~Function: asPDFNumber()~~

```ts
function asPDFNumber(value): PdfNumber;
```

Defined in: [src/utils/pdfValueHelpers.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/pdfValueHelpers.ts#L63)

Create a [PdfNumber](../classes/PdfNumber.md) from a numeric value.

## Parameters

### value

`number`

The number.

## Returns

[`PdfNumber`](../classes/PdfNumber.md)

A new [PdfNumber](../classes/PdfNumber.md) instance.

## Deprecated

Use [asPdfNumber](asPdfNumber.md) instead. This alias uses inconsistent
            PascalCase `PDF` while the rest of the codebase uses `Pdf`.
            Will be removed in v2.0.
