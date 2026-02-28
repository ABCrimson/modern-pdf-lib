[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setTextMatrixOp

# Function: setTextMatrixOp()

> **setTextMatrixOp**(`a`, `b`, `c`, `d`, `tx`, `ty`): `string`

Defined in: [src/core/operators/text.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/operators/text.ts#L167)

Set the text matrix and text line matrix (`Tm`).

The six operands form a standard 3 × 3 transformation matrix:

```
[ a  b  0 ]
[ c  d  0 ]
[ tx ty 1 ]
```

## Parameters

### a

`number`

Horizontal scaling.

### b

`number`

Rotation component (sin).

### c

`number`

Rotation component (−sin).

### d

`number`

Vertical scaling.

### tx

`number`

Horizontal translation.

### ty

`number`

Vertical translation.

## Returns

`string`
