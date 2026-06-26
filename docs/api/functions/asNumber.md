[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asNumber

# Function: asNumber()

> **asNumber**(`obj`): `number` \| `undefined`

Defined in: [src/utils/pdfValueHelpers.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/utils/pdfValueHelpers.ts#L80)

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
