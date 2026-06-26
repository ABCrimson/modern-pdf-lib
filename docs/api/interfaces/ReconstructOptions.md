[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ReconstructOptions

# Interface: ReconstructOptions

Defined in: src/parser/textReconstruct.ts:52

Options controlling line and paragraph reconstruction.

## Properties

### lineTolerance?

> `readonly` `optional` **lineTolerance?**: `number`

Defined in: src/parser/textReconstruct.ts:58

Maximum vertical distance (in user-space units) between two items for
them to be considered part of the same line.
Default: roughly half the median item height.

***

### paragraphGapFactor?

> `readonly` `optional` **paragraphGapFactor?**: `number`

Defined in: src/parser/textReconstruct.ts:64

A new paragraph starts when the vertical gap between two consecutive
lines exceeds this factor times the typical line height.
Default: `1.5`.
