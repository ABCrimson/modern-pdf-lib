[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / spotColor

# Function: spotColor()

```ts
function spotColor(
   name, 
   alternate, 
   tint?): SpotColor;
```

Defined in: [src/core/operators/color.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L114)

Create a spot (Separation) colour.

Spot colours map to a named ink (e.g. a Pantone shade) with a
device-space fallback and a tint value that controls intensity.

## Parameters

### name

`string`

Colorant name, e.g. `'PANTONE 185 C'`.

### alternate

  \| [`RgbColor`](../interfaces/RgbColor.md)
  \| [`CmykColor`](../interfaces/CmykColor.md)
  \| [`GrayscaleColor`](../interfaces/GrayscaleColor.md)

Fallback colour (RGB, CMYK, or grayscale).

### tint?

`number` = `1`

Tint intensity `[0, 1]`.  Defaults to `1`.

## Returns

[`SpotColor`](../interfaces/SpotColor.md)
