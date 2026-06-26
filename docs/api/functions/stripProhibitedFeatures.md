[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / stripProhibitedFeatures

# Function: stripProhibitedFeatures()

```ts
function stripProhibitedFeatures(pdfBytes, options?): StripResult;
```

Defined in: [src/compliance/stripProhibited.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/stripProhibited.ts#L96)

Strip prohibited features from PDF bytes.

Each prohibited feature category can be individually enabled or disabled
via [StripOptions](../interfaces/StripOptions.md). By default all categories are stripped.

Stripping works by replacing action type entries with harmless equivalents
(e.g. `/S /JavaScript` becomes `/S /URI`) and removing inline script
payloads (`/JS (...)` or `/JS <...>`).

## Parameters

### pdfBytes

`Uint8Array`

Raw PDF bytes.

### options?

[`StripOptions`](../interfaces/StripOptions.md) = `{}`

What to strip. All categories enabled by default.

## Returns

[`StripResult`](../interfaces/StripResult.md)

Modified bytes and a strip report.
