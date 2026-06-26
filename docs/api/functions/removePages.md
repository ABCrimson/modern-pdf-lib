[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePages

# Function: removePages()

```ts
function removePages(doc, indices): void;
```

Defined in: [src/core/pageManipulation.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageManipulation.ts#L354)

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
