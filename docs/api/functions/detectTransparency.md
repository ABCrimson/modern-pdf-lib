[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectTransparency

# Function: detectTransparency()

```ts
function detectTransparency(pdfBytes): TransparencyInfo;
```

Defined in: [src/compliance/transparencyFlattener.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L64)

Analyze PDF bytes for transparency usage.

Scans the raw PDF text for ExtGState entries that use:
- `/CA <value>` where value &lt; 1.0 (stroke opacity)
- `/ca <value>` where value &lt; 1.0 (fill opacity)
- `/SMask <ref>` where ref is not `/None`
- `/BM /<mode>` where mode is not `Normal`

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

[`TransparencyInfo`](../interfaces/TransparencyInfo.md)

A [TransparencyInfo](../interfaces/TransparencyInfo.md) describing any transparency found.
