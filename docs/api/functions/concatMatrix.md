[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / concatMatrix

# Function: concatMatrix()

> **concatMatrix**(`a`, `b`, `c`, `d`, `tx`, `ty`): `string`

Defined in: [src/core/operators/state.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/operators/state.ts#L109)

Concatenate the given matrix with the current transformation matrix
(`cm`).

The six operands define the matrix:

```
[ a  b  0 ]
[ c  d  0 ]
[ tx ty 1 ]
```

## Parameters

### a

`number`

Horizontal scaling / rotation.

### b

`number`

Rotation / skew.

### c

`number`

Rotation / skew.

### d

`number`

Vertical scaling / rotation.

### tx

`number`

Horizontal translation.

### ty

`number`

Vertical translation.

## Returns

`string`
