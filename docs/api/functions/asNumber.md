[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asNumber

# Function: asNumber()

```ts
function asNumber(obj): number | undefined;
```

Defined in: [src/utils/pdfValueHelpers.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/pdfValueHelpers.ts#L80)

Extract a numeric value from a [PdfObject](../type-aliases/PdfObject.md).

Returns `undefined` if the object is not a PdfNumber.

## Parameters

### obj

[`PdfObject`](../type-aliases/PdfObject.md)

The PDF object to inspect.

## Returns

`number` \| `undefined`

The numeric value, or `undefined` if not a PdfNumber.

## Example

```ts
const val = asNumber(someObj); // number | undefined
```
