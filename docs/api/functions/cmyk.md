[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / cmyk

# Function: cmyk()

```ts
function cmyk(
   c, 
   m, 
   y, 
   k): CmykColor;
```

Defined in: [src/core/operators/color.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L85)

Create a CMYK colour.

## Parameters

### c

`number`

Cyan component `[0, 1]`.

### m

`number`

Magenta component `[0, 1]`.

### y

`number`

Yellow component `[0, 1]`.

### k

`number`

Black component `[0, 1]`.

## Returns

[`CmykColor`](../interfaces/CmykColor.md)
