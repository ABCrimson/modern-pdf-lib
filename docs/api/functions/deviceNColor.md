[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / deviceNColor

# Function: deviceNColor()

```ts
function deviceNColor(
   colorants, 
   alternateSpace, 
   tints): DeviceNColor;
```

Defined in: [src/core/operators/color.ts:129](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L129)

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
