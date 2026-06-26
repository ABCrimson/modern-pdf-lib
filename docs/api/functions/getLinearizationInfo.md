[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getLinearizationInfo

# Function: getLinearizationInfo()

```ts
function getLinearizationInfo(pdfBytes): LinearizationInfo | null;
```

Defined in: [src/core/linearization.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L99)

Extract linearization information from a linearized PDF.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

The linearization info, or `null` if not linearized.
