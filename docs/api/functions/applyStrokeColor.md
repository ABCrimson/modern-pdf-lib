[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyStrokeColor

# Function: applyStrokeColor()

> **applyStrokeColor**(`color`): `string`

Defined in: [src/core/operators/color.ts:438](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L438)

Emit the appropriate stroke-colour operator for a [Color](../type-aliases/Color.md) value.

For spot colours, emits a `CS` (set stroking colour space) followed
by `SCN` (set stroking colour in current space).

For DeviceN colours, emits `CS` + `SCN` with the tint values.

## Parameters

### color

[`Color`](../type-aliases/Color.md)

## Returns

`string`
