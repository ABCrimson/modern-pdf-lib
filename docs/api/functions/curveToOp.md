[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / curveToOp

# Function: curveToOp()

> **curveToOp**(`x1`, `y1`, `x2`, `y2`, `x3`, `y3`): `string`

Defined in: [src/core/operators/graphics.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/operators/graphics.ts#L63)

Append a cubic Bezier curve to the current path (`c`).

The curve extends from the current point to `(x3, y3)`, using
`(x1, y1)` and `(x2, y2)` as control points.

## Parameters

### x1

`number`

### y1

`number`

### x2

`number`

### y2

`number`

### x3

`number`

### y3

`number`

## Returns

`string`
