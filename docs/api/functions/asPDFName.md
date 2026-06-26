[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / asPdfName

# Function: asPdfName()

> **asPdfName**(`value`): [`PdfName`](../classes/PdfName.md)

Defined in: [src/utils/pdfValueHelpers.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/utils/pdfValueHelpers.ts#L22)

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
