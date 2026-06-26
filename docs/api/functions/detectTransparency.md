[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectTransparency

# Function: detectTransparency()

> **detectTransparency**(`pdfBytes`): [`TransparencyInfo`](../interfaces/TransparencyInfo.md)

Defined in: [src/compliance/transparencyFlattener.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/compliance/transparencyFlattener.ts#L64)

Analyze PDF bytes for transparency usage.

Scans the raw PDF text for ExtGState entries that use:
- `/CA <value>` where value < 1.0 (stroke opacity)
- `/ca <value>` where value < 1.0 (fill opacity)
- `/SMask <ref>` where ref is not `/None`
- `/BM /<mode>` where mode is not `Normal`

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`TransparencyInfo`](../interfaces/TransparencyInfo.md)

A [TransparencyInfo](../interfaces/TransparencyInfo.md) describing any transparency found.
