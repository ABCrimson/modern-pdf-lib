[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / circlePath

# Function: circlePath()

```ts
function circlePath(
   cx, 
   cy, 
   radius): string;
```

Defined in: [src/core/operators/graphics.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/graphics.ts#L281)

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
