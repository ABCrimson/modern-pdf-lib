[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageLabels

# Function: getPageLabels()

```ts
function getPageLabels(doc): 
  | readonly PageLabelRange[]
  | undefined;
```

Defined in: [src/core/pageLabels.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pageLabels.ts#L167)

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
