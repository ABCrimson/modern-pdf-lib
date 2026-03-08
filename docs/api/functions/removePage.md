[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePage

# Function: removePage()

> **removePage**(`doc`, `index`): `void`

Defined in: [src/core/pageManipulation.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pageManipulation.ts#L180)

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
