[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / colorToComponents

# Function: colorToComponents()

```ts
function colorToComponents(color): number[];
```

Defined in: [src/core/operators/color.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L513)

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
