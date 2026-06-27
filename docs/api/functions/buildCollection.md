[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildCollection

# Function: buildCollection()

```ts
function buildCollection(options?): PdfDict;
```

Defined in: [src/core/collections.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L114)

Build a `/Collection` dictionary (ISO 32000-2 §7.11.6) suitable for
placing in the document catalog under `/Collection`.

## Parameters

### options?

[`CollectionOptions`](../interfaces/CollectionOptions.md) = `{}`

Collection configuration; all fields are optional.  An
  empty/omitted options object yields a minimal collection with
  `/Type /Collection` and `/View /D`.

## Returns

[`PdfDict`](../classes/PdfDict.md)

The populated collection dictionary.
