[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / deviceNColor

# Function: deviceNColor()

> **deviceNColor**(`colorants`, `alternateSpace`, `tints`): [`DeviceNColor`](../interfaces/DeviceNColor.md)

Defined in: [src/core/operators/color.ts:129](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L129)

Create a DeviceN colour for multi-ink printing.

## Parameters

### colorants

`string`[]

Ordered list of colorant names.

### alternateSpace

`"DeviceCMYK"` \| `"DeviceRGB"`

Alternate colour space (`'DeviceCMYK'` or `'DeviceRGB'`).

### tints

`number`[]

Tint value per colorant `[0, 1]`.

## Returns

[`DeviceNColor`](../interfaces/DeviceNColor.md)
