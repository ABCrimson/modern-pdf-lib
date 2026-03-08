[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / componentsToColor

# Function: componentsToColor()

> **componentsToColor**(`components`): [`Color`](../type-aliases/Color.md)

Defined in: [src/core/operators/color.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/operators/color.ts#L252)

Convert a numeric component array to a typed [Color](../type-aliases/Color.md).

- 1 component → grayscale
- 3 components → RGB
- 4 components → CMYK

## Parameters

### components

`number`[]

Array of color component values `[0, 1]`.

## Returns

[`Color`](../type-aliases/Color.md)

## Throws

If the array length is not 1, 3, or 4.
