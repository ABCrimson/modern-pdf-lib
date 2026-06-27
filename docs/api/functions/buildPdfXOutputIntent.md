[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPdfXOutputIntent

# Function: buildPdfXOutputIntent()

```ts
function buildPdfXOutputIntent(registry, config): PdfRef;
```

Defined in: [src/compliance/pdfxCompliance.ts:485](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfxCompliance.ts#L485)

Build a PDF/X output intent dictionary.

Creates the /OutputIntent dictionary and ICC profile stream
for use in the catalog's /OutputIntents array.

## Parameters

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry to register objects into.

### config

`OutputIntentConfig`

The output intent configuration.

## Returns

[`PdfRef`](../classes/PdfRef.md)

An indirect reference to the OutputIntent dictionary.
