[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / componentsToColor

# Function: componentsToColor()

```ts
function componentsToColor(components): Color;
```

Defined in: [src/core/operators/color.ts:489](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L489)

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
