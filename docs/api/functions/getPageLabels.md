[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageLabels

# Function: getPageLabels()

```ts
function getPageLabels(doc): 
  | readonly PageLabelRange[]
  | undefined;
```

Defined in: [src/core/pageLabels.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L167)

Get the current page label ranges for the document.

Returns `undefined` if no page labels have been set.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The document to read page labels from.

## Returns

  \| readonly [`PageLabelRange`](../interfaces/PageLabelRange.md)[]
  \| `undefined`

The page label ranges, or `undefined`.
