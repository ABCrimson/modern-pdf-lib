[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePages

# Function: removePages()

> **removePages**(`doc`, `indices`): `void`

Defined in: [src/core/pageManipulation.ts:360](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pageManipulation.ts#L360)

Remove multiple pages at once, given their zero-based indices.

Indices are processed in descending order to avoid shifting issues.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### indices

`number`[]

Array of zero-based page indices to remove.

## Returns

`void`

## Throws

RangeError if any index is out of bounds.
