[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getLinearizationInfo

# Function: getLinearizationInfo()

> **getLinearizationInfo**(`pdfBytes`): [`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

Defined in: [src/core/linearization.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L99)

Extract linearization information from a linearized PDF.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

The linearization info, or `null` if not linearized.
