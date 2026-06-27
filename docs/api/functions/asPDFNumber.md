[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPdfNumber

# Function: asPdfNumber()

```ts
function asPdfNumber(value): PdfNumber;
```

Defined in: [src/utils/pdfValueHelpers.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/pdfValueHelpers.ts#L37)

Create a [PdfNumber](../classes/PdfNumber.md) from a numeric value.

## Parameters

### value

`number`

The number.

## Returns

[`PdfNumber`](../classes/PdfNumber.md)

A new [PdfNumber](../classes/PdfNumber.md) instance.

## Example

```ts
const num = asPdfNumber(42);
```
