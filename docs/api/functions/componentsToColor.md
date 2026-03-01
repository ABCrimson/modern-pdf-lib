[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / componentsToColor

# Function: componentsToColor()

> **componentsToColor**(`components`): [`Color`](../type-aliases/Color.md)

Defined in: [src/core/operators/color.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/operators/color.ts#L252)

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
