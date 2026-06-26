[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / reconstructLines

# Function: reconstructLines()

```ts
function reconstructLines(items, options?): TextLine[];
```

Defined in: [src/parser/textReconstruct.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L120)

Group positioned text items into lines.

Items are bucketed by baseline `y` (within `lineTolerance`), sorted
left-to-right within each line, and returned in top-to-bottom reading order.

## Parameters

### items

readonly [`TextItem`](../interfaces/TextItem.md)[]

The positioned text items (e.g. from `extractText` with
               positions enabled).  Order is irrelevant; they are re-sorted.

### options?

[`ReconstructOptions`](../interfaces/ReconstructOptions.md)

Reconstruction options.

## Returns

[`TextLine`](../interfaces/TextLine.md)[]

The reconstructed lines, in reading order.
