[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / circlePath

# Function: circlePath()

> **circlePath**(`cx`, `cy`, `radius`): `string`

Defined in: [src/core/operators/graphics.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/operators/graphics.ts#L281)

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
