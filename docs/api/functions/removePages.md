[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePages

# Function: removePages()

> **removePages**(`doc`, `indices`): `void`

Defined in: [src/core/pageManipulation.ts:360](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pageManipulation.ts#L360)

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
