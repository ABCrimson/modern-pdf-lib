[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePage

# Function: removePage()

> **removePage**(`doc`, `index`): `void`

Defined in: [src/core/pageManipulation.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pageManipulation.ts#L180)

Remove a page from the document by its zero-based index.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based index of the page to remove.

## Returns

`void`

## Throws

RangeError if the index is out of bounds.

## Example

```ts
removePage(doc, 0); // Remove the first page
```
