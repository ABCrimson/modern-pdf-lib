[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / rgbToCmyk

# Function: rgbToCmyk()

> **rgbToCmyk**(`r`, `g`, `b`): \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/operators/color.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L164)

Convert RGB components to CMYK.

Uses the standard RGB-to-CMYK formula:
```
K = 1 - max(R, G, B)
C = (1 - R - K) / (1 - K)
M = (1 - G - K) / (1 - K)
Y = (1 - B - K) / (1 - K)
```

## Parameters

### r

`number`

### g

`number`

### b

`number`

## Returns

\[`number`, `number`, `number`, `number`\]

A tuple `[C, M, Y, K]` with values in `[0, 1]`.
