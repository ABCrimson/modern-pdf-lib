[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SpotColor

# Interface: SpotColor

Defined in: [src/core/operators/color.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L38)

A spot (Separation) colour with a named colorant and a fallback.

## Properties

### alternateColor

> `readonly` **alternateColor**: [`RgbColor`](RgbColor.md) \| [`CmykColor`](CmykColor.md) \| [`GrayscaleColor`](GrayscaleColor.md)

Defined in: [src/core/operators/color.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L43)

Fallback colour used when the spot ink is unavailable.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/operators/color.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L41)

Colorant name, e.g. `'PANTONE 185 C'`.

***

### tint

> `readonly` **tint**: `number`

Defined in: [src/core/operators/color.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L45)

Tint value `[0, 1]` — 0 = no ink, 1 = full ink.

***

### type

> `readonly` **type**: `"spot"`

Defined in: [src/core/operators/color.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L39)
