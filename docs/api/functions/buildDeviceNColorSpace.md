[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDeviceNColorSpace

# Function: buildDeviceNColorSpace()

> **buildDeviceNColorSpace**(`colorants`, `alternateSpace`): [`PdfArray`](../classes/PdfArray.md)

Defined in: [src/core/operators/spotColor.ts:217](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/spotColor.ts#L217)

Build a DeviceN colour space array for multi-ink printing.

The returned `PdfArray` has the structure:
```
[/DeviceN [/Colorant1 /Colorant2 ...] /DeviceCMYK <tint-transform>]
```

## Parameters

### colorants

`string`[]

Ordered list of colorant names.

### alternateSpace

`"DeviceCMYK"` \| `"DeviceRGB"`

The alternate device colour space.

## Returns

[`PdfArray`](../classes/PdfArray.md)

A `PdfArray` representing the DeviceN colour space.
