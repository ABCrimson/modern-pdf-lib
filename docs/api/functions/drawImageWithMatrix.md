[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawImageWithMatrix

# Function: drawImageWithMatrix()

> **drawImageWithMatrix**(`name`, `a`, `b`, `c`, `d`, `tx`, `ty`): `string`

Defined in: [src/core/operators/image.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/image.ts#L95)

Produce the full operator sequence to draw an image XObject with an
arbitrary 6-component transformation matrix.

The matrix maps the unit square to the target parallelogram:

```
[ a  b  0 ]
[ c  d  0 ]
[ tx ty 1 ]
```

## Parameters

### name

`string`

Resource name of the XObject.

### a

`number`

Horizontal scaling / rotation.

### b

`number`

Rotation / skew component.

### c

`number`

Rotation / skew component.

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
