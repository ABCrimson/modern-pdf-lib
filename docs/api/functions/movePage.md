[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / movePage

# Function: movePage()

> **movePage**(`doc`, `fromIndex`, `toIndex`): `void`

Defined in: [src/core/pageManipulation.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pageManipulation.ts#L203)

Move a page from one position to another within the document.

The page at `fromIndex` is removed and then inserted at `toIndex`
(computed after the removal).

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### fromIndex

`number`

Current zero-based index of the page to move.

### toIndex

`number`

Target zero-based index. Must be in range
                  `[0, pageCount - 1]` after removal.

## Returns

`void`

## Throws

RangeError if either index is out of bounds.

## Example

```ts
movePage(doc, 2, 0); // Move page 2 to the front
```
