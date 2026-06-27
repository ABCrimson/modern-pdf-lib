[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / stripProhibitedFeatures

# Function: stripProhibitedFeatures()

```ts
function stripProhibitedFeatures(pdfBytes, options?): StripResult;
```

Defined in: [src/compliance/stripProhibited.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/stripProhibited.ts#L96)

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
