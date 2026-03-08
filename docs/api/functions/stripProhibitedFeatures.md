[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / stripProhibitedFeatures

# Function: stripProhibitedFeatures()

> **stripProhibitedFeatures**(`pdfBytes`, `options?`): [`StripResult`](../interfaces/StripResult.md)

Defined in: [src/compliance/stripProhibited.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/compliance/stripProhibited.ts#L89)

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
