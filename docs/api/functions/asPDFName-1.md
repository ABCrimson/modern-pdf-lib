[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPDFName

# ~~Function: asPDFName()~~

```ts
function asPDFName(value): PdfName;
```

Defined in: [src/utils/pdfValueHelpers.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/utils/pdfValueHelpers.ts#L50)

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
