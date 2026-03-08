[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / rotationMatrix

# Function: rotationMatrix()

> **rotationMatrix**(`angle`, `cx`, `cy`): \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/core/operators/state.ts:178](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/operators/state.ts#L178)

Build the six-component matrix array for a rotation about an
arbitrary centre point `(cx, cy)`.

Useful when you need to compose this with other transformations
before emitting operators.

## Parameters

### angle

[`Angle`](../type-aliases/Angle.md)

### cx

`number`

### cy

`number`

## Returns

\[`number`, `number`, `number`, `number`, `number`, `number`\]

`[a, b, c, d, tx, ty]`
