[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPdfName

# Function: asPdfName()

```ts
function asPdfName(value): PdfName;
```

Defined in: [src/utils/pdfValueHelpers.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/pdfValueHelpers.ts#L22)

Create a [PdfName](../classes/PdfName.md) from a string.

## Parameters

### value

`string`

The name value (with or without leading `/`).

## Returns

[`PdfName`](../classes/PdfName.md)

A new [PdfName](../classes/PdfName.md) instance.

## Example

```ts
const name = asPdfName('Type');
```
