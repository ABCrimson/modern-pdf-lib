[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / resizePage

# Function: resizePage()

```ts
function resizePage(
   doc, 
   index, 
   size): void;
```

Defined in: [src/core/pageManipulation.ts:318](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageManipulation.ts#L318)

Resize a page by setting its media box.

Note: This changes the page dimensions but does not scale existing
content. Content that was drawn at coordinates beyond the new
dimensions may be clipped.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based page index.

### size

[`PageSize`](../type-aliases/PageSize.md)

New page size.

## Returns

`void`
