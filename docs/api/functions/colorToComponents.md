[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / colorToComponents

# Function: colorToComponents()

> **colorToComponents**(`color`): `number`[]

Defined in: [src/core/operators/color.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L513)

Convert a typed [Color](../type-aliases/Color.md) to a numeric component array.

- Grayscale → `[gray]`
- RGB → `[r, g, b]`
- CMYK → `[c, m, y, k]`
- Spot → `[tint]`
- DeviceN → `[...tints]`

## Parameters

### color

[`Color`](../type-aliases/Color.md)

## Returns

`number`[]
