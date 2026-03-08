[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / circlePath

# Function: circlePath()

> **circlePath**(`cx`, `cy`, `radius`): `string`

Defined in: [src/core/operators/graphics.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/operators/graphics.ts#L281)

Produce the path operators for an approximate circle (4 cubic Bezier
curves).  Does NOT include the painting operator — call [stroke](strokeOp.md),
[fill](fillOp.md), or [fillAndStroke](fillAndStrokeOp.md) afterwards.

## Parameters

### cx

`number`

Centre x.

### cy

`number`

Centre y.

### radius

`number`

Radius.

## Returns

`string`
