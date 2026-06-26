[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ReconstructOptions

# Interface: ReconstructOptions

Defined in: [src/parser/textReconstruct.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L52)

Options controlling line and paragraph reconstruction.

## Properties

### lineTolerance?

```ts
readonly optional lineTolerance?: number;
```

Defined in: [src/parser/textReconstruct.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L58)

Maximum vertical distance (in user-space units) between two items for
them to be considered part of the same line.
Default: roughly half the median item height.

***

### paragraphGapFactor?

```ts
readonly optional paragraphGapFactor?: number;
```

Defined in: [src/parser/textReconstruct.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L64)

A new paragraph starts when the vertical gap between two consecutive
lines exceeds this factor times the typical line height.
Default: `1.5`.
