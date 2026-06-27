[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / removePage

# Function: removePage()

```ts
function removePage(doc, index): void;
```

Defined in: [src/core/pageManipulation.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pageManipulation.ts#L174)

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
