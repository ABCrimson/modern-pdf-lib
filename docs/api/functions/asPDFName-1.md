[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPDFName

# ~~Function: asPDFName()~~

```ts
function asPDFName(value): PdfName;
```

Defined in: [src/utils/pdfValueHelpers.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/pdfValueHelpers.ts#L50)

Create a [PdfName](../classes/PdfName.md) from a string.

## Parameters

### value

`string`

The name value (with or without leading `/`).

## Returns

[`PdfName`](../classes/PdfName.md)

A new [PdfName](../classes/PdfName.md) instance.

## Deprecated

Use [asPdfName](asPdfName.md) instead. This alias uses inconsistent
            PascalCase `PDF` while the rest of the codebase uses `Pdf`.
            Will be removed in v2.0.
