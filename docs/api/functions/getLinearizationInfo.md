[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getLinearizationInfo

# Function: getLinearizationInfo()

```ts
function getLinearizationInfo(pdfBytes): LinearizationInfo | null;
```

Defined in: [src/core/linearization.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/linearization.ts#L99)

Extract linearization information from a linearized PDF.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`LinearizationInfo`](../interfaces/LinearizationInfo.md) \| `null`

The linearization info, or `null` if not linearized.
