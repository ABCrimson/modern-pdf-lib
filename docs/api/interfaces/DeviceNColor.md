[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeviceNColor

# Interface: DeviceNColor

Defined in: [src/core/operators/color.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L49)

A DeviceN colour for multi-ink printing.

## Properties

### alternateSpace

> `readonly` **alternateSpace**: `"DeviceCMYK"` \| `"DeviceRGB"`

Defined in: [src/core/operators/color.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L54)

Alternate colour space used for fallback rendering.

***

### colorants

> `readonly` **colorants**: `string`[]

Defined in: [src/core/operators/color.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L52)

Ordered list of colorant names.

***

### tints

> `readonly` **tints**: `number`[]

Defined in: [src/core/operators/color.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L56)

Tint value for each colorant `[0, 1]`.

***

### type

> `readonly` **type**: `"devicen"`

Defined in: [src/core/operators/color.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L50)
