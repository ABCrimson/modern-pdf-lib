[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / cmykToRgb

# Function: cmykToRgb()

```ts
function cmykToRgb(
   c, 
   m, 
   y, 
   k): [number, number, number];
```

Defined in: [src/core/operators/color.ts:197](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L197)

Convert CMYK components to RGB.

Uses the standard CMYK-to-RGB formula:
```
R = (1 - C) * (1 - K)
G = (1 - M) * (1 - K)
B = (1 - Y) * (1 - K)
```

## Parameters

### c

`number`

### m

`number`

### y

`number`

### k

`number`

## Returns

\[`number`, `number`, `number`\]

A tuple `[R, G, B]` with values in `[0, 1]`.
