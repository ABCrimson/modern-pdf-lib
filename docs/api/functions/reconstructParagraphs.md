[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / reconstructParagraphs

# Function: reconstructParagraphs()

```ts
function reconstructParagraphs(items, options?): TextParagraph[];
```

Defined in: [src/parser/textReconstruct.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textReconstruct.ts#L184)

Group positioned text items into paragraphs.

First reconstructs lines (see [reconstructLines](reconstructLines.md)), then starts a new
paragraph whenever the vertical gap between two consecutive lines exceeds
`paragraphGapFactor` times the typical (median) line height.

## Parameters

### items

readonly [`TextItem`](../interfaces/TextItem.md)[]

The positioned text items.

### options?

[`ReconstructOptions`](../interfaces/ReconstructOptions.md)

Reconstruction options.

## Returns

[`TextParagraph`](../interfaces/TextParagraph.md)[]

The reconstructed paragraphs, in reading order.
