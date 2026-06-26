[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPdfNumber

# Function: asPdfNumber()

```ts
function asPdfNumber(value): PdfNumber;
```

Defined in: [src/utils/pdfValueHelpers.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/utils/pdfValueHelpers.ts#L37)

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
