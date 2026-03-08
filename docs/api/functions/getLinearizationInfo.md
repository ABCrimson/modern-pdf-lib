[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getLinearizationInfo

# Function: getLinearizationInfo()

> **getLinearizationInfo**(`pdfBytes`): [`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

Defined in: [src/core/linearization.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L95)

Extract linearization information from a linearized PDF.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

The linearization info, or `null` if not linearized.
