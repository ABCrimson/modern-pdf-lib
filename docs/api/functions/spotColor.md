[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / spotColor

# Function: spotColor()

> **spotColor**(`name`, `alternate`, `tint?`): [`SpotColor`](../interfaces/SpotColor.md)

Defined in: [src/core/operators/color.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L114)

Create a spot (Separation) colour.

Spot colours map to a named ink (e.g. a Pantone shade) with a
device-space fallback and a tint value that controls intensity.

## Parameters

### name

`string`

Colorant name, e.g. `'PANTONE 185 C'`.

### alternate

[`RgbColor`](../interfaces/RgbColor.md) \| [`CmykColor`](../interfaces/CmykColor.md) \| [`GrayscaleColor`](../interfaces/GrayscaleColor.md)

Fallback colour (RGB, CMYK, or grayscale).

### tint?

`number` = `1`

Tint intensity `[0, 1]`.  Defaults to `1`.

## Returns

[`SpotColor`](../interfaces/SpotColor.md)
